# Code-Mitra VS Code Extension (with Python Backend)


# 1. **Architectural Overview**
This version of the project follows a client-server architecture. This is a robust and scalable design where tasks are separated based on their function. Think of it like a restaurant: the frontend is the waiter who takes your order, and the backend is the kitchen that prepares the food.

### The Client (VS Code Extension - TypeScript):
This is the "waiter". It's the frontend that runs directly inside the user's editor. 

Its main responsibilities are:
Providing the User Interface (UI) in the sidebar.
Detecting user actions, like saving a file or clicking a button.
Sending the file content (the "order") to the backend server for processing.
Receiving the final results (the "food") from the server and displaying them beautifully to the user.
The Server (Backend - Python with Flask): This is the "kitchen". It's the backend brain of the application that runs as a separate, local web server. Its main responsibilities are:
Handling all logic-intensive tasks to keep the extension fast and responsive.
Running pylint for code analysis.
Communicating with the external Google Gemini API to get AI insights.
Sending the final, processed results back to the VS Code extension.

**Why this architecture?**
This separation is excellent because it lets each part do what it's best at. TypeScript is fantastic for building user interfaces and integrating with VS Code, while Python, with its rich libraries for data science and AI, is perfect for handling the heavy data processing and API communication.


# 2. **Features in Detail**
AI-Powered Code Explanation: When a Python file is saved, the extension sends the code to the AI, which returns a simple explanation of the logic, alternative methods, and potential optimizations.
Intelligent Error Solutions: The extension uses the pylint tool to find errors. It then sends both the code and the errors to the AI, which explains the errors and provides a corrected code snippet.

Interactive Q&A:
The user can ask a question about the currently open file. The extension sends the question along with the file's content as context to the AI to get a precise answer.

Markdown Task Planner:
If the user saves a Markdown file with a task description (e.g., "Create a calculator app"), the AI breaks it down into actionable steps.

Native UI:
The interface is built with the official @vscode/webview-ui-toolkit to ensure it looks and feels like a natural part of VS Code.


# 3. **File-wise Breakdown**
package.json (The Manifest)
Role: This is the manifest file that tells VS Code everything about the extension, including its name, activation events, and dependencies.

**Key Sections Explained:**
activationEvents: We use "onView:codeMitraView" to ensure the extension only activates when the user clicks its icon. This is a crucial performance optimization that prevents our extension from slowing down VS Code's startup time.

contributes: This section defines the extension's UI contributions, like the icon in the Activity Bar and the webview panel that hosts our UI.

dependencies: It lists necessary npm packages like axios (for making HTTP requests to our Python backend) and @vscode/webview-ui-toolkit (for the native UI components).

src/extension.ts (The Brain of the Extension)
Role: This is the main entry point and core logic file for the TypeScript extension. When the extension is activated, the activate function in this file is executed.


### **Key Functions & Logic Explained:**

activate(): This function is the starting point. Its most important jobs are:

Starting the Backend: It uses Node.js's built-in child_process module to run the python backend_server.py command. This starts our Flask server as a separate background process. It also listens to the server's output (stdout) and errors (stderr) to know its status.

Registering the UI: It registers the CodeMitraViewProvider, which is the class responsible for creating and managing our side panel.

Event Listener (onDidSaveTextDocument): This listener waits for the user to save a file. When a .py or .md file is saved, it reads the file's content and sends it to the Python backend's /analyze endpoint using an axios POST request.

CodeMitraViewProvider (Class): This class manages the webview panel. Its resolveWebviewView method sets up the HTML for the UI and handles messages sent from the UI (like an "Ask AI" click), forwarding them to the appropriate backend endpoint.

backend/backend_server.py (The Brain of the Operation)
Role: This is a lightweight web server built with Flask, a popular Python web framework. It exposes API endpoints (URLs) that our VS Code extension can call to get work done.


### **Key Functions (Endpoints) Explained:**

@app.route('/analyze', methods=['POST']): This is the main analysis endpoint.
It receives file content and file type in a JSON format from the extension.
It runs pylint on the code to find errors.
It then creates specific prompts (questions) and calls the query_gemini function to get AI explanations and error solutions.
Finally, it bundles all the results into a single JSON object and sends it back as the HTTP response to the extension.

@app.route('/ask', methods=['POST']): This endpoint handles the Q&A feature. It receives a question and code context, sends them to the Gemini API, and returns the answer.

query_gemini():
This is a helper function that contains the actual logic for making the requests.post call to the Google Gemini API. It handles the API key and the request format.


# 4. **Execution Flow (Step-by-Step)**
Here is how all the pieces work together when a user saves a file:

Activation: The user clicks the Code-Mitra icon in the VS Code Activity Bar.

Backend Start: The activate() function in extension.ts runs, which starts the backend_server.py in the background.

UI Creation: The CodeMitraViewProvider creates the webview panel.

User Action: The user saves a Python file (example.py).

Event Fired: The onDidSaveTextDocument event listener in extension.ts catches this action.

Client Request: extension.ts reads the content of example.py and sends it to the Python backend via an axios POST request to http://localhost:5001/analyze.

Server Processing: The Flask server running backend_server.py receives the request at the /analyze endpoint.

AI & Pylint: The server runs pylint on the code and also sends prompts to the Gemini API for explanation and solutions.

Server Response: The server collects all the results and sends them back to the extension as a single JSON response.

UI Update: extension.ts receives the JSON response and uses postMessage to send the data to the webview.

Final Display: The main.js script inside the webview catches the message and updates the HTML to display the explanation and error solutions to the user.



# **Improtant - API Key Configuration**

This project requires a Google Gemini API key to function.
Go to Google AI Studio.
Sign in with your Google account.
Click on the "Get API key" button.
Click "Create API key in new project" to generate a new key.
Copy the newly generated API key.
Open the backend/backend_server.py file in the project and paste your key into the following line:

API_KEY = "YOUR_GEMINI_API_KEY_HERE"

Save the file.

## **Important: Never share your API key or commit it to a public GitHub repository.**
