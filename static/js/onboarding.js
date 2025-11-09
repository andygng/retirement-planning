// Onboarding flow state
let currentQuestionIndex = 0;
let answers = {};

// Question definitions
const questions = [
    // Goals & Ambitions
    {
        id: 'ideal_retirement_income',
        title: 'What is your ideal monthly retirement income?',
        description: 'This is the disposable income you\'d like to have each month during retirement (after taxes).',
        type: 'number',
        suffix: '$',
        placeholder: '5000',
        required: true
    },
    {
        id: 'ideal_retirement_age',
        title: 'At what age would you like to retire?',
        description: 'Enter your target retirement age.',
        type: 'number',
        placeholder: '65',
        min: 1,
        max: 100,
        required: true
    },
    {
        id: 'withdrawal_rate',
        title: 'What withdrawal rate would you like to use?',
        description: 'This is the percentage of your net worth you plan to withdraw annually. A common rate is 4%.',
        type: 'number',
        suffix: '%',
        placeholder: '4',
        min: 0.1,
        max: 10,
        step: 0.1,
        required: true
    },
    // Current Information
    {
        id: 'current_age',
        title: 'What is your current age?',
        description: 'Enter your current age.',
        type: 'number',
        placeholder: '35',
        min: 1,
        max: 100,
        required: true
    },
    {
        id: 'current_monthly_income',
        title: 'What is your current monthly income?',
        description: 'Enter your current monthly income (before taxes).',
        type: 'number',
        suffix: '$',
        placeholder: '8000',
        required: true
    },
    {
        id: 'current_asset_values',
        title: 'What is your current total asset value?',
        description: 'Enter the total value of all your current investments and savings.',
        type: 'number',
        suffix: '$',
        placeholder: '100000',
        required: true
    },
    {
        id: 'cagr',
        title: 'What annual growth rate do you expect?',
        description: 'Enter your expected Compound Annual Growth Rate (CAGR) as a percentage. A typical range is 5-8%.',
        type: 'number',
        suffix: '%',
        placeholder: '7',
        min: -100,
        max: 100,
        step: 0.1,
        required: true
    },
    {
        id: 'monthly_savings',
        title: 'How much do you save for retirement each month?',
        description: 'Enter the amount you currently save for retirement each month.',
        type: 'number',
        suffix: '$',
        placeholder: '1500',
        required: true
    },
    {
        id: 'working_tax_rate',
        title: 'What is your current tax rate?',
        description: 'Enter your effective tax rate during working years as a percentage.',
        type: 'number',
        suffix: '%',
        placeholder: '30',
        min: 0,
        max: 100,
        step: 0.1,
        required: true
    },
    {
        id: 'payouts',
        title: 'Do you expect any one-time inheritances or equity payouts?',
        description: 'Add any expected one-time payments you\'ll receive in the future. Enter the age at which you\'ll receive each payout. Click "Add Payout" to add multiple entries.',
        type: 'payouts',
        required: false
    }
];

function renderQuestion(index) {
    const question = questions[index];
    const container = document.getElementById('questionContainer');
    
    // Create question element
    const questionDiv = document.createElement('div');
    questionDiv.className = 'question';
    questionDiv.id = `question-${index}`;
    
    let html = `
        <div class="question-title">${question.title}</div>
        <div class="question-description">${question.description}</div>
    `;
    
    if (question.type === 'payouts') {
        html += renderPayoutsInput(question);
    } else {
        html += renderInput(question);
    }
    
    questionDiv.innerHTML = html;
    
    // Remove existing question with animation
    const existingQuestion = container.querySelector('.question');
    if (existingQuestion) {
        existingQuestion.classList.add('exiting');
        setTimeout(() => {
            if (existingQuestion.parentNode) {
                existingQuestion.remove();
            }
        }, 600);
    }
    
    // Add new question
    setTimeout(() => {
        container.appendChild(questionDiv);
        // Focus on input
        const input = questionDiv.querySelector('input, select');
        if (input) {
            input.focus();
        }
    }, existingQuestion ? 600 : 0);
    
    // Update progress
    updateProgress(index);
    
    // Update back button
    const backBtn = document.getElementById('backBtn');
    if (index > 0) {
        backBtn.style.display = 'block';
    } else {
        backBtn.style.display = 'none';
    }
    
    // Attach event listeners
    if (question.type === 'payouts') {
        attachPayoutsListeners(questionDiv);
    } else {
        attachInputListeners(questionDiv, question);
    }
}

