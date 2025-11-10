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
        prefix: '$',
        required: true
    },
    {
        id: 'ideal_retirement_age',
        title: 'At what age would you like to retire?',
        description: 'Enter your target retirement age.',
        type: 'number',
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
        min: 1,
        max: 100,
        required: true
    },
    {
        id: 'current_asset_values',
        title: 'What is your current total asset value?',
        description: 'Enter the total value of all your current investments and savings.',
        type: 'number',
        prefix: '$',
        required: true
    },
    {
        id: 'cagr',
        title: 'What annual growth rate do you expect?',
        description: 'Enter your expected Compound Annual Growth Rate (CAGR) as a percentage. A typical range is 5-8%.',
        type: 'number',
        suffix: '%',
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
        prefix: '$',
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

const QUESTION_TRANSITION_DURATION = 600;
let dashboardSlideElement = null;
let dashboardTransitionActive = false;

function shouldFormatWithCommas(question) {
    return question && question.prefix === '$';
}

function sanitizeNumberString(value) {
    if (value === undefined || value === null) {
        return '';
    }
    return value.toString().replace(/,/g, '').trim();
}

function formatWithCommas(value) {
    const sanitized = sanitizeNumberString(value);
    if (sanitized === '') {
        return '';
    }
    const parts = sanitized.split('.');
    let integerPart = parts[0];
    const decimalPart = parts[1];
    let sign = '';
    
    if (integerPart.startsWith('-')) {
        sign = '-';
        integerPart = integerPart.slice(1);
    }
    
    const formattedInt = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',') || '0';
    return `${sign}${formattedInt}${decimalPart !== undefined ? `.${decimalPart}` : ''}`;
}

function getDisplayValue(question, value) {
    if (shouldFormatWithCommas(question)) {
        return formatWithCommas(value);
    }
    return value || '';
}

function payoutItemTemplate(payout, index) {
    const amountDisplay = formatWithCommas(payout.amount || '');
    return `
        <div class="payout-item" data-index="${index}">
            <div class="input-group" style="flex: 1;">
                <label>Amount</label>
                <div class="input-affix has-prefix">
                    <span class="affix prefix">$</span>
                    <input type="text" inputmode="decimal" class="payout-amount" value="${amountDisplay}">
                </div>
            </div>
            <div class="input-group" style="flex: 1;">
                <label>Age When Received</label>
                <input type="number" class="payout-year" value="${payout.year || ''}" min="1" max="100">
            </div>
            <button type="button" class="btn-remove" data-action="remove-payout">Remove</button>
        </div>
    `;
}

function ensurePayoutsArray() {
    if (!Array.isArray(answers.payouts)) {
        answers.payouts = [];
    }
}

function updatePayoutsList(listEl, messageEl) {
    ensurePayoutsArray();
    if (!listEl) return;
    listEl.innerHTML = answers.payouts.map((payout, index) => payoutItemTemplate(payout, index)).join('');
    if (messageEl) {
        messageEl.style.display = answers.payouts.length ? 'none' : 'block';
    }
}

function formatCurrencyInputElement(input) {
    if (!input) {
        return '';
    }
    const previousValue = input.value;
    const caretPosition = input.selectionStart;
    const sanitized = sanitizeNumberString(previousValue);
    const formatted = formatWithCommas(sanitized);
    input.value = formatted;
    if (document.activeElement === input && typeof caretPosition === 'number') {
        const diff = formatted.length - previousValue.length;
        const newPosition = Math.max(0, caretPosition + diff);
        try {
            input.setSelectionRange(newPosition, newPosition);
        } catch (err) {
            // Ignore selection errors (e.g., unsupported input types)
        }
    }
    return sanitized;
}

function transitionOutCurrentQuestion(callback) {
    const container = document.getElementById('questionContainer');
    const currentQuestion = container ? container.querySelector('.question') : null;
    if (!currentQuestion) {
        if (typeof callback === 'function') {
            callback();
        }
        return;
    }
    currentQuestion.classList.add('exiting');
    setTimeout(() => {
        if (currentQuestion.parentNode) {
            currentQuestion.remove();
        }
        if (typeof callback === 'function') {
            callback();
        }
    }, QUESTION_TRANSITION_DURATION);
}

