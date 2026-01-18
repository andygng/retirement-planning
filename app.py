import json
import os

from flask import Flask, render_template, request, jsonify
from openai import OpenAI
from calculations import calculate_retirement_plan
from models import validate_inputs, RetirementInputs

app = Flask(__name__)

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
            "You are a retirement planning assistant. "
            "Use the provided plan data to answer questions with actionable, concise guidance. "
            "If a recalculation is required, do the math required by varrying either the input suggested by the user or providing multiple different scenarios."
        )
        plan_context = json.dumps(plan_data, default=str) if plan_data else "No plan data supplied."
        user_prompt = (
            f"User question: {message}\n\n"
            f"Current retirement plan data (JSON): {plan_context}\n\n"
            "Highlight trade-offs, maintain a calm tone, and reference exact figures if available."
        )
        
        response = client.responses.create(
            model='gpt-5',
            temperature=0.2,
            input=[
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': user_prompt}
            ],
        )

        answer = (response.output_text or '').strip()
        if not answer:
            return jsonify({'error': 'No response content received from the assistant.'}), 502
        return jsonify({'response': answer})
    except RuntimeError as err:
        return jsonify({'error': str(err)}), 500
    except Exception as exc:
        return jsonify({'error': 'Unable to complete chat request.', 'details': str(exc)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5001)
