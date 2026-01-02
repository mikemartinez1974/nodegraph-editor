import * as vscode from 'vscode';
import * as path from 'path';

class NodeGraphDocument implements vscode.CustomDocument {
  uri: vscode.Uri;
  data: any;
  private readonly _onDidDispose = new vscode.EventEmitter<void>();
  public readonly onDidDispose = this._onDidDispose.event;

  constructor(uri: vscode.Uri, data: any) {
    this.uri = uri;
    this.data = data;
  }

  dispose(): void {
    this._onDidDispose.fire();
    this._onDidDispose.dispose();
  }
}

class NodeGraphEditorProvider implements vscode.CustomReadonlyEditorProvider<NodeGraphDocument> {
  public static readonly viewType = 'twilight.nodeGraph';

  constructor(private readonly context: vscode.ExtensionContext) {}

  async openCustomDocument(uri: vscode.Uri): Promise<NodeGraphDocument> {
    const data = await this.readGraphFile(uri);
    return new NodeGraphDocument(uri, data);
  }

  async resolveCustomEditor(
    document: NodeGraphDocument,
    webviewPanel: vscode.WebviewPanel
  ): Promise<void> {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    const workspaceRoot = workspaceFolder?.uri;
    const outRoot = await this.resolveOutRoot(document.uri);
    console.log('[Twilight] Opening graph', document.uri.fsPath);
    console.log('[Twilight] outRoot', outRoot?.fsPath ?? 'none');

    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        this.context.extensionUri,
        ...(outRoot ? [outRoot] : []),
        ...(workspaceRoot ? [workspaceRoot] : [])
      ]
    };

    const updateWebview = async () => {
      const fresh = await this.readGraphFile(document.uri);
      document.data = fresh;
      webviewPanel.webview.postMessage({ type: 'graph', data: fresh });
    };

    const safeStringify = (payload: any) => {
      try {
        return JSON.stringify(payload);
      } catch {
        return String(payload);
      }
    };

    webviewPanel.webview.onDidReceiveMessage((message) => {
      if (!message || typeof message !== 'object') return;
      if (message.type === 'ready') {
        console.log('[Twilight] Webview ready');
        webviewPanel.webview.postMessage({ type: 'graph', data: document.data });
        return;
      }
      if (message.type === 'webview-error') {
        console.error('[Twilight Webview]', safeStringify(message));
        return;
      }
      if (message.type === 'webview-log') {
        console.log('[Twilight Webview]', safeStringify(message));
      }
    });

    const watcher = vscode.workspace.createFileSystemWatcher(document.uri.fsPath);
    watcher.onDidChange(() => updateWebview());
    watcher.onDidCreate(() => updateWebview());
    watcher.onDidDelete(() => updateWebview());
    webviewPanel.onDidDispose(() => watcher.dispose());

    webviewPanel.webview.html = await this.getHtml(webviewPanel.webview, outRoot, document.uri);
  }

  private async readGraphFile(uri: vscode.Uri): Promise<any> {
    try {
      const raw = await vscode.workspace.fs.readFile(uri);
      const text = Buffer.from(raw).toString('utf8');
      return JSON.parse(text);
    } catch (err) {
      return { fileVersion: '1.0', nodes: [], edges: [], groups: [], error: String(err) };
    }
  }

  private async resolveOutRoot(documentUri: vscode.Uri): Promise<vscode.Uri | null> {
    const candidates = new Set<string>();
    const addCandidate = (fsPath: string) => {
      if (fsPath) {
        candidates.add(fsPath);
      }
    };

    let currentDir = path.dirname(documentUri.fsPath);
    let previousDir = '';
    while (currentDir && currentDir !== previousDir) {
      addCandidate(path.join(currentDir, 'out'));
      previousDir = currentDir;
      currentDir = path.dirname(currentDir);
    }

    for (const folder of vscode.workspace.workspaceFolders || []) {
      addCandidate(path.join(folder.uri.fsPath, 'out'));
    }

    addCandidate(path.join(this.context.extensionPath, '..', '..', 'out'));

    for (const candidate of candidates) {
      const entryCandidates = ['editor.html', 'editor/index.html', 'index.html'];
      for (const entry of entryCandidates) {
        const indexUri = vscode.Uri.file(path.join(candidate, entry));
        try {
          await vscode.workspace.fs.stat(indexUri);
          return vscode.Uri.file(candidate);
        } catch {
          // Try next candidate.
        }
      }
    }

    return null;
  }

  private async getHtml(
    webview: vscode.Webview,
    outRoot: vscode.Uri | null,
    documentUri: vscode.Uri
  ): Promise<string> {
    const nonce = getNonce();
    if (!outRoot) {
      return `<!DOCTYPE html><html><body>Missing out/ directory for ${documentUri.fsPath}</body></html>`;
    }

    try {
      const entryCandidates = [
        vscode.Uri.joinPath(outRoot, 'editor.html'),
        vscode.Uri.joinPath(outRoot, 'editor', 'index.html'),
        vscode.Uri.joinPath(outRoot, 'index.html')
      ];
      let raw: Uint8Array | null = null;
      let entryPath: string | null = null;
      let entryRelative: string | null = null;
      for (const candidate of entryCandidates) {
        try {
          raw = await vscode.workspace.fs.readFile(candidate);
          entryPath = candidate.fsPath;
          entryRelative = path.relative(outRoot.fsPath, candidate.fsPath).replace(/\\/g, '/');
          break;
        } catch {
          // Try next candidate.
        }
      }
      if (!raw) {
        throw new Error('Missing out/index.html (or out/editor.html / out/editor/index.html)');
      }
      console.log('[Twilight] Using entry', entryPath ?? 'unknown');
      const baseUri = webview
        .asWebviewUri(outRoot)
        .toString()
        .replace(/%2B/gi, '+');
      const entryRoute = (() => {
        if (!entryRelative) return '/';
        if (entryRelative === 'index.html') return '/';
        if (entryRelative.endsWith('/index.html')) {
          const route = entryRelative.slice(0, -'/index.html'.length);
          return `/${route}`;
        }
        if (entryRelative.endsWith('.html')) {
          return `/${entryRelative.slice(0, -'.html'.length)}`;
        }
        return '/';
      })();
      console.log('[Twilight] baseUri', baseUri);
      console.log('[Twilight] cspSource', webview.cspSource);
      const csp = [
        "default-src 'none'",
        `img-src ${webview.cspSource} data: blob:`,
        `style-src ${webview.cspSource} 'unsafe-inline'`,
        `font-src ${webview.cspSource} data:`,
        `script-src ${webview.cspSource} 'nonce-${nonce}' 'unsafe-eval'`,
        `connect-src ${webview.cspSource} https: http:`,
        `worker-src ${webview.cspSource} blob:`,
        `frame-src ${webview.cspSource}`
      ].join('; ');

      let html = Buffer.from(raw).toString('utf8');

      const turbopackMatch = html.match(/<script[^>]*src="([^"]*turbopack-[^"]+\.js)"[^>]*><\/script>/i);
      if (turbopackMatch) {
        const turbopackSrc = turbopackMatch[1];
        const runtimePath = turbopackSrc.startsWith('/') ? turbopackSrc.slice(1) : turbopackSrc;
        const runtimeUri = vscode.Uri.joinPath(outRoot, ...runtimePath.split('/'));
        const runtimeRaw = await vscode.workspace.fs.readFile(runtimeUri);
        let runtimeText = Buffer.from(runtimeRaw).toString('utf8');
        const runtimePrefix = `${baseUri}/_next/`;
        const runtimeChunkPath = runtimePath.replace(/^_next\//, '');
        const runtimeRegex = /\b(let|var)\s+t="\/_next\/"/;
        const currentScriptToken = '["object"==typeof document?document.currentScript:void 0,';
        if (runtimeRegex.test(runtimeText)) {
          runtimeText = runtimeText.replace(
            runtimeRegex,
            `$1 t=${JSON.stringify(runtimePrefix)}`
          );
          const runtimeUrlToken = 'function S(e){return`${t}${e.split("/").map(e=>encodeURIComponent(e)).join("/")}`}';
          if (runtimeText.includes(runtimeUrlToken)) {
            runtimeText = runtimeText.replace(
              runtimeUrlToken,
              'function S(e){return/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(e)?e:`${t}${e.replace(/^\\/_next\\//,"").split("/").map(e=>encodeURIComponent(e)).join("/")}`}'
            );
          }
          if (runtimeText.includes(currentScriptToken)) {
            runtimeText = runtimeText.replace(
              currentScriptToken,
              `[${JSON.stringify(runtimeChunkPath)},`
            );
          }
          const patchedRuntimePath = runtimePath.replace(/\.js$/, '.vscode.js');
          const patchedRuntimeUri = vscode.Uri.joinPath(outRoot, ...patchedRuntimePath.split('/'));
          await vscode.workspace.fs.writeFile(patchedRuntimeUri, Buffer.from(runtimeText, 'utf8'));
          const patchedSrc = turbopackSrc.startsWith('/')
            ? `/${patchedRuntimePath}`
            : patchedRuntimePath;
          html = html.replace(
            turbopackMatch[0],
            `<script src="${patchedSrc}"></script>`
          );
        }
      }

      const scriptTagRegex = /<script[^>]*src="([^"]+)"[^>]*><\/script>/gi;
      let scriptMatch: RegExpExecArray | null = null;
      while ((scriptMatch = scriptTagRegex.exec(html))) {
        const scriptTag = scriptMatch[0];
        const scriptSrc = scriptMatch[1];
        if (!scriptSrc.includes('/_next/static/chunks/') || scriptSrc.includes('.vscode.js')) continue;
        const srcBase = scriptSrc.split('?')[0].split('#')[0];
        const scriptPath = srcBase.startsWith('/') ? srcBase.slice(1) : srcBase;
        const scriptUri = vscode.Uri.joinPath(outRoot, ...scriptPath.split('/'));
        let scriptRaw: Uint8Array;
        try {
          scriptRaw = await vscode.workspace.fs.readFile(scriptUri);
        } catch {
          continue;
        }
        let scriptText = Buffer.from(scriptRaw).toString('utf8');
        let patched = false;
        const currentScriptToken = '["object"==typeof document?document.currentScript:void 0,';
        if (scriptText.includes(currentScriptToken)) {
          const chunkPath = scriptPath.replace(/^_next\//, '');
          scriptText = scriptText.replace(
            currentScriptToken,
            `[${JSON.stringify(chunkPath)},`
          );
          patched = true;
        }
        if (scriptText.includes('getAssetPrefix') && scriptText.includes('document.currentScript')) {
          const getAssetPrefixRegex =
            /(Object\.defineProperty\(n,"getAssetPrefix"[\s\S]*?)function l\(\)\{[\s\S]*?return t\.slice\(0,n\)\}/;
          if (getAssetPrefixRegex.test(scriptText)) {
            const getAssetPrefixReplacement = `$1function l(){let e=document.currentScript,t=e&&e.src?e.src:"";if(!t){let e=typeof window!=="undefined"&&(window.__TWILIGHT_BASE_URI__||document.baseURI);return e?e.replace(/\\/$/,""):""}let n=-1;try{let e=new URL(t);n=e.pathname.indexOf("/_next/")}catch(e){}if(-1===n){let e=typeof window!=="undefined"&&(window.__TWILIGHT_BASE_URI__||document.baseURI);return e?e.replace(/\\/$/,""):t.replace(/\\/$/,"")}return t.slice(0,t.indexOf("/_next/"))}`;
            scriptText = scriptText.replace(getAssetPrefixRegex, getAssetPrefixReplacement);
            patched = true;
          }
        }
        if (!patched) continue;
        const patchedPath = scriptPath.replace(/\.js$/, '.vscode.js');
        const patchedUri = vscode.Uri.joinPath(outRoot, ...patchedPath.split('/'));
        await vscode.workspace.fs.writeFile(patchedUri, Buffer.from(scriptText, 'utf8'));
        const patchedSrc = scriptSrc.startsWith('/')
          ? `/${patchedPath}`
          : patchedPath;
        html = html.replace(scriptTag, scriptTag.replace(scriptSrc, patchedSrc));
        console.log('[Twilight] Patched chunk', scriptPath);
      }

      html = html.replace(
        /<head>/i,
        `<head>\n<meta http-equiv="Content-Security-Policy" content="${csp}">\n<base href="${baseUri}/">\n<script nonce="${nonce}">\n  (function() {\n    window.__TWILIGHT_EMBED__ = true;\n    window.__TWILIGHT_BASE_URI__ = ${JSON.stringify(baseUri)};\n    window.__TWILIGHT_EARLY_LOGS__ = [];\n    window.__TWILIGHT_EARLY_ERRORS__ = [];\n    window.__TWILIGHT_ENTRY_PATH__ = ${JSON.stringify(entryRoute)};\n\n    try {\n      const desiredPath = window.__TWILIGHT_ENTRY_PATH__ || '/';\n      const search = location?.search || '';\n      const hash = location?.hash || '';\n      if (location && location.pathname !== desiredPath) {\n        history.replaceState(null, '', desiredPath + search + hash);\n      }\n    } catch (e) {}\n\n    const coerceHistoryUrl = (value) => {\n      try {\n        if (!value) return value;\n        const base = window.__TWILIGHT_BASE_URI__ || '';\n        const raw = value instanceof URL ? value.href : String(value);\n        const resolved = new URL(raw, window.location.href);\n        if (resolved.origin === window.location.origin) {\n          return resolved.pathname + resolved.search + resolved.hash;\n        }\n        if (base && resolved.href.startsWith(base)) {\n          let suffix = resolved.href.slice(base.length);\n          if (!suffix.startsWith('/')) suffix = '/' + suffix;\n          return suffix;\n        }\n        return resolved.pathname + resolved.search + resolved.hash;\n      } catch (e) {\n        return value;\n      }\n    };\n\n    const wrapHistory = (method) => {\n      try {\n        const original = history[method];\n        if (typeof original !== 'function') return;\n        history[method] = function(state, title, url) {\n          try {\n            return original.call(this, state, title, coerceHistoryUrl(url));\n          } catch (e) {\n            try {\n              return original.call(this, state, title);\n            } catch (e2) {\n              return undefined;\n            }\n          }\n        };\n      } catch (e) {}\n    };\n\n    wrapHistory('replaceState');\n    wrapHistory('pushState');\n\n    const pushLog = (payload) => {\n      try {\n        if (typeof window.__TWILIGHT_LOG__ === 'function') {\n          window.__TWILIGHT_LOG__(payload);\n          return;\n        }\n        window.__TWILIGHT_EARLY_LOGS__.push(payload);\n      } catch (e) {}\n    };\n\n    const pushError = (payload) => {\n      try {\n        if (typeof window.__TWILIGHT_ERROR__ === 'function') {\n          window.__TWILIGHT_ERROR__(payload);\n          return;\n        }\n        window.__TWILIGHT_EARLY_ERRORS__.push(payload);\n      } catch (e) {}\n    };\n\n    const formatConsoleArg = (arg) => {\n      try {\n        if (arg instanceof Error) return arg.stack || arg.message || String(arg);\n        if (typeof arg === 'string') return arg;\n        return JSON.stringify(arg);\n      } catch (e) {\n        return String(arg);\n      }\n    };\n\n    const wrapConsole = (level) => {\n      const original = console[level];\n      if (typeof original !== 'function') return;\n      console[level] = (...args) => {\n        try {\n          pushError({ message: 'console-' + level, args: (args || []).slice(0, 4).map(formatConsoleArg), early: true });\n        } catch (e) {}\n        return original.apply(console, args);\n      };\n    };\n\n    ['error', 'warn'].forEach(wrapConsole);\n\n    const ensureNextQueue = () => {\n      try {\n        const globalObj = typeof self !== 'undefined' ? self : window;\n        const queue = Array.isArray(globalObj.__next_f) ? globalObj.__next_f : [];\n        if (!queue.__twilightWrapped) {\n          const origPush = queue.push ? queue.push.bind(queue) : Array.prototype.push.bind(queue);\n          queue.push = (...args) => {\n            pushLog({ message: 'nextf-push', count: args.length, early: true });\n            return origPush(...args);\n          };\n          queue.__twilightWrapped = true;\n        }\n        globalObj.__next_f = queue;\n      } catch (e) {}\n    };\n\n    const logNextState = (stage) => {\n      try {\n        const globalObj = typeof self !== 'undefined' ? self : window;\n        const queue = globalObj.__next_f;\n        const turbopackType = typeof globalObj.TURBOPACK;\n        const hasWebpack = typeof globalObj.__webpack_require__ === 'function'\n          || (Array.isArray(globalObj.webpackChunk_N_E));\n        pushLog({\n          message: 'next-state',\n          stage,\n          hasNextF: Array.isArray(queue),\n          nextFLen: Array.isArray(queue) ? queue.length : null,\n          nextFWrapped: !!(queue && queue.__twilightWrapped),\n          turbopackType,\n          hasTurbopack: turbopackType !== 'undefined',\n          hasWebpack\n        });\n      } catch (e) {}\n    };\n    ensureNextQueue();\n    logNextState('bootstrap');\n    document.addEventListener('DOMContentLoaded', () => logNextState('domcontentloaded'));\n    setTimeout(() => logNextState('timeout-2000'), 2000);\n\n\n    const baseUri = window.__TWILIGHT_BASE_URI__ || '';\n    const splitUrl = (value) => {\n      const match = String(value || '').match(/^([^?#]*)(.*)$/);\n      return { path: match ? match[1] : String(value || ''), suffix: match ? match[2] : '' };\n    };\n\n    const normalizePath = (path) => {\n      const entryPath = window.__TWILIGHT_ENTRY_PATH__ || '/';\n      if (!path || path === '/') {\n        if (entryPath === '/' || entryPath === '') return '/index.html';\n        return entryPath.endsWith('.html') ? entryPath : entryPath + '.html';\n      }\n      if (path.startsWith('/_next/')) return path;\n      if (path.endsWith('/')) return path.slice(0, -1) + '.html';\n      const last = path.split('/').pop() || '';\n      if (!last.includes('.')) return path + '.html';\n      return path;\n    };\n\n    const rewriteToBase = (value) => {\n      try {\n        if (!value || !baseUri) return value;\n        if (typeof value !== 'string') return value;\n        if (value.startsWith('#')) return value;\n        if (value.startsWith(baseUri)) return value;\n        if (value.startsWith('data:') || value.startsWith('blob:') || value.startsWith('file:') || value.startsWith('vscode-resource:') || value.startsWith('vscode-file:')) {\n          return value;\n        }\n        if (value.startsWith('vscode-webview://')) {\n          const parsed = new URL(value);\n          const path = normalizePath(parsed.pathname || '/');\n          return baseUri + path + (parsed.search || '') + (parsed.hash || '');\n        }\n        if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) return value;\n        const parts = splitUrl(value);\n        const rawPath = parts.path || '';\n        const path = rawPath.startsWith('/') ? rawPath : '/' + rawPath.replace(/^\\.\\/?/, '');\n        return baseUri + normalizePath(path) + (parts.suffix || '');\n      } catch (e) {\n        return value;\n      }\n    };\n\n    window.__TWILIGHT_REWRITE_URL__ = rewriteToBase;\n\n    const trackResource = (el, kind, attr) => {\n      try {\n        if (!el || el.__twilightTracked) return;\n        el.__twilightTracked = true;\n        const rawUrl = el.getAttribute(attr) || '';\n        const rewritten = rewriteToBase(rawUrl);\n        if (rewritten && rewritten !== rawUrl) {\n          try { el.setAttribute(attr, rewritten); } catch (e) {}\n        }\n        const finalUrl = el.getAttribute(attr) || rewritten || rawUrl || '';\n        if (kind === 'script' || kind === 'link') {\n          el.addEventListener('load', () => {\n            pushLog({ message: 'resource-load', kind, url: finalUrl, early: true });\n          }, { once: true });\n        }\n        el.addEventListener('error', () => {\n          pushError({ message: 'resource-error', kind, url: finalUrl, early: true });\n        }, { once: true });\n      } catch (e) {}\n    };\n    const trackExistingResources = () => {\n      try {\n        document.querySelectorAll('script[src]').forEach((el) => trackResource(el, 'script', 'src'));\n        document.querySelectorAll('link[href]').forEach((el) => trackResource(el, 'link', 'href'));
        document.querySelectorAll('img[src]').forEach((el) => trackResource(el, 'img', 'src'));
        document.querySelectorAll('source[src]').forEach((el) => trackResource(el, 'source', 'src'));
        document.querySelectorAll('video[src]').forEach((el) => trackResource(el, 'video', 'src'));
        document.querySelectorAll('audio[src]').forEach((el) => trackResource(el, 'audio', 'src'));
        document.querySelectorAll('iframe[src]').forEach((el) => trackResource(el, 'iframe', 'src'));\n      } catch (e) {}\n    };\n\n    trackExistingResources();\n\n    try {\n      const observer = new MutationObserver((mutations) => {\n        for (const mutation of mutations) {\n          for (const node of mutation.addedNodes || []) {\n            if (!node || !node.tagName) continue;\n            const tag = node.tagName.toLowerCase();\n            if (tag === 'script' && node.getAttribute('src')) {\n              trackResource(node, 'script', 'src');\n            }\n            if (tag === 'link' && node.getAttribute('href')) {
              trackResource(node, 'link', 'href');
            }
            if (tag === 'img' && node.getAttribute('src')) {
              trackResource(node, 'img', 'src');
            }
            if (tag === 'source' && node.getAttribute('src')) {
              trackResource(node, 'source', 'src');
            }
            if (tag === 'video' && node.getAttribute('src')) {
              trackResource(node, 'video', 'src');
            }
            if (tag === 'audio' && node.getAttribute('src')) {
              trackResource(node, 'audio', 'src');
            }
            if (tag === 'iframe' && node.getAttribute('src')) {
              trackResource(node, 'iframe', 'src');
            }\n          }\n        }\n      });\n      observer.observe(document.documentElement || document, { childList: true, subtree: true });\n    } catch (e) {}\n\n    if (typeof fetch === 'function') {\n      try {\n        const origFetch = window.fetch.bind(window);\n        window.fetch = (...args) => {\n          const input = args[0];\n          const isUrl = input && typeof input === 'object' && typeof input.href === 'string';\n          const url = typeof input === 'string'\n            ? input\n            : (input && input.url ? input.url : (isUrl ? input.href : ''));\n          const rewritten = rewriteToBase(url);\n          if (rewritten && url && rewritten !== url) {\n            pushLog({ message: 'fetch-rewrite', url, rewritten, early: true });\n            try {\n              if (typeof input === 'string' || isUrl) {\n                args[0] = rewritten;\n              } else if (input && typeof Request === 'function' && input instanceof Request) {\n                args[0] = new Request(rewritten, input);\n              }\n            } catch (e) {}\n          }\n          return origFetch(...args)\n            .then((res) => {\n              if (res && !res.ok) {\n                pushError({ message: 'fetch-status', url: rewritten || url, status: res.status, statusText: res.statusText, early: true });\n              }\n              return res;\n            })\n            .catch((err) => {\n              pushError({ message: 'fetch-error', url: rewritten || url, error: String(err), early: true });\n              throw err;\n            });\n        };\n      } catch (e) {}\n    }\n\n    if (window.XMLHttpRequest && window.XMLHttpRequest.prototype) {\n      try {\n        const origOpen = window.XMLHttpRequest.prototype.open;\n        window.XMLHttpRequest.prototype.open = function(method, url, ...rest) {\n          const rawUrl = String(url || '');\n          const rewritten = rewriteToBase(rawUrl);\n          if (rewritten && rawUrl && rewritten !== rawUrl) {\n            pushLog({ message: 'xhr-rewrite', url: rawUrl, rewritten, early: true });\n          }\n          return origOpen.call(this, method, rewritten || rawUrl, ...rest);\n        };\n      } catch (e) {}\n    }\n\n    window.addEventListener('error', (event) => {\n      try {\n        const target = event && event.target;\n        const url = target && (target.src || target.href);\n        if (url) {\n          pushError({\n            message: 'resource-error',\n            kind: (target.tagName || '').toLowerCase(),\n            url: String(url),\n            early: true\n          });\n          return;\n        }\n      } catch (e) {}\n      pushError({\n        message: event?.message || 'Webview error',\n        filename: event?.filename,\n        lineno: event?.lineno,\n        colno: event?.colno,\n        stack: event?.error?.stack || String(event?.error || event?.message || 'unknown'),\n        early: true\n      });\n    }, true);\n\n    window.addEventListener('unhandledrejection', (event) => {\n      const reason = event?.reason;\n      pushError({\n        message: 'Unhandled promise rejection',\n        stack: reason?.stack || String(reason),\n        early: true\n      });\n    });\n\n    window.addEventListener('securitypolicyviolation', (event) => {\n      pushError({\n        message: 'CSP violation',\n        blockedURI: event?.blockedURI,\n        violatedDirective: event?.violatedDirective,\n        originalPolicy: event?.originalPolicy,\n        sourceFile: event?.sourceFile,\n        lineNumber: event?.lineNumber,\n        columnNumber: event?.columnNumber,\n        early: true\n      });\n    });\n\n    pushLog({ message: 'head-bootstrap', readyState: document.readyState });\n  })();\n</script>`
      );
      html = html.replace(/nonce="\\$undefined"/g, `nonce="${nonce}"`);
      html = html.replace(/\\"nonce\\":\\"\\$undefined\\"/g, `\\\"nonce\\\":\\\"${nonce}\\\"`);
      html = html.replace(/<script(?![^>]*\snonce=)/g, `<script nonce="${nonce}"`);
      html = html.replace(/(src|href)=["']\/(?!\/)/g, `$1="${baseUri}/`);
      html = html.replace(/url\(\//g, `url(${baseUri}/`);
      html = html.replace(new RegExp('\\\\\"/_next/', 'g'), `\\\"${baseUri}/_next/`);

      const bridge = `<script nonce="${nonce}">
  (function() {

    const vscode = acquireVsCodeApi();
    let pendingGraph = null;

    const reportLog = (payload) => {
      try { vscode.postMessage({ type: 'webview-log', ...payload }); } catch (e) {}
    };

    const reportError = (payload) => {
      try { vscode.postMessage({ type: 'webview-error', ...payload }); } catch (e) {}
    };

    window.__TWILIGHT_LOG__ = reportLog;
    window.__TWILIGHT_ERROR__ = reportError;

    const earlyErrors = Array.isArray(window.__TWILIGHT_EARLY_ERRORS__) ? window.__TWILIGHT_EARLY_ERRORS__ : [];
    if (earlyErrors.length) {
      earlyErrors.forEach((payload) => reportError({ ...payload, flushed: true }));
      window.__TWILIGHT_EARLY_ERRORS__ = [];
    }

    const earlyLogs = Array.isArray(window.__TWILIGHT_EARLY_LOGS__) ? window.__TWILIGHT_EARLY_LOGS__ : [];
    if (earlyLogs.length) {
      earlyLogs.forEach((payload) => reportLog({ ...payload, flushed: true }));
      window.__TWILIGHT_EARLY_LOGS__ = [];
    }

    reportLog({
      message: 'bridge-start',
      href: window.location.href,
      readyState: document.readyState
    });

    window.addEventListener('error', (event) => {
      reportError({
        message: event?.message || 'Webview error',
        filename: event?.filename,
        lineno: event?.lineno,
        colno: event?.colno,
        stack: event?.error?.stack || String(event?.error || event?.message || 'unknown')
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      const reason = event?.reason;
      reportError({
        message: 'Unhandled promise rejection',
        stack: reason?.stack || String(reason)
      });
    });

    window.addEventListener('securitypolicyviolation', (event) => {
      reportError({
        message: 'CSP violation',
        blockedURI: event?.blockedURI,
        violatedDirective: event?.violatedDirective,
        originalPolicy: event?.originalPolicy,
        sourceFile: event?.sourceFile,
        lineNumber: event?.lineNumber,
        columnNumber: event?.columnNumber
      });
    });

    const deliverGraph = (graph) => {
      if (typeof window.__TWILIGHT_APPLY_GRAPH__ === 'function') {
        try {
          window.__TWILIGHT_APPLY_GRAPH__(graph);
          return true;
        } catch (e) {
          reportError({ message: 'applyGraph failed', stack: String(e && e.stack ? e.stack : e) });
        }
      }
      if (window.eventBus && typeof window.eventBus.emit === 'function') {
        window.eventBus.emit('pasteGraphData', graph);
        try { window.eventBus.emit('forceRedraw'); } catch (e) {}
        return true;
      }
      window.__TWILIGHT_PENDING_GRAPH__ = graph;
      pendingGraph = graph;
      return false;
    };

    window.addEventListener('message', (event) => {
      const message = event.data;
      if (message?.type === 'graph') {
        reportLog({
          message: 'graph-received',
          nodes: Array.isArray(message.data?.nodes) ? message.data.nodes.length : null,
          edges: Array.isArray(message.data?.edges) ? message.data.edges.length : null,
          groups: Array.isArray(message.data?.groups) ? message.data.groups.length : null
        });
        deliverGraph(message.data);
      }
    });

    let busChecks = 0;
    const busInterval = setInterval(() => {
      busChecks += 1;
      const applyReady = typeof window.__TWILIGHT_APPLY_GRAPH__ === 'function';
      const busReady = Boolean(window.eventBus && typeof window.eventBus.emit === 'function');
      const hasRoot = Boolean(document.getElementById('graph-editor-background'));
      if (applyReady && pendingGraph) {
        try {
          window.__TWILIGHT_APPLY_GRAPH__(pendingGraph);
          pendingGraph = null;
        } catch (e) {}
      }
      if (applyReady || busReady || busChecks >= 25) {
        reportLog({ message: 'eventBus-check', applyReady, busReady, hasRoot, attempts: busChecks });
        clearInterval(busInterval);
      }
    }, 200);

    const flushInterval = setInterval(() => {
      if (pendingGraph && deliverGraph(pendingGraph)) {
        pendingGraph = null;
        clearInterval(flushInterval);
      }
    }, 200);

    window.addEventListener('load', () => {\n      reportLog({\n        message: 'window-load',\n        readyState: document.readyState,\n        scripts: document.querySelectorAll('script').length\n      });\n      try {\n        const baseUri = window.__TWILIGHT_BASE_URI__ || '';\n        const scripts = Array.from(document.scripts || []).map((el) => el.src).filter(Boolean);\n        const links = Array.from(document.querySelectorAll('link[href]') || []).map((el) => el.href).filter(Boolean);\n        const all = scripts.concat(links);\n        const unresolved = all.filter((url) => {\n          if (!url) return false;\n          if (url.startsWith('vscode-webview://')) return true;\n          if (!baseUri) return false;\n          return !(url.startsWith(baseUri) || url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('vscode-resource:'));\n        });\n        reportLog({\n          message: 'resource-summary',\n          location: window.location.href,\n          baseUri,\n          scripts: scripts.slice(0, 8),\n          links: links.slice(0, 8),\n          unresolved: unresolved.slice(0, 8)\n        });\n      } catch (e) {}\n      vscode.postMessage({ type: 'ready' });
    });
  })();
</script>`;

      html = html.replace(/<\/body>/i, `${bridge}\n</body>`);
      return html;
    } catch (err) {
      return `<!DOCTYPE html><html><body>Failed to load out/editor.html: ${String(err)}</body></html>`;
    }
  }
}

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      NodeGraphEditorProvider.viewType,
      new NodeGraphEditorProvider(context),
      { supportsMultipleEditorsPerDocument: false }
    )
  );
}

export function deactivate() {}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i += 1) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