function renderInput(question) {
    const value = answers[question.id] || '';
    let inputHtml = '';
    
    if (question.type === 'number') {
        const suffix = question.suffix ? `<span class="suffix">${question.suffix}</span>` : '';
        inputHtml = `
            <div class="input-group">
                <div class="input-suffix">
                    <input 
                        type="number" 
                        id="${question.id}" 
                        placeholder="${question.placeholder || ''}"
                        value="${value}"
                        ${question.min !== undefined ? `min="${question.min}"` : ''}
                        ${question.max !== undefined ? `max="${question.max}"` : ''}
                        ${question.step !== undefined ? `step="${question.step}"` : ''}
                        required
                    >
                    ${suffix}
                </div>
            </div>
        `;
    } else if (question.type === 'select') {
        inputHtml = `
            <div class="input-group">
                <select id="${question.id}" required>
                    ${question.options.map(opt => 
                        `<option value="${opt.value}" ${value === opt.value ? 'selected' : ''}>${opt.label}</option>`
                    ).join('')}
                </select>
            </div>
        `;
    }
    
    inputHtml += `
        <button class="btn btn-primary" id="nextBtn">Continue →</button>
    `;
    
    return inputHtml;
}

function renderPayoutsInput(question) {
    const payouts = answers.payouts || [];
    
    let html = '<div class="payouts-container">';
    
    if (payouts.length === 0) {
        html += '<p style="color: rgba(255, 255, 255, 0.8); margin-bottom: 16px;">No payouts added yet. Click "Add Payout" to add one, or click "Continue" to skip.</p>';
    }
    
    payouts.forEach((payout, index) => {
        html += `
            <div class="payout-item" data-index="${index}">
                <div class="input-group" style="flex: 1;">
                    <label>Amount</label>
                    <div class="input-suffix">
                        <input type="number" class="payout-amount" placeholder="100000" value="${payout.amount || ''}" min="0">
                        <span class="suffix">$</span>
                    </div>
                </div>
                <div class="input-group" style="flex: 1;">
                    <label>Age When Received</label>
                    <input type="number" class="payout-year" placeholder="45" value="${payout.year || ''}" min="1" max="100">
                </div>
                <button class="btn-remove" onclick="removePayout(${index})">Remove</button>
            </div>
        `;
    });
    
    html += `
        <button class="btn-add-payout" onclick="addPayout()">+ Add Payout</button>
    </div>
    <button class="btn btn-primary" id="nextBtn" style="margin-top: 24px;">Continue →</button>
    `;
    
    return html;
}

function attachInputListeners(questionDiv, question) {
    const input = questionDiv.querySelector('input, select');
    const nextBtn = questionDiv.querySelector('#nextBtn');
    
    // Auto-save on input
    input.addEventListener('input', (e) => {
        answers[question.id] = e.target.value;
        validateAndEnableButton(input, nextBtn, question);
        
        // Re-validate related questions if needed
        if (question.id === 'current_age' && answers.ideal_retirement_age) {
            // Re-validate retirement age question if it exists
            const retirementAgeInput = document.getElementById('ideal_retirement_age');
            if (retirementAgeInput) {
                const retirementQuestion = questions.find(q => q.id === 'ideal_retirement_age');
                const retirementNextBtn = document.getElementById('nextBtn');
                validateAndEnableButton(retirementAgeInput, retirementNextBtn, retirementQuestion);
            }
        } else if (question.id === 'ideal_retirement_age' && answers.current_age) {
            // Re-validate current age question if it exists
            const currentAgeInput = document.getElementById('current_age');
            if (currentAgeInput) {
                const currentAgeQuestion = questions.find(q => q.id === 'current_age');
                const currentAgeNextBtn = document.getElementById('nextBtn');
                validateAndEnableButton(currentAgeInput, currentAgeNextBtn, currentAgeQuestion);
            }
        }
    });
    
    // Enter key to submit
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !nextBtn.disabled) {
            nextBtn.click();
        }
    });
    
    // Initial validation
    validateAndEnableButton(input, nextBtn, question);
}

function attachPayoutsListeners(questionDiv) {
    const nextBtn = questionDiv.querySelector('#nextBtn');
    
    // Save payouts on any change
    questionDiv.addEventListener('input', () => {
        savePayouts();
    });
    
    nextBtn.disabled = false; // Payouts are optional
}

