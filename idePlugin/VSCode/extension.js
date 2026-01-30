const vscode = require('vscode');

let activePanelId = null;
const panelState = new WeakMap();
const panelStates = new Set();

class TwiliteNodeEditorProvider {
  static viewType = 'twilite.nodeEditor';

  constructor(context) {
    this.context = context;
  }

  resolveCustomTextEditor(document, webviewPanel) {
    console.log(`[TwilitePreviewHost] resolveCustomTextEditor file=${document.uri?.toString?.()}`);
    const panelId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const priorState = panelState.get(webviewPanel);
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
      disposables: []
    };
    panelState.set(webviewPanel, state);
    panelStates.add(state);
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        this.context.extensionUri,
        vscode.Uri.joinPath(this.context.extensionUri, 'media')
      ]
    };

    webviewPanel.webview.html = this.getHtml(webviewPanel.webview, document.getText());
    webviewPanel.title = document.uri?.path?.split('/').pop() || '.node editor';

    const updateWebview = () => {
      const currentDoc = state.document;
      if (!currentDoc) return;
      const text = currentDoc.getText();
      const uri = currentDoc.uri?.toString?.();
      console.log(`[TwilitePreviewHost] post setText file=${uri} length=${text.length}`);
      webviewPanel.webview.postMessage({ type: 'setText', text, uri });
    };

    const changeSubscription = vscode.workspace.onDidChangeTextDocument((event) => {
      const currentDoc = state.document;
      if (!currentDoc) return;
      if (event.document.uri.toString() !== currentDoc.uri.toString()) return;
      updateWebview();
    });

    const disposeSubscription = webviewPanel.onDidDispose(() => {
      changeSubscription.dispose();
      if (activePanelId === panelId) {
        activePanelId = null;
      }
      panelState.delete(webviewPanel);
      panelStates.delete(state);
    });

    const setPreviewEnabled = (enabled) => {
      webviewPanel.webview.postMessage({ type: 'previewEnabled', enabled });
    };

    const setActivePanel = (nextId) => {
      activePanelId = nextId;
      panelStates.forEach((entry) => {
        const isActive = entry.panelId === nextId;
        try {
          entry.webviewPanel.webview.postMessage({ type: 'previewEnabled', enabled: isActive });
          if (isActive) {
            const text = entry.document?.getText?.() || '';
            const uri = entry.document?.uri?.toString?.() || null;
            entry.webviewPanel.webview.postMessage({ type: 'setText', text, uri });
          }
        } catch {}
      });
    };

    if (!activePanelId) {
      setActivePanel(panelId);
    } else {
      setPreviewEnabled(activePanelId === panelId);
    }

    const viewStateSubscription = webviewPanel.onDidChangeViewState((event) => {
      if (event.webviewPanel.active) {
        setActivePanel(panelId);
      } else {
        setPreviewEnabled(false);
      }
    });

    if (webviewPanel.active) {
      setActivePanel(panelId);
    }

    // New panels become the active preview immediately (deterministic "last opened wins").
    setActivePanel(panelId);

    const messageSubscription = webviewPanel.webview.onDidReceiveMessage((message) => {
      if (!message) return;
      if (message.type === 'webviewReady') {
        updateWebview();
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
        return;
      }
    });

    state.disposables = [changeSubscription, disposeSubscription, viewStateSubscription, messageSubscription];
  }

  getHtml(webview, text) {
    const logoUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'logo_dark.svg'));
    const nonce = String(Date.now());
    const escaped = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; frame-src http://localhost:3000 http://127.0.0.1:3000;">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Twilite Node</title>
  <style>
    body {
      margin: 0;
      font-family: var(--vscode-font-family, system-ui, sans-serif);
      background: var(--vscode-editor-background, #0b0f1a);
      color: var(--vscode-editor-foreground, #e2e8f0);
    }
    header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      background: var(--vscode-sideBar-background, #0f172a);
      border-bottom: 1px solid var(--vscode-editorGroup-border, #1f2937);
    }
    header img { width: 18px; height: 18px; }
    header h1 { font-size: 13px; margin: 0; font-weight: 600; flex: 1; }
    .mode-toggle { display: flex; gap: 6px; }
    .mode-toggle button {
      border: 1px solid var(--vscode-button-border, #334155);
      background: var(--vscode-button-secondaryBackground, #111827);
      color: var(--vscode-button-secondaryForeground, #cbd5f5);
      font-size: 11px;
      padding: 6px 10px;
      border-radius: 6px;
      cursor: pointer;
    }
    .mode-toggle button.primary {
      background: var(--vscode-button-background, #2563eb);
      border-color: var(--vscode-button-background, #2563eb);
      color: var(--vscode-button-foreground, #fff);
    }
    .container { height: 100vh; }
    .preview {
      position: relative;
      overflow: hidden;
      background: var(--vscode-editor-background, #0b0f1a);
      height: 100%;
    }
    .preview iframe { width: 100%; height: 100%; border: none; background: var(--vscode-editor-background, #0b0f1a); }
    .preview-disabled {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: color-mix(in srgb, var(--vscode-editor-background, #0b0f1a) 90%, transparent);
      color: var(--vscode-descriptionForeground, #94a3b8);
      font-size: 13px;
      text-align: center;
      padding: 16px;
    }
    .error {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--vscode-errorForeground, #f87171);
      font-size: 13px;
      padding: 16px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container" id="layout">
    <div class="preview">
      <iframe id="graphFrame" src="http://localhost:3000/editor?embed=1&draft=1&host=vscode"></iframe>
      <div class="error" id="errorBox" style="display:none;"></div>
      <div class="preview-disabled" id="previewDisabled" style="display:none;">Preview disabled in this editor window.<br/>Activate this tab to render.</div>
    </div>
  </div>
    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
    const graphFrame = document.getElementById('graphFrame');
    const errorBox = document.getElementById('errorBox');
    const previewDisabled = document.getElementById('previewDisabled');
    let pendingGraph = null;
    let previewEnabled = true;
    let lastRenderedText = '';
    let needsResend = false;
    let loadSeq = 0;
    let pendingAck = null;
    let ackTimer = null;
    // Start suspended until we receive the document text from the extension host.
    let suspendAutoLoad = true;
    let hasSeenText = false;
    let hasSentInitialGraph = false;
    let currentUri = null;
    let frameReady = false;

    const applyViewMode = () => {
      vscode.setState({ viewMode: 'preview' });
    };

    const clearAckTimer = () => {
      if (ackTimer) {
        clearTimeout(ackTimer);
        ackTimer = null;
      }
    };

    const postLoadGraph = (content, options = {}) => {
      if (!graphFrame.contentWindow) return;
      const seq = ++loadSeq;
      pendingAck = seq;
      graphFrame.contentWindow.postMessage(
        { type: 'loadGraph', content, force: Boolean(options.force), seq },
        '*'
      );
      clearAckTimer();
      ackTimer = setTimeout(() => {
        if (pendingAck !== seq) return;
        if (!previewEnabled || suspendAutoLoad || !pendingGraph || !graphFrame.contentWindow) return;
        // Resend the same content with a new seq if the iframe never acknowledged.
        postLoadGraph(pendingGraph, { force: true });
      }, 800);
    };

    const renderGraph = (raw, options = {}) => {
      if (!previewEnabled) {
        needsResend = true;
        return;
      }
      if (suspendAutoLoad && !options.force) {
        needsResend = true;
        return;
      }
      if (raw === lastRenderedText && !needsResend) {
        return;
      }
      if (!raw || !raw.trim()) {
        errorBox.style.display = 'none';
        pendingGraph = { nodes: [], edges: [], clusters: [] };
        if (!frameReady) {
          lastRenderedText = raw;
          needsResend = true;
          return;
        }
        postLoadGraph(pendingGraph, options);
        hasSentInitialGraph = true;
        needsResend = false;
        lastRenderedText = raw;
        return;
      }
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        errorBox.textContent = err.message || 'Invalid JSON';
        errorBox.style.display = 'flex';
        return;
      }
      errorBox.style.display = 'none';
      pendingGraph = parsed;
      if (!frameReady) {
        lastRenderedText = raw;
        needsResend = true;
        return;
      }
      postLoadGraph(parsed, options);
      hasSentInitialGraph = true;
      needsResend = false;
      lastRenderedText = raw;
    };

    graphFrame.addEventListener('load', () => {
      frameReady = true;
      console.log('[TwilitePreview] frame load', {
        suspendAutoLoad,
        previewEnabled,
        hasPending: Boolean(pendingGraph),
        hasSeenText,
        hasSentInitialGraph
      });
      if (!suspendAutoLoad && previewEnabled && pendingGraph && graphFrame.contentWindow) {
        postLoadGraph(pendingGraph, { force: true });
        hasSentInitialGraph = true;
        needsResend = false;
      }
    });

    vscode.postMessage({ type: 'webviewReady' });

    window.addEventListener('message', (event) => {
      const message = event.data;
      if (!message || message.type !== 'setText') return;
      const nextUri = message.uri || null;
      if (nextUri && currentUri && nextUri !== currentUri) {
        // New file selected: reset render state so we don't reuse old graph.
        lastRenderedText = '';
        pendingGraph = null;
        hasSentInitialGraph = false;
        needsResend = true;
      }
      currentUri = nextUri || currentUri;
      console.log('[TwilitePreview] setText received', { length: (message.text || '').length, uri: currentUri });
      hasSeenText = true;
      suspendAutoLoad = false;
      hasSentInitialGraph = false;
      needsResend = true;
      renderGraph(message.text, { force: true });
    });

    // rendererReady messages are noisy; loadGraph is driven by setText instead.

    window.addEventListener('message', (event) => {
      const message = event.data;
      if (!message || message.type !== 'graphDirty') return;
      console.log('[TwilitePreview] graphDirty received', { suspendAutoLoad, hasSeenText });
      suspendAutoLoad = true;
      hasSentInitialGraph = true;
    });

    window.addEventListener('message', (event) => {
      const message = event.data;
      if (!message || message.type !== 'graphLoaded') return;
      if (typeof message.seq === 'number' && pendingAck === message.seq) {
        pendingAck = null;
        clearAckTimer();
      }
    });

    window.addEventListener('message', (event) => {
      const message = event.data;
      if (!message || message.type !== 'graphUpdated') return;
      if (typeof message.text !== 'string') return;
      if (message.text === lastRenderedText) return;
      lastRenderedText = message.text;
      vscode.postMessage({ type: 'update', text: message.text });
    });

    window.addEventListener('message', (event) => {
      const message = event.data;
      if (!message || message.type !== 'previewEnabled') return;
      previewEnabled = Boolean(message.enabled);
      previewDisabled.style.display = previewEnabled ? 'none' : 'flex';
      if (previewEnabled && lastRenderedText) {
        renderGraph(lastRenderedText, { force: true });
      }
    });

    const savedState = vscode.getState();
    if (!savedState || savedState.viewMode !== 'preview') {
      applyViewMode();
    }
  </script>
</body>
</html>`;
  }
}

function activate(context) {
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      TwiliteNodeEditorProvider.viewType,
      new TwiliteNodeEditorProvider(context),
      { supportsMultipleEditorsPerDocument: false }
    )
  );

  // Active text editor changes are handled by VSCode calling resolveCustomTextEditor
  // for each .node file; we only sync the document bound to each webview panel.
}

function deactivate() {}

module.exports = { activate, deactivate };
    const escapeHtml = (value) => value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const highlightJson = (value) => {
      const escaped = escapeHtml(value || '');
      return escaped.replace(/"(?:\\.|[^"\\])*"\s*:|"(?:\\.|[^"\\])*"|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g, (match) => {
        if (match.endsWith(':')) {
          return '<span class="json-token-key">' + match.slice(0, -1) + '</span>:';
        }
        if (match === 'true' || match === 'false') {
          return '<span class="json-token-boolean">' + match + '</span>';
        }
        if (match === 'null') {
          return '<span class="json-token-null">' + match + '</span>';
        }
        if (match.startsWith('"')) {
          return '<span class="json-token-string">' + match + '</span>';
        }
        return '<span class="json-token-number">' + match + '</span>';
      });
    };

    const updateHighlight = () => {
      jsonHighlight.innerHTML = highlightJson(editor.value);
    };
