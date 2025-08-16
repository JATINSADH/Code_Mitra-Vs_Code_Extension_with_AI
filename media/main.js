// media/main.js
(function () {
    const vscode = acquireVsCodeApi();

    const askButton = document.getElementById('ask-button');
    const qaInput = document.getElementById('qa-input');
    const explanationContent = document.getElementById('explanation-content');
    const errorsContent = document.getElementById('errors-content');
    const tasksContent = document.getElementById('tasks-content');
    const statusBar = document.getElementById('status-bar');

    askButton.addEventListener('click', () => {
        const question = qaInput.value;
        if (question) {
            vscode.postMessage({ command: 'askQuestion', question: question });
        }
    });

    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
            case 'showLoading':
                statusBar.textContent = 'Status: Analyzing...';
                explanationContent.innerHTML = '<em>Analyzing...</em>';
                errorsContent.innerHTML = '<em>Analyzing...</em>';
                tasksContent.innerHTML = '<em>Analyzing...</em>';
                break;
            case 'showThinking':
                askButton.disabled = true;
                askButton.textContent = 'Thinking...';
                break;
            case 'showAnalysis':
                statusBar.textContent = 'Status: Analysis Complete.';
                const { explanation, error_solution, tasks } = message.data;
                explanationContent.textContent = explanation || '';
                errorsContent.innerHTML = `<div class="solution-box">${error_solution.replace(/\n/g, '<br>')}</div>` || '';
                tasksContent.textContent = tasks || '';
                break;
            case 'showAnswer':
                askButton.disabled = false;
                askButton.textContent = 'Ask AI';
                
                const answerContainer = document.createElement('div');
                answerContainer.className = 'qna-block';
                answerContainer.innerHTML = `
                    <hr>
                    <h3>Q: ${message.question}</h3>
                    <p>${message.answer.replace(/\n/g, '<br>')}</p>
                `;
                explanationContent.appendChild(answerContainer);
                qaInput.value = '';
                break;
        }
    });
}());