function triggerDashboardTransition() {
    if (dashboardTransitionActive) {
        return;
    }
    dashboardTransitionActive = true;
    document.body.classList.add('dashboard-transition');
    dashboardSlideElement = document.createElement('div');
    dashboardSlideElement.className = 'dashboard-slide';
    dashboardSlideElement.innerHTML = `
        <div class="dashboard-slide__content">
            <div class="dashboard-slide__title">Building your dashboard</div>
            <div class="dashboard-slide__subtitle">We are running the numbers and preparing your personalized outlook.</div>
            <div class="dashboard-slide__glimpse">
                <div class="dashboard-slide__card">
                    <div class="dashboard-slide__card-title">Projected Net Worth</div>
                    <div class="dashboard-slide__card-value">$1.8M</div>
                </div>
                <div class="dashboard-slide__card">
                    <div class="dashboard-slide__card-title">Retirement Age</div>
                    <div class="dashboard-slide__card-value">64 yrs</div>
                </div>
                <div class="dashboard-slide__card">
                    <div class="dashboard-slide__card-title">Monthly Income</div>
                    <div class="dashboard-slide__card-value">$7,250</div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(dashboardSlideElement);
    requestAnimationFrame(() => {
        dashboardSlideElement.classList.add('active');
    });
}

function cancelDashboardTransition() {
    document.body.classList.remove('dashboard-transition');
    dashboardTransitionActive = false;
    if (dashboardSlideElement && dashboardSlideElement.parentNode) {
        dashboardSlideElement.parentNode.removeChild(dashboardSlideElement);
    }
    dashboardSlideElement = null;
}

function renderQuestion(index) {
    const question = questions[index];
    const container = document.getElementById('questionContainer');
    if (!question || !container) {
        return;
    }
    
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
    
    const mountQuestion = () => {
        container.appendChild(questionDiv);
        const focusable = questionDiv.querySelector('.question-body input, .question-body select');
        if (focusable && question.type !== 'payouts') {
            focusable.focus();
        }
        
        if (question.type === 'payouts') {
            attachPayoutsListeners(questionDiv);
        } else {
            attachInputListeners(questionDiv, question);
        }
        
        updateProgress(index);
        const backBtn = document.getElementById('backBtn');
        if (backBtn) {
            backBtn.style.display = index > 0 ? 'block' : 'none';
        }
    };
    
    transitionOutCurrentQuestion(mountQuestion);
}

function renderInput(question) {
    const rawValue = answers[question.id] || '';
    const displayValue = question.type === 'number' ? getDisplayValue(question, rawValue) : rawValue;
    let inputHtml = '<div class="question-body">';
    
    if (question.type === 'number') {
        const prefix = question.prefix ? `<span class="affix prefix">${question.prefix}</span>` : '';
        const suffix = question.suffix ? `<span class="affix suffix">${question.suffix}</span>` : '';
        const affixClasses = ['input-affix', question.prefix ? 'has-prefix' : '', question.suffix ? 'has-suffix' : '']
            .filter(Boolean)
            .join(' ');
        const allowsDecimals = typeof question.step === 'number' && !Number.isInteger(question.step);
        const htmlInputType = shouldFormatWithCommas(question) ? 'text' : 'number';
        const inputMode = shouldFormatWithCommas(question) || allowsDecimals ? 'decimal' : 'numeric';
        const placeholderAttr = question.placeholder ? `placeholder="${question.placeholder}"` : '';
        inputHtml += `
            <div class="input-group narrow-input">
                <div class="${affixClasses}">
                    ${prefix}
                    <input 
                        type="${htmlInputType}" 
                        id="${question.id}" 
                        ${inputMode ? `inputmode="${inputMode}"` : ''}
                        ${placeholderAttr}
                        value="${displayValue}"
                        ${!shouldFormatWithCommas(question) && question.min !== undefined ? `min="${question.min}"` : ''}
                        ${!shouldFormatWithCommas(question) && question.max !== undefined ? `max="${question.max}"` : ''}
                        ${!shouldFormatWithCommas(question) && question.step !== undefined ? `step="${question.step}"` : ''}
                        autocomplete="off"
                        required
                    >
                    ${suffix}
                </div>
            </div>
        `;
    } else if (question.type === 'select') {
        inputHtml += `
            <div class="input-group narrow-input">
                <select id="${question.id}" required>
                    ${question.options.map(opt => 
                        `<option value="${opt.value}" ${rawValue === opt.value ? 'selected' : ''}>${opt.label}</option>`
                    ).join('')}
                </select>
            </div>
        `;
    }
    
    inputHtml += `
        <button type="button" class="btn btn-primary" id="nextBtn">Continue →</button>
    </div>
    `;
    
    return inputHtml;
}

function renderPayoutsInput(question) {
    ensurePayoutsArray();
    const hasPayouts = answers.payouts.length > 0;
    const emptyMessageStyle = hasPayouts ? 'style="display: none;"' : '';
    
    return `
        <div class="question-body">
            <div class="payouts-container">
                <p class="payouts-empty-message" ${emptyMessageStyle}>No payouts added yet. Click "Add Payout" to add one, or click "Continue" to skip.</p>
                <div class="payouts-list">
                    ${answers.payouts.map((payout, index) => payoutItemTemplate(payout, index)).join('')}
                </div>
                <button type="button" class="btn-add-payout" id="addPayoutBtn">+ Add Payout</button>
            </div>
            <button type="button" class="btn btn-primary" id="nextBtn" style="margin-top: 24px;">Continue →</button>
        </div>
    `;
}

function attachInputListeners(questionDiv, question) {
    const input = questionDiv.querySelector('input, select');
    const nextBtn = questionDiv.querySelector('#nextBtn');
    
    // Auto-save on input
    input.addEventListener('input', (e) => {
        let value = e.target.value;
        if (question.type === 'number') {
            if (shouldFormatWithCommas(question)) {
                value = formatCurrencyInputElement(e.target);
            } else {
                value = sanitizeNumberString(value);
            }
        }
        answers[question.id] = value;
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
    const payoutsList = questionDiv.querySelector('.payouts-list');
    const emptyMessage = questionDiv.querySelector('.payouts-empty-message');
    const addBtn = questionDiv.querySelector('#addPayoutBtn');
    
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            ensurePayoutsArray();
            answers.payouts.push({ amount: '', year: '' });
            updatePayoutsList(payoutsList, emptyMessage);
        });
    }
    
    if (payoutsList) {
        questionDiv.addEventListener('input', (e) => {
            if (e.target.classList.contains('payout-amount')) {
                formatCurrencyInputElement(e.target);
            }
            if (e.target.classList.contains('payout-amount') || e.target.classList.contains('payout-year')) {
                savePayouts();
            }
        });
    
        payoutsList.addEventListener('click', (e) => {
            const removeBtn = e.target.closest('.btn-remove');
            if (removeBtn) {
                const item = removeBtn.closest('.payout-item');
                const index = parseInt(item.dataset.index, 10);
                if (!Number.isNaN(index)) {
                    answers.payouts.splice(index, 1);
                    updatePayoutsList(payoutsList, emptyMessage);
                }
            }
        });
    }
    
    nextBtn.disabled = false; // Payouts are optional
}

function validateAndEnableButton(input, button, question) {
    if (question.required) {
        const value = question.type === 'number' ? sanitizeNumberString(input.value) : input.value.trim();
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
    const payoutItems = document.querySelectorAll('.payouts-list .payout-item');
    const payouts = [];
    
    payoutItems.forEach(item => {
        const amountInput = item.querySelector('.payout-amount');
        const yearInput = item.querySelector('.payout-year');
        const amount = sanitizeNumberString(amountInput ? amountInput.value : '');
        const year = sanitizeNumberString(yearInput ? yearInput.value : '');
        
        payouts.push({
            amount,
            year
        });
    });
    
    answers.payouts = payouts;
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
        transitionOutCurrentQuestion(() => {
            submitAnswers();
        });
    }
}

function previousQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        renderQuestion(currentQuestionIndex);
    }
}

function submitAnswers() {
    const sanitizedPayouts = (answers.payouts || [])
        .filter(payout => payout && (payout.amount || payout.year))
        .map(payout => ({
            amount: parseFloat(payout.amount),
            year: parseInt(payout.year, 10)
        }))
        .filter(payout => !Number.isNaN(payout.amount) && !Number.isNaN(payout.year));
    
    const data = {
        ideal_retirement_income: parseFloat(answers.ideal_retirement_income),
        ideal_retirement_age: parseInt(answers.ideal_retirement_age),
        withdrawal_rate: parseFloat(answers.withdrawal_rate),
        current_age: parseInt(answers.current_age),
        current_asset_values: parseFloat(answers.current_asset_values),
        cagr: parseFloat(answers.cagr),
        monthly_savings: parseFloat(answers.monthly_savings),
        payouts: sanitizedPayouts
    };
    
    triggerDashboardTransition();
    
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
        sessionStorage.setItem('retirementPlan', JSON.stringify(result));
        setTimeout(() => {
            window.location.href = '/dashboard';
        }, 700);
    })
    .catch(error => {
        console.error('Error:', error);
        cancelDashboardTransition();
        const container = document.querySelector('.question-container');
        const errorMessage = typeof error === 'string' ? error : (error.message || 'An unknown error occurred');
        if (container) {
            container.innerHTML = `
                <div class="transition-error">
                    <div style="margin-bottom: 16px;">We ran into an issue preparing your dashboard.</div>
                    <div style="margin-bottom: 24px;">${errorMessage}</div>
                    <button class="btn btn-primary" onclick="location.reload()">Try Again</button>
                </div>
            `;
        }
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
