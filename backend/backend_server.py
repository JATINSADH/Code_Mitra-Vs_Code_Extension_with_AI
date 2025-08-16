# backend_server.py
# Final, robust Flask server for the Code-Mitra VS Code extension.

from flask import Flask, request, jsonify
import subprocess
import tempfile
import os
import requests
import logging

# --- Configuration ---
# IMPORTANT: Replace with your actual Gemini API key.
API_KEY = "AIzaSyCvmFH_sO6Ice5zHFA1C6YMdxS7rqjhSZg"
GEMINI_API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key={API_KEY}"

app = Flask(__name__)

# Suppress Flask's default logging to keep the console clean for our messages
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

def query_gemini(prompt):
    """Sends a query to the Gemini API and returns the response text."""
    headers = {'Content-Type': 'application/json'}
    data = {"contents": [{"parts": [{"text": prompt}]}]}
    try:
        response = requests.post(GEMINI_API_URL, headers=headers, json=data, timeout=60)
        response.raise_for_status()
        if 'candidates' in response.json() and response.json()['candidates']:
            return response.json()['candidates'][0]['content']['parts'][0]['text']
        else:
            # Handle cases where the API returns a valid response but no candidates (e.g., safety settings)
            return "AI model returned no content. This might be due to safety filters or an issue with the prompt."
    except requests.exceptions.RequestException as e:
        return f"API Request Error: {e}"
    except (KeyError, IndexError) as e:
        return f"Error parsing API response: {e}\n\nRaw Response:\n{response.text}"

@app.route('/analyze', methods=['POST'])
def analyze_code():
    """Analyzes code/markdown, gets explanations, and provides solutions for errors."""
    data = request.json
    file_content = data.get('file_content', '')
    file_type = data.get('file_type', 'python')

    explanation, error_solution, tasks = "", "", ""

    # Handle empty file content immediately
    if not file_content.strip():
        return jsonify({
            "explanation": "File is empty. Add some content and save to get an analysis.",
            "error_solution": "No content to analyze for errors.",
            "tasks": "File is empty. Add a task description and save."
        })

    if file_type == 'python':
        # --- Get AI explanation for the code ---
        explanation_prompt = f"Explain the following Python code in a clear and concise way. Describe its purpose, what each function does, and the overall logic.\n\n---\n\n{file_content}"
        explanation = query_gemini(explanation_prompt)

        # --- Get Pylint errors and AI solution ---
        with tempfile.NamedTemporaryFile(mode='w+', delete=False, suffix='.py', encoding='utf-8') as temp_file:
            temp_file.write(file_content)
            temp_file_path = temp_file.name
        
        try:
            pylint_result = subprocess.run(
                ['pylint', temp_file_path, '--exit-zero'], # --exit-zero ensures it doesn't exit with error code for findings
                capture_output=True, text=True, encoding='utf-8'
            )
            pylint_errors = pylint_result.stdout.strip()

            if "Your code has been rated at 10.00/10" in pylint_errors or not pylint_errors:
                error_solution = "Pylint found no errors. Your code looks clean!"
            else:
                # New Feature: Ask AI for a solution to the errors
                solution_prompt = (
                    f"The following Python code has generated these pylint errors:\n\n"
                    f"--- PYLINT ERRORS ---\n{pylint_errors}\n\n"
                    f"--- PYTHON CODE ---\n{file_content}\n\n"
                    f"Please perform two tasks:\n"
                    f"1. Explain what these errors mean in simple terms.\n"
                    f"2. Provide the corrected, complete code snippet that fixes these errors."
                )
                error_solution = query_gemini(solution_prompt)
        except FileNotFoundError:
            error_solution = "Pylint not found. Please ensure it is installed and in your system's PATH."
        finally:
            os.remove(temp_file_path)

    elif file_type == 'markdown':
        task_prompt = f"Read the following task described in Markdown. Break it down into actionable steps and suggest a high-level plan or pseudo-code to achieve it.\n\n---\n\n{file_content}"
        tasks = query_gemini(task_prompt)

    return jsonify({
        "explanation": explanation,
        "error_solution": error_solution,
        "tasks": tasks
    })

@app.route('/ask', methods=['POST'])
def ask_question():
    """Answers a user's question based on the provided context."""
    data = request.json
    question = data.get('question', '')
    context = data.get('context', '')

    if not context.strip():
        return jsonify({"answer": "Cannot answer question without context. The active file is empty."})

    prompt = f"Regarding the following code/text:\n\n---\n{context}\n---\n\nThe user has a question: '{question}'. Please provide a clear and helpful answer in Hinglish if possible."
    answer = query_gemini(prompt)
    
    return jsonify({"answer": answer})

if __name__ == '__main__':
    print("Starting Flask backend server on http://localhost:5001")
    app.run(port=5001, debug=False)
