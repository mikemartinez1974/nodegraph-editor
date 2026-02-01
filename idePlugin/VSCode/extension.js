const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

const EXTENSION_BUILD_TAG = 'bundle-fix-2';

const panelState = new WeakMap();
const panelStates = new Set();
const documentCache = new Map();
const edgeRouteCache = new Map();

class TwiliteNodeEditorProvider {
  static viewType = 'twilite.nodeEditor';

  constructor(context) {
    this.context = context;
  }

  resolveCustomTextEditor(document, webviewPanel) {
    console.log(`[TwilitePreviewHost] resolveCustomTextEditor file=${document.uri?.toString?.()}`);
    const panelId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const priorState = panelState.get(webviewPanel);
    const docUri = document.uri?.toString?.();
    const existing = [...panelStates].find((entry) => entry.documentUri === docUri);
    if (existing && existing.webviewPanel !== webviewPanel) {
      try {
        existing.webviewPanel.reveal(existing.webviewPanel.viewColumn, true);
      } catch {}
      try {
        webviewPanel.dispose();
      } catch {}
      return;
    }
    if (priorState && priorState.documentUri && priorState.documentUri !== document.uri.toString()) {
      const viewColumn = webviewPanel.viewColumn;
      try {
        vscode.commands.executeCommand(
          'vscode.openWith',
          document.uri,
          TwiliteNodeEditorProvider.viewType,
          { preview: false, viewColumn }
        );
      } catch {}
      try {
        webviewPanel.dispose();
      } catch {}
      return;
    }
    const htmlInitialized = Boolean(priorState?.htmlInitialized);
    if (priorState) {
      priorState.disposables.forEach((disposable) => disposable.dispose());
      panelState.delete(webviewPanel);
      panelStates.delete(priorState);
    }
    const state = {
      panelId,
      webviewPanel,
      document,
      documentUri: document.uri?.toString?.(),
      lastSentText: null,
      lastSentUri: null,
      postSequence: 0,
      webviewReadyHandled: false,
      htmlInitialized,
      disposables: []
    };
    panelState.set(webviewPanel, state);
    panelStates.add(state);
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const localResourceRoots = [
      this.context.extensionUri,
      vscode.Uri.joinPath(this.context.extensionUri, 'media')
    ];
    if (workspaceRoot) {
      localResourceRoots.push(vscode.Uri.file(path.join(workspaceRoot, 'out')));
    }
    webviewPanel.webview.options = {
      enableScripts: true,
      retainContextWhenHidden: false,
      localResourceRoots
    };

    const initialText = document.getText();
    documentCache.set(document.uri.toString(), initialText);
    webviewPanel.webview.html = this.getHtml(webviewPanel.webview, initialText, panelId);
    state.htmlInitialized = true;
    webviewPanel.title = document.uri?.path?.split('/').pop() || '.node editor';

    // Pin the editor to avoid VSCode preview-tab reuse (true multi-preview per file).
    vscode.commands.executeCommand('workbench.action.keepEditor').catch(() => {});

    const getCachedText = () => {
      const currentDoc = state.document;
      if (!currentDoc) return '';
      const uri = currentDoc.uri.toString();
      if (documentCache.has(uri)) {
        return documentCache.get(uri);
      }
      const text = currentDoc.getText();
      documentCache.set(uri, text);
      return text;
    };

    const postText = (force = false) => {
      const currentDoc = state.document;
      if (!currentDoc) return;
      const uri = currentDoc.uri?.toString?.();
      const text = getCachedText();
      if (!force && state.lastSentText === text) return;
      const previousText = state.lastSentText;
      state.lastSentText = text;
      const switchedFile = uri && state.lastSentUri && uri !== state.lastSentUri;
      state.lastSentUri = uri || state.lastSentUri;
      const shouldForceClear = !text || !text.trim();
      const cachedRoutes = uri ? edgeRouteCache.get(uri) : null;
      const edgeRoutesPayload = cachedRoutes
        ? { edgeRoutes: cachedRoutes.routes, edgeRouteIds: cachedRoutes.edgeIds }
        : {};
      if (switchedFile) {
        state.postSequence += 1;
        console.log(`[TwilitePreviewHost] post clear file=${uri} seq=${state.postSequence}`);
        webviewPanel.webview.postMessage({
          type: 'setText',
          text: '',
          uri,
          seq: state.postSequence,
          panelId,
          forceClear: true
        });
      }
      if (shouldForceClear && previousText && previousText.trim()) {
        state.webviewReadyHandled = false;
        state.htmlInitialized = false;
        console.log(`[TwilitePreviewHost] reload webview for empty file=${uri}`);
        webviewPanel.webview.html = this.getHtml(webviewPanel.webview, text, panelId);
        return;
      }
      state.postSequence += 1;
      console.log(`[TwilitePreviewHost] post setText file=${uri} length=${text.length}`);
      webviewPanel.webview.postMessage({
        type: 'setText',
        text,
        uri,
        seq: state.postSequence,
        panelId,
        forceClear: shouldForceClear,
        ...edgeRoutesPayload
      });
    };

    const changeSubscription = vscode.workspace.onDidChangeTextDocument((event) => {
      const currentDoc = state.document;
      if (!currentDoc) return;
      if (event.document.uri.toString() !== currentDoc.uri.toString()) return;
      const uri = event.document.uri.toString();
      const text = event.document.getText();
      documentCache.set(uri, text);
      postText(true);
    });

    const disposeSubscription = webviewPanel.onDidDispose(() => {
      changeSubscription.dispose();
      panelState.delete(webviewPanel);
      panelStates.delete(state);
    });

    const viewStateSubscription = webviewPanel.onDidChangeViewState((event) => {
      if (!event.webviewPanel?.active) return;
      const currentDoc = state.document;
      if (currentDoc) {
        const raw = getCachedText();
        if (!raw || !raw.trim()) {
          state.webviewReadyHandled = false;
          state.htmlInitialized = false;
          console.log(`[TwilitePreviewHost] reload webview on activate (empty file) ${currentDoc.uri?.toString?.()}`);
          webviewPanel.webview.html = this.getHtml(webviewPanel.webview, raw, panelId);
          return;
        }
      }
      postText(true);
    });

    const messageSubscription = webviewPanel.webview.onDidReceiveMessage((message) => {
      if (!message) return;
      if (message.type === 'webviewReady') {
        if (!state.webviewReadyHandled) {
          state.webviewReadyHandled = true;
          postText(true);
        }
        return;
      }
      if (message.type === 'edgeRoutes') {
        const { uri, edgeIds, routes } = message || {};
        if (!uri || !routes || typeof routes !== 'object') return;
        edgeRouteCache.set(uri, { edgeIds: Array.isArray(edgeIds) ? edgeIds : [], routes });
        return;
      }
      if (message.type === 'update') {
        const edit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(
          document.positionAt(0),
          document.positionAt(document.getText().length)
        );
        edit.replace(document.uri, fullRange, message.text);
        vscode.workspace.applyEdit(edit);
        documentCache.set(document.uri.toString(), message.text);
        return;
      }
    });

    state.disposables = [changeSubscription, disposeSubscription, viewStateSubscription, messageSubscription];
  }

