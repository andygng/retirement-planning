from flask import Flask, render_template, request, jsonify
from calculations import calculate_retirement_plan
from models import validate_inputs, RetirementInputs

app = Flask(__name__)

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

if __name__ == '__main__':
    app.run(debug=True, port=5001)

