import * as vscode from 'vscode';
import * as path from 'path';
import * as cp from 'child_process';
import axios from 'axios';
import { getNonce } from './getNonce';
import * as fs from 'fs';

// --- Configuration ---
// IMPORTANT: Replace with your actual Gemini API key.
const API_KEY: string = "AIzaSyCvmFH_sO6Ice5zHFA1C6YMdxS7rqjhSZg";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${API_KEY}`;

let webviewProvider: CodeMitraViewProvider | undefined;

export function activate(context: vscode.ExtensionContext) {
    webviewProvider = new CodeMitraViewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider("codeMitraView", webviewProvider)
    );

    vscode.workspace.onDidSaveTextDocument(async (document) => {
        if (!webviewProvider?.isViewVisible()) return;

        const langId = document.languageId;
        const fileType = (langId === 'python') ? 'python' : (langId === 'markdown') ? 'markdown' : null;
        if (!fileType) return;

        webviewProvider.analyzeDocument(document);
    });
}

async function queryGemini(prompt: string): Promise<string> {
    // FIXED: The check should only look for the placeholder, not your actual key.
    if (!API_KEY || API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
        return "Error: Gemini API key is not set in `extension.ts`. Please replace the placeholder.";
    }
    try {
        const response = await axios.post(GEMINI_API_URL, {
            contents: [{ parts: [{ text: prompt }] }]
        });
        return response.data.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error("Gemini API Error:", error);
        return `API Request Error: ${error instanceof Error ? error.message : 'An unknown error occurred'}`;
    }
}

class CodeMitraViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    constructor(private readonly _extensionUri: vscode.Uri) {}

    public isViewVisible = () => this._view?.visible || false;
    public postMessage = (message: any) => this._view?.webview.postMessage(message);

    public async analyzeDocument(document: vscode.TextDocument) {
        this.postMessage({ command: 'showLoading' });
        const fileContent = document.getText();
        const fileType = document.languageId === 'python' ? 'python' : 'markdown';

        if (!fileContent.trim()) {
            this.postMessage({ command: 'showAnalysis', data: {
                explanation: "File is empty. Add content and save.",
                error_solution: "No content to analyze.",
                tasks: "File is empty. Add a task description."
            }});
            return;
        }

        let explanation = "", error_solution = "", tasks = "";

        if (fileType === 'python') {
            const explanationPromise = queryGemini(`Explain this Python code concisely:\n\n${fileContent}`);
            
            const pylintErrors = await this.runPylint(document.uri.fsPath);
            if (!pylintErrors || pylintErrors.includes("Your code has been rated at 10.00/10")) {
                error_solution = "Pylint found no errors. Great job!";
            } else {
                const solutionPromise = queryGemini(`This Python code has pylint errors:\n\n${pylintErrors}\n\nCode:\n${fileContent}\n\nExplain the errors and provide the corrected code.`);
                error_solution = await solutionPromise;
            }
            explanation = await explanationPromise;

        } else if (fileType === 'markdown') {
            tasks = await queryGemini(`Break down this task from Markdown:\n\n${fileContent}`);
        }

        this.postMessage({ command: 'showAnalysis', data: { explanation, error_solution, tasks } });
    }

    private runPylint(filePath: string): Promise<string> {
        return new Promise((resolve) => {
            cp.exec(`pylint "${filePath}"`, (error, stdout, stderr) => {
                if (stderr) {
                    resolve(`Pylint Error: ${stderr}`);
                } else {
                    resolve(stdout);
                }
            });
        });
    }

    resolveWebviewView(webviewView: vscode.WebviewView) {
        this._view = webviewView;
        webviewView.webview.options = { enableScripts: true, localResourceRoots: [this._extensionUri] };
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        
        webviewView.webview.onDidReceiveMessage(async message => {
            if (message.command === 'askQuestion') {
                const editor = vscode.window.activeTextEditor;
                if (!editor) return vscode.window.showInformationMessage('No active file to ask about.');
                
                this.postMessage({ command: 'showThinking' });
                const answer = await queryGemini(`Context:\n${editor.document.getText()}\n\nQuestion: ${message.question}\n\nAnswer in Hinglish if possible:`);
                this.postMessage({ command: 'showAnswer', question: message.question, answer: answer });
            }
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const nonce = getNonce();
        const toolkitUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode', 'webview-ui-toolkit', 'dist', 'toolkit.js'));
        const mainJsUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));
        const mainCssUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css'));

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <script type="module" nonce="${nonce}" src="${toolkitUri}"></script>
            <link rel="stylesheet" href="${mainCssUri}">
            <title>Code-Mitra</title>
        </head>
        <body>
            <h1>Code-Mitra</h1>
            <div id="status-bar">Status: Ready</div>
            
            <vscode-tabs id="analysis-tabs">
                <vscode-tab>AI Explanation</vscode-tab>
                <vscode-tab>Errors & Solution</vscode-tab>
                <vscode-tab>Task Breakdown</vscode-tab>
                
                <vscode-panel-view><div id="explanation-content" class="content">Save a file to begin...</div></vscode-panel-view>
                <vscode-panel-view><div id="errors-content" class="content"></div></vscode-panel-view>
                <vscode-panel-view><div id="tasks-content" class="content"></div></vscode-panel-view>
            </vscode-tabs>
            
            <div id="qa-section">
                <h2>Ask a Question</h2>
                <vscode-text-area id="qa-input" placeholder="Ask about the currently open file..." rows="3"></vscode-text-area>
                <vscode-button id="ask-button">Ask AI</vscode-button>
            </div>
            <script nonce="${nonce}" src="${mainJsUri}"></script>
        </body>
        </html>`;
    }
}

export function deactivate() {}
