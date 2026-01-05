const vscode = require('vscode');
const path = require('path');

function activate(context) {
    console.log('Twilight Graph Viewer activated');
    
    // Create status bar item
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.text = "Twilite";
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
    
    const autoOpeningUris = new Set();
    const openGraphEditor = async (uri) => {
        if (!uri) return;
        const key = uri.toString();
        if (autoOpeningUris.has(key)) {
            return;
        }
        console.log('TwilightGraph: opening graph for', key);
        autoOpeningUris.add(key);
        try {
            await vscode.commands.executeCommand(
                'vscode.openWith',
                uri,
                'twilight.graphEditor',
                { viewColumn: vscode.ViewColumn.Active, preview: false }
            );
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open graph: ${error.message}`);
        } finally {
            autoOpeningUris.delete(key);
        }
    };

    const openGraphCommand = vscode.commands.registerCommand('twilight.openGraph', async (resource) => {
        const targetUri = resource || vscode.window.activeTextEditor?.document.uri;
        if (!targetUri) {
            vscode.window.showInformationMessage('Select a graph file in the Explorer first.');
            return;
        }
        await openGraphEditor(targetUri);
    });
    context.subscriptions.push(openGraphCommand);

    const documentListener = vscode.workspace.onDidOpenTextDocument(async (document) => {
        if (document.uri.scheme !== 'file' || path.extname(document.uri.fsPath) !== '.node') {
            return;
        }
        await openGraphEditor(document.uri, { closePreview: false });
    });
    context.subscriptions.push(documentListener);
    
    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(
            'twilight.graphEditor',
            new TwilightGraphEditorProvider(context),
            {
                webviewOptions: { retainContextWhenHidden: true },
                supportsMultipleEditorsPerDocument: false
            }
        )
    );
}

class TwilightGraphEditorProvider {
    constructor(context) { 
        this.context = context; 
    }
    
    async resolveCustomTextEditor(document, webviewPanel) {
        webviewPanel.webview.options = { 
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(this.context.extensionPath, '..', '..')),
            ]
        };
        
        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);
        
        let latestGraphText;
        let webviewReady = false;

        const sendGraphIfReady = () => {
            if (!webviewReady || typeof latestGraphText === 'undefined') {
                return;
            }
            this.updateWebview(webviewPanel.webview, latestGraphText);
        };

        const refreshGraph = () => {
            console.log('TwilightGraph: refreshing graph for', document.uri.toString());
            latestGraphText = document.getText();
            sendGraphIfReady();
        };

        // Send initial graph data (will wait until the webview signals readiness)
        refreshGraph();
        
        // Watch for file changes
        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString()) {
                refreshGraph();
            }
        });
        const viewStateSubscription = webviewPanel.onDidChangeViewState(() => {
            if (webviewPanel.visible) {
                refreshGraph();
            }
        });
        
        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
            viewStateSubscription.dispose();
        });
        
        // Handle messages from webview
        webviewPanel.webview.onDidReceiveMessage(message => {
            if (message.type === 'ready') {
                webviewReady = true;
                sendGraphIfReady();
                return;
            }
            switch (message.type) {
                case 'save':
                    this.saveDocument(document, message.content);
                    break;
                case 'openFile':
                    if (message.filePath) {
                        this.openFile(message.filePath);
                    }
                    break;
            }
        });
    }
    
    updateWebview(webview, graphText) {
        try {
            console.log('TwilightGraph: posting update to webview', graphText?.slice?.(0, 60));
            const graphData = JSON.parse(graphText);
            webview.postMessage({
                type: 'update',
                content: graphData
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to parse graph: ${error.message}`);
        }
    }
    
    async saveDocument(document, content) {
        const edit = new vscode.WorkspaceEdit();
        edit.replace(
            document.uri,
            new vscode.Range(0, 0, document.lineCount, 0),
            JSON.stringify(content, null, 2)
        );
        await vscode.workspace.applyEdit(edit);
    }
    
    async openFile(filePath) {
        try {
            const uri = vscode.Uri.file(filePath);
            await vscode.window.showTextDocument(uri);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open file: ${error.message}`);
        }
    }
    
        getHtmlForWebview(webview) {
            const appUrl = 'https://twilite.zone/browser/editor.html';
            
            return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Twilight Graph</title>
            <style>
                body, html {
                    margin: 0;
                    padding: 0;
                    width: 100%;
                    height: 100%;
                    overflow: hidden;
                }
                iframe {
                    width: 100%;
                    height: 100%;
                    border: none;
                }
            </style>
        </head>
        <body>
            <iframe id="twilight-frame" src="${appUrl}"></iframe>
            
            <script>
                const vscode = acquireVsCodeApi();
                const iframe = document.getElementById('twilight-frame');
                
                // Listen for messages from extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    if (message.type === 'update') {
                        // Forward graph data to iframe
                        iframe.contentWindow.postMessage({
                            type: 'loadGraph',
                            content: message.content
                        }, '*');
                    }
                });
                
                // Listen for messages from iframe
                window.addEventListener('message', event => {
                    if (event.source === iframe.contentWindow) {
                        const message = event.data;
                        if (message.type === 'save') {
                            vscode.postMessage({
                                type: 'save',
                                content: message.content
                            });
                        }
                    }
                });
                vscode.postMessage({ type: 'ready' });
            </script>
        </body>
        </html>`;
        }
}

module.exports = { activate, deactivate: () => {} };