function validateAndEnableButton(input, button, question) {
    if (question.required) {
        const value = input.value.trim();
        let isValid = value !== '';
        
        if (question.type === 'number' && isValid) {
            const numValue = parseFloat(value);
            if (isNaN(numValue)) {
                isValid = false;
            } else {
                if (question.min !== undefined && numValue < question.min) isValid = false;
                if (question.max !== undefined && numValue > question.max) isValid = false;
                
                // Special validation: current_age must be less than ideal_retirement_age
                if (question.id === 'current_age' && answers.ideal_retirement_age) {
                    if (numValue >= parseInt(answers.ideal_retirement_age)) {
                        isValid = false;
                        input.setCustomValidity('Current age must be less than retirement age');
                    } else {
                        input.setCustomValidity('');
                    }
                }
                // Special validation: ideal_retirement_age must be greater than current_age
                else if (question.id === 'ideal_retirement_age' && answers.current_age) {
                    if (numValue <= parseInt(answers.current_age)) {
                        isValid = false;
                        input.setCustomValidity('Retirement age must be greater than current age');
                    } else {
                        input.setCustomValidity('');
                    }
                } else {
                    input.setCustomValidity('');
                }
            }
        }
        
        button.disabled = !isValid;
    } else {
        button.disabled = false;
    }
}

function savePayouts() {
    const payoutItems = document.querySelectorAll('.payout-item');
    const payouts = [];
    
    payoutItems.forEach(item => {
        const amount = item.querySelector('.payout-amount').value;
        const year = item.querySelector('.payout-year').value;
        
        if (amount && year) {
            payouts.push({
                amount: parseFloat(amount),
                year: parseInt(year)
            });
        }
    });
    
    answers.payouts = payouts;
}

function addPayout() {
    if (!answers.payouts) {
        answers.payouts = [];
    }
    answers.payouts.push({ amount: '', year: '' });
    renderQuestion(currentQuestionIndex);
}

function removePayout(index) {
    answers.payouts.splice(index, 1);
    renderQuestion(currentQuestionIndex);
}

function updateProgress(index) {
    const progress = ((index + 1) / questions.length) * 100;
    document.getElementById('progressFill').style.width = `${progress}%`;
    document.getElementById('progressText').textContent = `Question ${index + 1} of ${questions.length}`;
}

function nextQuestion() {
    if (currentQuestionIndex < questions.length - 1) {
        currentQuestionIndex++;
        renderQuestion(currentQuestionIndex);
    } else {
        // All questions answered, submit to API
        submitAnswers();
    }
}

function previousQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        renderQuestion(currentQuestionIndex);
    }
}

function submitAnswers() {
    // Prepare data for API
    const data = {
        ideal_retirement_income: parseFloat(answers.ideal_retirement_income),
        ideal_retirement_age: parseInt(answers.ideal_retirement_age),
        withdrawal_rate: parseFloat(answers.withdrawal_rate),
        current_age: parseInt(answers.current_age),
        current_monthly_income: parseFloat(answers.current_monthly_income),
        current_asset_values: parseFloat(answers.current_asset_values),
        cagr: parseFloat(answers.cagr),
        monthly_savings: parseFloat(answers.monthly_savings),
        working_tax_rate: parseFloat(answers.working_tax_rate),
        payouts: answers.payouts || []
    };
    
    // Show loading state
    const container = document.querySelector('.question-container');
    container.innerHTML = '<div style="text-align: center; padding: 40px;"><div style="font-size: 18px; color: rgba(255, 255, 255, 0.9);">Calculating your retirement plan...</div></div>';
    
    // Submit to API
    fetch('/api/calculate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => {
                throw new Error(err.error || 'Server error');
            });
        }
        return response.json();
    })
    .then(result => {
        if (result.error) {
            throw new Error(result.error);
        }
        // Store results in sessionStorage and redirect to dashboard
        sessionStorage.setItem('retirementPlan', JSON.stringify(result));
        window.location.href = '/dashboard';
    })
    .catch(error => {
        console.error('Error:', error);
        const errorMessage = typeof error === 'string' ? error : (error.message || 'An unknown error occurred');
        container.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 18px; color: #ffcccc; margin-bottom: 20px;">Error calculating retirement plan</div>
                <div style="color: rgba(255, 255, 255, 0.9); margin-bottom: 20px; white-space: pre-wrap;">${errorMessage}</div>
                <button class="btn btn-primary" onclick="location.reload()">Try Again</button>
            </div>
        `;
    });
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    renderQuestion(0);
    
    // Next button (delegated event listener)
    document.addEventListener('click', (e) => {
        if (e.target.id === 'nextBtn' && !e.target.disabled) {
            nextQuestion();
        }
    });
    
    // Back button
    document.getElementById('backBtn').addEventListener('click', previousQuestion);
});

