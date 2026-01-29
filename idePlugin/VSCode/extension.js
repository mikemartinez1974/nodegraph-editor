const vscode = require('vscode');

let activePanelId = null;

class TwiliteNodeEditorProvider {
  static viewType = 'twilite.nodeEditor';

  constructor(context) {
    this.context = context;
  }

  resolveCustomTextEditor(document, webviewPanel) {
    const panelId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        this.context.extensionUri,
        vscode.Uri.joinPath(this.context.extensionUri, 'media')
      ]
    };

    webviewPanel.webview.html = this.getHtml(webviewPanel.webview, document.getText());

    const updateWebview = () => {
      webviewPanel.webview.postMessage({ type: 'setText', text: document.getText() });
    };

    const changeSubscription = vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.toString() !== document.uri.toString()) return;
      updateWebview();
    });

    webviewPanel.onDidDispose(() => {
      changeSubscription.dispose();
      if (activePanelId === panelId) {
        activePanelId = null;
      }
    });

    const setPreviewEnabled = (enabled) => {
      webviewPanel.webview.postMessage({ type: 'previewEnabled', enabled });
    };

    if (!activePanelId) {
      activePanelId = panelId;
      setPreviewEnabled(true);
    } else {
      setPreviewEnabled(activePanelId === panelId);
    }

    webviewPanel.onDidChangeViewState((event) => {
      if (event.webviewPanel.active) {
        activePanelId = panelId;
        setPreviewEnabled(true);
      } else {
        setPreviewEnabled(false);
      }
    });

    webviewPanel.webview.onDidReceiveMessage((message) => {
      if (!message || message.type !== 'update') return;
      const edit = new vscode.WorkspaceEdit();
      const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(document.getText().length)
      );
      edit.replace(document.uri, fullRange, message.text);
      vscode.workspace.applyEdit(edit);
    });
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
    body { margin: 0; font-family: system-ui, sans-serif; background: #0b0f1a; color: #e2e8f0; }
    header { display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: #0f172a; border-bottom: 1px solid #1f2937; }
    header img { width: 18px; height: 18px; }
    header h1 { font-size: 13px; margin: 0; font-weight: 600; }
    .container { display: grid; grid-template-columns: minmax(320px, 2.5fr) 12px minmax(280px, 1fr); height: calc(100vh - 44px); }
    textarea { width: 100%; height: 100%; border: none; outline: none; padding: 12px; box-sizing: border-box; background: #0b0f1a; color: #e2e8f0; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; line-height: 1.5; }
    .preview { position: relative; overflow: hidden; background: #0b0f1a; }
    .resizer { background: #1f2937; cursor: col-resize; position: relative; }
    .resizer::after { content: ''; position: absolute; top: 0; bottom: 0; left: 4px; width: 4px; background: #334155; border-radius: 2px; opacity: 0.8; }
    .preview iframe { width: 100%; height: 100%; border: none; background: #0b0f1a; }
    .preview-disabled { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(15, 23, 42, 0.9); color: #94a3b8; font-size: 13px; text-align: center; padding: 16px; }
    .error { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #f87171; font-size: 13px; padding: 16px; text-align: center; }
  </style>
</head>
<body>
  <header>
    <img src="${logoUri}" alt="Twilite" />
    <h1>.node editor</h1>
  </header>
  <div class="container" id="layout">
    <div class="preview">
      <iframe id="graphFrame" src="http://localhost:3000/editor?embed=1"></iframe>
      <div class="error" id="errorBox" style="display:none;"></div>
      <div class="preview-disabled" id="previewDisabled" style="display:none;">Preview disabled in this editor window.<br/>Activate this tab to render.</div>
    </div>
    <div class="resizer" id="resizer"></div>
    <textarea id="editor" spellcheck="false">${escaped}</textarea>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const editor = document.getElementById('editor');
    const graphFrame = document.getElementById('graphFrame');
    const errorBox = document.getElementById('errorBox');
    const resizer = document.getElementById('resizer');
    const layout = document.getElementById('layout');
    const previewDisabled = document.getElementById('previewDisabled');
    let ignore = false;
    let pendingGraph = null;
    let previewEnabled = true;
    let lastRenderedText = '';

    const renderGraph = (raw) => {
      if (!previewEnabled) {
        return;
      }
      if (raw === lastRenderedText) {
        return;
      }
      if (!raw || !raw.trim()) {
        errorBox.style.display = 'none';
        pendingGraph = { nodes: [], edges: [], clusters: [] };
        if (graphFrame.contentWindow) {
          graphFrame.contentWindow.postMessage({ type: 'loadGraph', payload: pendingGraph }, '*');
        }
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
      if (graphFrame.contentWindow) {
        graphFrame.contentWindow.postMessage({ type: 'loadGraph', payload: parsed }, '*');
      }
      lastRenderedText = raw;
    };

    graphFrame.addEventListener('load', () => {
      if (previewEnabled && pendingGraph && graphFrame.contentWindow) {
        graphFrame.contentWindow.postMessage({ type: 'loadGraph', payload: pendingGraph }, '*');
      }
    });

    const startResize = (event) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidths = layout.style.gridTemplateColumns || '';
      const computed = getComputedStyle(layout).gridTemplateColumns.split(' ');
      const startPreviewWidth = parseFloat(computed[0]) || layout.clientWidth * 0.7;
      const startEditorWidth = parseFloat(computed[2]) || layout.clientWidth * 0.3;

      const onMove = (moveEvent) => {
        const delta = moveEvent.clientX - startX;
        const nextPreview = Math.max(320, startPreviewWidth + delta);
        const nextEditor = Math.max(280, startEditorWidth - delta);
        layout.style.gridTemplateColumns = nextPreview + 'px 12px ' + nextEditor + 'px';
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    };

    resizer.addEventListener('mousedown', startResize);

    editor.addEventListener('input', () => {
      if (ignore) return;
      vscode.postMessage({ type: 'update', text: editor.value });
    });

    editor.addEventListener('blur', () => {
      renderGraph(editor.value);
    });

    window.addEventListener('message', (event) => {
      const message = event.data;
      if (!message || message.type !== 'setText') return;
      if (editor.value === message.text) return;
      ignore = true;
      editor.value = message.text;
      ignore = false;
      renderGraph(message.text);
    });

    window.addEventListener('message', (event) => {
      const message = event.data;
      if (!message || message.type !== 'rendererReady') return;
      if (previewEnabled && pendingGraph && graphFrame.contentWindow) {
        graphFrame.contentWindow.postMessage({ type: 'loadGraph', payload: pendingGraph }, '*');
      }
    });

    window.addEventListener('message', (event) => {
      const message = event.data;
      if (!message || message.type !== 'previewEnabled') return;
      previewEnabled = Boolean(message.enabled);
      previewDisabled.style.display = previewEnabled ? 'none' : 'flex';
      if (previewEnabled) {
        renderGraph(editor.value);
      }
    });

    renderGraph(editor.value);
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
}

function deactivate() {}

module.exports = { activate, deactivate };
