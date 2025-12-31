import * as vscode from 'vscode';

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
    const publicRoot = workspaceRoot ? vscode.Uri.joinPath(workspaceRoot, 'public') : null;

    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        this.context.extensionUri,
        ...(publicRoot ? [publicRoot] : []),
        ...(workspaceRoot ? [workspaceRoot] : [])
      ]
    };

    const publicRootUri = publicRoot
      ? webviewPanel.webview.asWebviewUri(publicRoot).toString()
      : '';

    const updateWebview = async () => {
      const fresh = await this.readGraphFile(document.uri);
      document.data = fresh;
      webviewPanel.webview.postMessage({ type: 'graph', data: fresh });
    };

    webviewPanel.webview.onDidReceiveMessage((message) => {
      if (message?.type === 'ready') {
        webviewPanel.webview.postMessage({ type: 'graph', data: document.data });
      }
    });

    const watcher = vscode.workspace.createFileSystemWatcher(document.uri.fsPath);
    watcher.onDidChange(() => updateWebview());
    watcher.onDidCreate(() => updateWebview());
    watcher.onDidDelete(() => updateWebview());
    webviewPanel.onDidDispose(() => watcher.dispose());

    webviewPanel.webview.html = this.getHtml(webviewPanel.webview, publicRootUri);
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

  private getHtml(webview: vscode.Webview, publicRootUri: string): string {
    const nonce = getNonce();
    return String.raw`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data: blob:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <title>Twilight Graph</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #0f1115;
      --panel: #171a21;
      --panel-border: #2a2f3a;
      --text: #e6e6e6;
      --muted: #9aa0a6;
      --node-shadow: rgba(0, 0, 0, 0.35);
    }

    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      overflow: hidden;
    }

    .app {
      display: grid;
      grid-template-columns: 1fr 300px;
      height: 100vh;
      width: 100vw;
    }

    .viewport {
      position: relative;
      overflow: hidden;
      background: radial-gradient(circle at 10% 10%, rgba(93, 134, 255, 0.12), transparent 45%),
                  radial-gradient(circle at 90% 20%, rgba(0, 209, 178, 0.12), transparent 40%),
                  #0f1115;
    }

    .canvas {
      position: absolute;
      left: 0;
      top: 0;
      transform-origin: 0 0;
    }

    .node {
      position: absolute;
      border-radius: 14px;
      padding: 10px 12px;
      box-sizing: border-box;
      color: #0b0b0b;
      box-shadow: 0 16px 32px -20px var(--node-shadow);
      border: 1px solid rgba(255, 255, 255, 0.15);
      overflow: hidden;
    }

    .node.markdown {
      color: #0b0b0b;
      background: #ffffff;
    }

    .node-title {
      font-weight: 700;
      margin-bottom: 6px;
    }

    .node-body {
      font-size: 12px;
      line-height: 1.4;
      color: #1d1d1d;
      max-height: 100%;
      overflow: hidden;
    }

    .sidebar {
      border-left: 1px solid var(--panel-border);
      background: var(--panel);
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      overflow: auto;
    }

    .sidebar h2 {
      margin: 0;
      font-size: 16px;
    }

    .sidebar .meta {
      color: var(--muted);
      font-size: 12px;
    }

    .sidebar .content {
      white-space: pre-wrap;
      font-size: 12px;
      line-height: 1.5;
    }

    svg.edges {
      position: absolute;
      left: 0;
      top: 0;
      overflow: visible;
    }

    .hint {
      font-size: 11px;
      color: var(--muted);
    }
  </style>
</head>
<body>
  <div class="app">
    <div class="viewport" id="viewport">
      <svg class="edges" id="edges"></svg>
      <div class="canvas" id="canvas"></div>
    </div>
    <aside class="sidebar">
      <h2 id="sidebar-title">No node selected</h2>
      <div class="meta" id="sidebar-meta">Select a node to see details.</div>
      <div class="content" id="sidebar-content"></div>
      <div class="hint">Pan: drag empty space · Zoom: mouse wheel</div>
    </aside>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const canvas = document.getElementById('canvas');
    const edgesSvg = document.getElementById('edges');
    const viewport = document.getElementById('viewport');
    const sidebarTitle = document.getElementById('sidebar-title');
    const sidebarMeta = document.getElementById('sidebar-meta');
    const sidebarContent = document.getElementById('sidebar-content');
    const publicRootUri = ${JSON.stringify(publicRootUri)};

    let graph = { nodes: [], edges: [], groups: [], viewport: { pan: { x: 0, y: 0 }, zoom: 1 } };
    let pan = { x: 0, y: 0 };
    let zoom = 1;
    let isPanning = false;
    let panStart = { x: 0, y: 0 };
    let panOrigin = { x: 0, y: 0 };

    const markdownToHtml = (input) => {
      if (!input) return '';
      let html = input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      html = html.replace(/^### (.*)$/gm, '<h3>$1</h3>');
      html = html.replace(/^## (.*)$/gm, '<h2>$1</h2>');
      html = html.replace(/^# (.*)$/gm, '<h1>$1</h1>');
      html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
      html = html.replace(new RegExp('\\u0060(.+?)\\u0060', 'g'), '<code>$1</code>');
      html = html.replace(/^\s*[-*] (.*)$/gm, '<li>$1</li>');
      html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
      html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
      html = html.replace(/!\[(.*?)\]\((.+?)\)/g, '<img alt="$1" src="$2" />');
      html = html.replace(/\n{2,}/g, '</p><p>');
      html = '<p>' + html + '</p>';
      return html;
    };

    const resolveImageSrc = (src) => {
      if (!src) return src;
      if (!publicRootUri) return src;
      if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) return src;
      if (src.startsWith('/data/')) {
        return publicRootUri + src;
      }
      if (src.startsWith('data/')) {
        return publicRootUri + '/' + src;
      }
      return src;
    };

    const render = () => {
      canvas.innerHTML = '';
      edgesSvg.innerHTML = '';

      const nodes = graph.nodes || [];
      const edges = graph.edges || [];

      nodes.forEach((node) => {
        const el = document.createElement('div');
        el.className = 'node' + (node.type === 'markdown' ? ' markdown' : '');
        const left = node.position?.x ?? node.x ?? 0;
        const top = node.position?.y ?? node.y ?? 0;
        const width = node.width || 200;
        const height = node.height || 120;
        el.style.left = left + 'px';
        el.style.top = top + 'px';
        el.style.width = width + 'px';
        el.style.height = height + 'px';

        if (node.color) {
          el.style.background = node.color;
        } else if (node.type !== 'markdown') {
          el.style.background = 'linear-gradient(135deg, #a6c0fe 0%, #f68084 100%)';
        }

        const title = document.createElement('div');
        title.className = 'node-title';
        title.textContent = node.label || node.id;
        const body = document.createElement('div');
        body.className = 'node-body';
        const markdown = node.data?.markdown || node.data?.memo || '';
        body.innerHTML = markdownToHtml(markdown);
        body.querySelectorAll('img').forEach((img) => {
          img.src = resolveImageSrc(img.getAttribute('src'));
          img.style.maxWidth = '100%';
          img.style.borderRadius = '8px';
          img.style.marginTop = '6px';
        });

        el.appendChild(title);
        el.appendChild(body);

        el.addEventListener('click', (event) => {
          event.stopPropagation();
          sidebarTitle.textContent = node.label || node.id;
          sidebarMeta.textContent = (node.type || 'default') + ' · ' + node.id;
          sidebarContent.innerHTML = markdownToHtml(markdown);
        });

        canvas.appendChild(el);
      });

      const bounds = canvas.getBoundingClientRect();
      edgesSvg.setAttribute('width', bounds.width);
      edgesSvg.setAttribute('height', bounds.height);

      const nodeById = new Map(nodes.map((n) => [n.id, n]));
      edges.forEach((edge) => {
        const source = nodeById.get(edge.source);
        const target = nodeById.get(edge.target);
        if (!source || !target) return;
        const sx = (source.position?.x ?? 0) + (source.width || 200) / 2;
        const sy = (source.position?.y ?? 0) + (source.height || 120) / 2;
        const tx = (target.position?.x ?? 0) + (target.width || 200) / 2;
        const ty = (target.position?.y ?? 0) + (target.height || 120) / 2;

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', sx);
        line.setAttribute('y1', sy);
        line.setAttribute('x2', tx);
        line.setAttribute('y2', ty);
        line.setAttribute('stroke', '#8b93a7');
        line.setAttribute('stroke-width', '2');
        line.setAttribute('stroke-linecap', 'round');
        edgesSvg.appendChild(line);
      });

      applyTransform();
    };

    const applyTransform = () => {
      canvas.style.transform = 'translate(' + pan.x + 'px, ' + pan.y + 'px) scale(' + zoom + ')';
      edgesSvg.style.transform = canvas.style.transform;
    };

    viewport.addEventListener('mousedown', (event) => {
      if (event.button !== 0) return;
      isPanning = true;
      panStart = { x: event.clientX, y: event.clientY };
      panOrigin = { ...pan };
    });

    window.addEventListener('mouseup', () => { isPanning = false; });
    window.addEventListener('mousemove', (event) => {
      if (!isPanning) return;
      const dx = event.clientX - panStart.x;
      const dy = event.clientY - panStart.y;
      pan = { x: panOrigin.x + dx, y: panOrigin.y + dy };
      applyTransform();
    });

    viewport.addEventListener('wheel', (event) => {
      event.preventDefault();
      const delta = Math.sign(event.deltaY) * -0.1;
      const next = Math.min(2, Math.max(0.2, zoom + delta));
      zoom = next;
      applyTransform();
    }, { passive: false });

    window.addEventListener('message', (event) => {
      const message = event.data;
      if (message?.type === 'graph') {
        graph = message.data || { nodes: [], edges: [] };
        const viewportData = graph.viewport || {};
        pan = viewportData.pan || { x: 0, y: 0 };
        zoom = typeof viewportData.zoom === 'number' ? viewportData.zoom : 1;
        render();
      }
    });

    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
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