  getHtml(webview, text, panelId) {
    const nonce = String(Date.now());
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      return this.getFallbackHtml(webview, nonce, 'Open a workspace to load the editor.');
    }
    const outDir = path.join(workspaceRoot, 'out');
    const editorHtmlPath = path.join(outDir, 'editor', 'index.html');
    if (!fs.existsSync(editorHtmlPath)) {
      return this.getFallbackHtml(
        webview,
        nonce,
        'Missing exported editor bundle. Run the web build (next export) to generate /out.'
      );
    }

    const rawHtml = fs.readFileSync(editorHtmlPath, 'utf8');
    const normalizeWebviewUri = (uri) => uri.replace('file%2B', 'file+');
    const toWebviewUri = (assetPath) =>
      normalizeWebviewUri(
        webview.asWebviewUri(vscode.Uri.file(path.join(outDir, assetPath.replace(/^\/+/, '')))).toString()
      );
    const nextRootUri = normalizeWebviewUri(
      webview.asWebviewUri(vscode.Uri.file(path.join(outDir, '_next'))).toString()
    );
    const editorRootUri = normalizeWebviewUri(
      webview.asWebviewUri(vscode.Uri.file(path.join(outDir, 'editor'))).toString()
    );

    const patchTurbopackRuntime = () => {
      const match = rawHtml.match(/\/_next\/static\/chunks\/turbopack-[^"']+\.js/);
      if (!match) return;
      const runtimeRelPath = match[0].replace(/^\/+/, '');
      const runtimeFile = path.join(outDir, runtimeRelPath);
      if (!fs.existsSync(runtimeFile)) return;
      const desiredBase = nextRootUri.endsWith('/') ? nextRootUri : `${nextRootUri}/`;
      try {
        const content = fs.readFileSync(runtimeFile, 'utf8');
        if (content.includes(desiredBase)) return;
        const replacement = `let t=${JSON.stringify(desiredBase)},`;
        const updated = content.replace(/let t="[^"]*\/_next\/",/g, replacement);
        if (updated !== content) {
          fs.writeFileSync(runtimeFile, updated, 'utf8');
          console.log('[TwilitePreviewHost] Patched Turbopack base', desiredBase);
        }
      } catch (err) {
        console.warn('[TwilitePreviewHost] Failed to patch Turbopack runtime', err);
      }
    };
    patchTurbopackRuntime();

    const patchChunkCurrentScript = () => {
      const chunkMatches = rawHtml.match(/\/_next\/static\/chunks\/[^"']+\.js/g);
      if (!chunkMatches) return;
      const uniqueChunks = Array.from(new Set(chunkMatches));
      uniqueChunks.forEach((chunkPath) => {
        const relPath = chunkPath.replace(/^\/+/, '');
        const chunkFile = path.join(outDir, relPath);
        if (!fs.existsSync(chunkFile)) return;
        try {
          const content = fs.readFileSync(chunkFile, 'utf8');
          if (!content.includes('document.currentScript')) return;
          const chunkRef = relPath.replace(/^_next\//, '');
          const replacement = `["${chunkRef}",`;
          const updated = content.replace(
            /\["object"==typeof document\?document\.currentScript:void 0,/,
            replacement
          );
          if (updated !== content) {
            fs.writeFileSync(chunkFile, updated, 'utf8');
            console.log('[TwilitePreviewHost] Patched chunk currentScript', chunkRef);
          }
        } catch (err) {
          console.warn('[TwilitePreviewHost] Failed to patch chunk currentScript', chunkFile, err);
        }
      });
    };
    patchChunkCurrentScript();

    const rewrittenAttrs = rawHtml.replace(/(src|href)=["'](\/[^"']+)["']/g, (match, attr, assetPath) => {
      return `${attr}="${toWebviewUri(assetPath)}"`;
    });
    const escapedNextRoot = nextRootUri.replace(/"/g, '\\"');
    const escapedEditorRoot = editorRootUri.replace(/"/g, '\\"');
    let rewritten = rewrittenAttrs
      .replace(/(["'])\/_next\//g, `$1${nextRootUri}/`)
      .replace(/(["'])\/editor\//g, `$1${editorRootUri}/`)
      .replace(/(["'])\/favicon\./g, `$1${editorRootUri.replace(/\/editor$/, '')}/favicon.`)
      .replace(/\\"\/_next\//g, `\\"${escapedNextRoot}/`)
      .replace(/\\"\/editor\//g, `\\"${escapedEditorRoot}/`)
      .replace(/\\"\/favicon\./g, `\\"${escapedEditorRoot.replace(/\/editor$/, '')}/favicon.`);
    rewritten = rewritten.replace(/<script([^>]*?)\s+async(="")?([^>]*)>/gi, '<script$1$3>');
    rewritten = rewritten.replace(/<script(?![^>]*\bsrc=)(?![^>]*\bnonce=)([^>]*)>/gi, `<script nonce="${nonce}"$1>`);

    const vscodeCdn = 'https://*.vscode-cdn.net';
    const nonceToken = `nonce-${nonce}`;
    const csp = [
      "default-src 'none'",
      `img-src ${webview.cspSource} ${vscodeCdn} https: data: blob:`,
      `font-src ${webview.cspSource} ${vscodeCdn} https: data: blob:`,
      `style-src 'unsafe-inline' ${webview.cspSource} ${vscodeCdn} https:`,
      `script-src '${nonceToken}' 'unsafe-eval' ${webview.cspSource} ${vscodeCdn} https: http: data: blob:`,
      `script-src-elem '${nonceToken}' ${webview.cspSource} ${vscodeCdn} https: http: data: blob:`,
      `worker-src ${webview.cspSource} blob:`,
      `connect-src ${webview.cspSource} ${vscodeCdn} https: http: ws: wss:`
    ].join('; ');
    const bootstrap = `
      <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        window.__Twilite_EMBED__ = true;
        window.__Twilite_HOST__ = 'vscode';
        window.__Twilite_POST_MESSAGE__ = (payload) => vscode.postMessage(payload);
        window.next = window.next || {};
        console.log('[TwilitePreview] webview bootstrap loaded (bundle-fix-2)');
        try {
          const badge = document.createElement('div');
          badge.textContent = 'Twilite Preview: bundle-fix-2';
          badge.style.cssText = 'position:fixed;top:6px;right:8px;z-index:2147483647;padding:2px 6px;font:11px/1.2 system-ui,sans-serif;background:rgba(0,0,0,0.55);color:#fff;border-radius:4px;pointer-events:none;';
          document.documentElement.appendChild(badge);
        } catch {}
        try {
          const cspTag = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
          console.log('[TwilitePreview] CSP', cspTag ? cspTag.content : 'missing');
        } catch {}
        try {
          const inlineScripts = Array.from(document.querySelectorAll('script:not([src])'));
          const withoutNonce = inlineScripts.filter((script) => !script.nonce);
          console.log('[TwilitePreview] inline scripts', {
            total: inlineScripts.length,
            withoutNonce: withoutNonce.length,
            sampleNonce: inlineScripts[0]?.nonce || null
          });
        } catch {}
        try {
          const nextQueue = window.__next_f || (window.__next_f = []);
          if (!nextQueue.__twiliteHooked) {
            nextQueue.__twiliteHooked = true;
            const originalPush = nextQueue.push.bind(nextQueue);
            nextQueue.push = (...args) => {
              console.log('[TwilitePreview] __next_f push', args[0]);
              return originalPush(...args);
            };
          }
        } catch {}
        const attachScriptListeners = (script) => {
          if (!script || script.__twiliteAttached) return;
          script.__twiliteAttached = true;
          script.addEventListener('load', () => {
            console.log('[TwilitePreview] script loaded', script.src);
          });
          script.addEventListener('error', () => {
            console.error('[TwilitePreview] script error', script.src);
          });
        };
        try {
          const scripts = Array.from(document.querySelectorAll('script[src]'));
          console.log('[TwilitePreview] script tags (initial)', scripts.map((script) => ({
            src: script.src,
            type: script.type || 'text/javascript',
            async: script.async,
            noModule: script.noModule
          })));
          scripts.forEach(attachScriptListeners);
          const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
              for (const node of mutation.addedNodes || []) {
                if (node?.tagName === 'SCRIPT' && node.src) {
                  attachScriptListeners(node);
                  console.log('[TwilitePreview] script added', {
                    src: node.src,
                    type: node.type || 'text/javascript',
                    async: node.async,
                    noModule: node.noModule
                  });
                }
              }
            }
          });
          observer.observe(document.documentElement || document, { childList: true, subtree: true });
        } catch {}
        window.addEventListener('load', () => {
          console.log('[TwilitePreview] window load', JSON.stringify({
            readyState: document.readyState,
            hasNext: typeof window.__next_f !== 'undefined',
            hasTurbopack: typeof window.TURBOPACK !== 'undefined',
            scriptCount: document.querySelectorAll('script[src]').length
          }));
          try {
            const nextQueue = window.__next_f || [];
            console.log('[TwilitePreview] __next_f length', nextQueue.length);
          } catch {}
        });
        window.setTimeout(() => {
          console.log('[TwilitePreview] post-load check', JSON.stringify({
            hasNext: typeof window.__next_f !== 'undefined',
            hasApplyGraph: typeof window.__Twilite_APPLY_GRAPH__ === 'function',
            scriptCount: document.querySelectorAll('script[src]').length
          }));
          try {
            const scripts = Array.from(document.querySelectorAll('script[src]'));
            console.log('[TwilitePreview] script tags (post-load)', scripts.map((script) => script.src));
            const resources = performance.getEntriesByType('resource');
            const scriptEntries = resources.filter((entry) => entry.initiatorType === 'script');
            console.log('[TwilitePreview] script resources', scriptEntries.map((entry) => entry.name));
          } catch {}
          try {
            console.log('[TwilitePreview] runtime globals', {
              hasTurbopackRequire: typeof window.__turbopack_require__ === 'function',
              hasNextRequire: typeof window.__next_require__ === 'function'
            });
          } catch {}
        }, 1000);
        window.setTimeout(() => {
          try {
            const resources = performance.getEntriesByType('resource');
            const scriptEntries = resources.filter((entry) => entry.initiatorType === 'script');
            console.log('[TwilitePreview] script resources (2s)', scriptEntries.map((entry) => entry.name));
          } catch {}
        }, 2000);
        let pendingPayload = null;
        let retryCount = 0;
        const retryApply = () => {
          if (!pendingPayload) return;
          if (typeof window.__Twilite_APPLY_GRAPH__ === 'function') {
            const payload = pendingPayload;
            pendingPayload = null;
            window.__Twilite_APPLY_GRAPH__(payload);
            console.log('[TwilitePreview] applied pending graph');
            return;
          }
          retryCount += 1;
          if (retryCount < 40) {
            window.setTimeout(retryApply, 250);
          } else {
            console.warn('[TwilitePreview] applyGraph never became ready');
          }
        };
        window.setTimeout(retryApply, 250);
        let lastUri = '';
        let lastSeq = 0;
        const applyGraph = (payload) => {
          if (!payload || typeof payload !== 'object') return;
          console.log('[TwilitePreview] applyGraph', {
            nodeCount: Array.isArray(payload.nodes) ? payload.nodes.length : 0,
            edgeCount: Array.isArray(payload.edges) ? payload.edges.length : 0
          });
          if (window.__Twilite_APPLY_GRAPH__) {
            window.__Twilite_APPLY_GRAPH__(payload);
          } else {
            pendingPayload = payload;
            window.__Twilite_PENDING_GRAPH__ = payload;
            retryApply();
          }
        };
        const isEmptyGraph = (payload) => {
          const nodes = Array.isArray(payload?.nodes) ? payload.nodes : [];
          const edges = Array.isArray(payload?.edges) ? payload.edges : [];
          const clusters = Array.isArray(payload?.clusters)
            ? payload.clusters
            : Array.isArray(payload?.groups)
              ? payload.groups
              : [];
          return nodes.length === 0 && edges.length === 0 && clusters.length === 0;
        };
        const scheduleEmptyClear = () => {
          let attempts = 0;
          const attemptClear = () => {
            attempts += 1;
            try {
              const exporter = window.__Twilite_EXPORT_GRAPH__;
              const canApply = typeof window.__Twilite_APPLY_GRAPH__ === 'function';
              let current = null;
              if (typeof exporter === 'function') {
                try {
                  current = exporter();
                } catch {}
              }
              const currentNodes = Array.isArray(current?.nodes) ? current.nodes : [];
              const currentEdges = Array.isArray(current?.edges) ? current.edges : [];
              const currentClusters = Array.isArray(current?.clusters)
                ? current.clusters
                : Array.isArray(current?.groups)
                  ? current.groups
                  : [];
              const stillHasGraph =
                currentNodes.length > 0 || currentEdges.length > 0 || currentClusters.length > 0;
              if (canApply && stillHasGraph) {
                window.__Twilite_APPLY_GRAPH__({ nodes: [], edges: [], clusters: [] });
                try {
                  window.dispatchEvent(new CustomEvent('forceRedraw'));
                } catch {}
              }
              if (!stillHasGraph) return;
            } catch {}
            if (attempts < 6) {
              window.setTimeout(attemptClear, 200);
            }
          };
          window.setTimeout(attemptClear, 50);
        };
        window.addEventListener('message', (event) => {
          const message = event.data;
          if (!message || message.type !== 'setText') return;
          const raw = message.text || '';
          const uri = message.uri || '';
          const seq = typeof message.seq === 'number' ? message.seq : 0;
          const forceClear = Boolean(message.forceClear);
          if (!forceClear) {
            if (seq && seq < lastSeq) return;
            lastSeq = seq || lastSeq + 1;
          } else if (seq && seq > lastSeq) {
            lastSeq = seq;
          }
          if (uri && uri !== lastUri) {
            lastUri = uri;
          }
          console.log('[TwilitePreview] setText received', { uri, length: raw.length, seq });
          try {
            const parsed = raw && raw.trim() ? JSON.parse(raw) : { nodes: [], edges: [], clusters: [] };
            if (message.edgeRoutes) parsed.edgeRoutes = message.edgeRoutes;
            if (message.edgeRouteIds) parsed.edgeRouteIds = message.edgeRouteIds;
            const emptyGraph = isEmptyGraph(parsed);
            if (emptyGraph) {
              console.log('[TwilitePreview] empty graph detected, forcing clear');
            }
            if (forceClear && emptyGraph) {
              applyGraph({ nodes: [], edges: [], clusters: [] });
              scheduleEmptyClear();
              try {
                localStorage.removeItem('Twilite_local_graph');
              } catch {}
              return;
            }
            applyGraph(parsed);
            if (emptyGraph) {
              scheduleEmptyClear();
            }
          } catch (err) {
            console.error('[TwilitePreview] Invalid JSON', err);
          }
        });
        window.addEventListener('error', (event) => {
          const target = event?.target;
          if (target && target.tagName === 'SCRIPT') {
            console.error('[TwilitePreview] script load failed', target.src);
          } else if (event?.message) {
            console.error('[TwilitePreview] error', event.message);
          }
        }, true);
        window.addEventListener('unhandledrejection', (event) => {
          const reason = event?.reason;
          if (reason?.message) {
            console.error('[TwilitePreview] unhandledrejection', reason.message);
          } else {
            console.error('[TwilitePreview] unhandledrejection', String(reason));
          }
        });
        window.addEventListener('error', (event) => {
          const reason = event?.reason;
          if (reason?.message) {
            console.error('[TwilitePreview] window error', reason.message);
          } else if (event?.message) {
            console.error('[TwilitePreview] window error', event.message);
          }
        });
        window.setTimeout(() => {
          try {
            console.log('[TwilitePreview] globals', {
              hasReact: typeof window.React !== 'undefined',
              hasReactDOM: typeof window.ReactDOM !== 'undefined',
              hasNextRequire: typeof window.__next_require__ !== 'undefined',
              hasApplyGraph: typeof window.__Twilite_APPLY_GRAPH__ === 'function',
              hasGraphEditor: typeof window.GraphEditor !== 'undefined'
            });
          } catch {}
        }, 1500);
        vscode.postMessage({ type: 'webviewReady' });
      </script>`;

    const hasCspMeta = /<meta http-equiv="Content-Security-Policy"[^>]*>/i.test(rewritten);
    const withCsp = hasCspMeta
      ? rewritten.replace(
          /<meta http-equiv="Content-Security-Policy"[^>]*>/i,
          `<meta http-equiv="Content-Security-Policy" content="${csp}">`
        )
      : rewritten;
    const injected = withCsp.replace(/<head[^>]*>/i, (match) => {
      const metaTag = `<meta http-equiv="Content-Security-Policy" content="${csp}">`;
      return `${match}\n${hasCspMeta ? '' : metaTag}\n${bootstrap}`;
    });
    return injected;
  }

  getFallbackHtml(webview, nonce, message) {
    const csp = `default-src 'none'; style-src 'unsafe-inline' ${webview.cspSource};`;
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Twilite Node</title>
  <style>
    body { margin: 0; font-family: var(--vscode-font-family, system-ui, sans-serif); background: var(--vscode-editor-background, #0b0f1a); color: var(--vscode-editor-foreground, #e2e8f0); }
    .message { padding: 24px; }
  </style>
</head>
<body>
  <div class="message">${message}</div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    vscode.postMessage({ type: 'webviewReady' });
  </script>
</body>
</html>`;
  }
}

function activate(context) {
  console.log(`[TwilitePreviewHost] activate ${EXTENSION_BUILD_TAG} from ${__filename}`);
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      TwiliteNodeEditorProvider.viewType,
      new TwiliteNodeEditorProvider(context),
      { supportsMultipleEditorsPerDocument: false }
    )
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
