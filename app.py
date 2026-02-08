import json
import os
import re

from flask import Flask, render_template, request, jsonify
from openai import OpenAI
from calculations import calculate_retirement_plan
from models import validate_inputs, RetirementInputs

app = Flask(__name__)

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

if load_dotenv:
    load_dotenv()

OPENAI_MODEL = os.environ.get('OPENAI_MODEL', 'gpt-5.2')


def normalize_chat_response(text):
    """Clean markdown-heavy output so chat stays readable in the UI."""
    if not text:
        return ''

    cleaned_lines = []
    blank_streak = 0

    for raw_line in text.splitlines():
        line = raw_line.strip()

        # Drop markdown fences and horizontal rules.
        if line.startswith('```') or re.match(r'^(-{3,}|_{3,}|\*{3,})$', line):
            continue

        # Strip heading markers like "####" that read poorly in chat bubbles.
        line = re.sub(r'^#{1,6}\s*', '', line)
        line = line.replace('• ', '- ')

        if not line:
            if blank_streak == 0 and cleaned_lines:
                cleaned_lines.append('')
            blank_streak += 1
            continue

        blank_streak = 0
        cleaned_lines.append(line)

    return '\n'.join(cleaned_lines).strip()

def get_openai_client():
    """Create an OpenAI client if the API key is configured."""
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        raise RuntimeError(
            'OpenAI API key is not configured. Set the OPENAI_API_KEY environment variable.'
        )
    return OpenAI(api_key=api_key)

@app.route('/')
def index():
    """Welcome page"""
    return render_template('welcome.html')

@app.route('/onboarding')
def onboarding():
    """Onboarding flow"""
    return render_template('onboarding.html')

@app.route('/dashboard')
def dashboard():
    """Render the dashboard"""
    return render_template('dashboard.html')

@app.route('/api/calculate', methods=['POST'])
def calculate():
    """API endpoint to calculate retirement plan"""
    try:
        data = request.json
        
        # Validate inputs
        errors = validate_inputs(data)
        if errors:
            error_message = '; '.join(errors) if isinstance(errors, list) else str(errors)
            return jsonify({'error': error_message}), 400
        
        # Create input model
        inputs = RetirementInputs.from_dict(data)
        
        # Calculate retirement plan
        result = calculate_retirement_plan(inputs)
        
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/chat', methods=['POST'])
def chat():
    """Use OpenAI to answer plan-related questions."""
    data = request.json or {}
    message = (data.get('message') or '').strip()
    plan_data = data.get('plan_data') or {}
    
    if not message:
        return jsonify({'error': 'A message is required.'}), 400
    
    try:
        client = get_openai_client()
        system_prompt = (
            "You are a retirement planning assistant for a non-technical user. "
            "Use the provided plan data for every answer when possible. "
            "Default response length: 2-4 short sentences, under 100 words, unless the user asks for more detail. "
            "Use plain language and a calm tone. "
            "No markdown headings, no hash symbols, no tables, and no code blocks. "
            "If formatting helps, use at most 3 simple bullets starting with '- '. "
            "If a recalculation is requested, provide the key final numbers with a short explanation of trade-offs."
        )
        plan_context = json.dumps(plan_data, default=str) if plan_data else "No plan data supplied."
        user_prompt = (
            f"User question: {message}\n\n"
            f"Current retirement plan data (JSON): {plan_context}\n\n"
            "Answer directly. Mention trade-offs briefly and reference exact figures when available."
        )
        
        completion = client.chat.completions.create(
            model=OPENAI_MODEL,
            temperature=0.2,
            messages=[
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': user_prompt}
            ],
        )
        
        answer = normalize_chat_response(completion.choices[0].message.content.strip())
        return jsonify({'response': answer})
    except RuntimeError as err:
        return jsonify({'error': str(err)}), 500
    except Exception as exc:
        app.logger.exception('Chat request failed')
        if app.debug or os.environ.get('FLASK_ENV') == 'development':
            return jsonify({'error': 'Unable to complete chat request.', 'details': str(exc)}), 500
        return jsonify({'error': 'Unable to complete chat request.'}), 500

@app.route('/api/chat/health', methods=['GET'])
def chat_health():
    """Lightweight health check for OpenAI connectivity."""
    try:
        client = get_openai_client()
        client.models.list()
        return jsonify({'ok': True, 'model': OPENAI_MODEL})
    except Exception as exc:
        app.logger.exception('Chat health check failed')
        if app.debug or os.environ.get('FLASK_ENV') == 'development':
            return jsonify({'ok': False, 'error': str(exc)}), 500
        return jsonify({'ok': False, 'error': 'Chat health check failed.'}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5001)
