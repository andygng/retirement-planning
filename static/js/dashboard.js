let planData = null;
let basePlanData = null;
let charts = {};
const CHAT_STORAGE_KEY = 'retirementChatHistory';
const CURRENCY_STORAGE_KEY = 'retirementCurrencyPreferences';

const currencyConfig = {
    CAD: { locale: 'en-CA', currency: 'CAD', shortSymbol: 'CA$', defaultRate: 1 },
    USD: { locale: 'en-US', currency: 'USD', shortSymbol: 'US$', defaultRate: 0.74 },
    GBP: { locale: 'en-GB', currency: 'GBP', shortSymbol: 'GBP', defaultRate: 0.58 }
};

const currencyFormatters = {};
let currencyState = loadCurrencyState();
const currencyElements = {
    dropdown: null,
    toggle: null,
    menu: null,
    label: null
};
let currencyMenuListenersBound = false;
let chatHistory = [];
let chatInitialized = false;
let chatIsSending = false;
const chatElements = {};

// Load plan data from sessionStorage
document.addEventListener('DOMContentLoaded', () => {
    initializeCurrencyControls();
    const storedData = sessionStorage.getItem('retirementPlan');
    if (storedData) {
        basePlanData = JSON.parse(storedData);
        refreshPlanUsingCurrency();
        renderDashboard();
        initializeChatAssistant();
    } else {
        // No data, redirect to welcome page
        window.location.href = '/';
        return;
    }
    
    // Edit button
    const editBtn = document.getElementById('editBtn');
    if (editBtn) {
        editBtn.addEventListener('click', openEditModal);
    }
    const closeModalBtn = document.getElementById('closeModal');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeEditModal);
    }
    const cancelEditBtn = document.getElementById('cancelEdit');
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', closeEditModal);
    }
    const saveEditBtn = document.getElementById('saveEdit');
    if (saveEditBtn) {
        saveEditBtn.addEventListener('click', saveAndRecalculate);
    }
    
    // Restart button
    const restartBtn = document.getElementById('restartBtn');
    if (restartBtn) {
        restartBtn.addEventListener('click', () => {
            sessionStorage.clear();
            window.location.href = '/';
        });
    }
});

function renderDashboard() {
    const container = document.getElementById('dashboardContent');
    if (!container || !planData) {
        return;
    }
    
    let html = `
        <div class="summary-cards">
            ${renderSummaryCard('Target Net Worth', formatCurrency(planData.target_net_worth), 'Required at retirement')}
            ${renderSummaryCard('Projected Net Worth', formatCurrency(planData.total_projected_net_worth), `In ${planData.years_until_retirement} years`)}
            ${renderSummaryCard('Gap', formatCurrency(planData.gap), planData.gap >= 0 ? 'Surplus' : 'Shortfall', planData.gap >= 0 ? 'positive' : 'negative')}
            ${renderSummaryCard('Current Monthly Savings', formatCurrency(planData.current_monthly_savings), 'Your current rate')}
        </div>
        
        <div class="charts-section">
            <div class="chart-container">
                <h2>Net Worth Projection</h2>
                <div class="chart-wrapper">
                    <canvas id="netWorthChart"></canvas>
                </div>
            </div>
            <div class="chart-container">
                <h2>Progress Over Time</h2>
                <div class="chart-wrapper">
                    <canvas id="progressChart"></canvas>
                </div>
            </div>
        </div>
        
        <div class="commentary-section">
            <h2>Analysis & Recommendations</h2>
            ${generateCommentary()}
        </div>
        
        <div class="table-section">
            <h2>Year-by-Year Projection</h2>
            ${renderProjectionTable()}
        </div>
    `;
    
    container.innerHTML = html;
    
    // Render charts
    renderCharts();
}

function renderSummaryCard(title, value, subtitle, valueClass = '') {
    return `
        <div class="summary-card">
            <h3>${title}</h3>
            <div class="value ${valueClass}">${value}</div>
            <div class="subtitle">${subtitle}</div>
        </div>
    `;
}

function renderCharts() {
    if (!planData || !Array.isArray(planData.year_by_year)) {
        return;
    }
    const yearByYear = planData.year_by_year;
    const years = yearByYear.map(y => y.year);
    const projected = yearByYear.map(y => y.total_net_worth);
    const target = yearByYear.map(y => y.target_net_worth);
    
    // Net Worth Projection Chart
    const netWorthCtx = document.getElementById('netWorthChart').getContext('2d');
    if (charts.netWorth) {
        charts.netWorth.destroy();
    }
    charts.netWorth = new Chart(netWorthCtx, {
        type: 'line',
        data: {
            labels: years,
            datasets: [
                {
                    label: 'Projected Net Worth',
                    data: projected,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Target Net Worth',
                    data: target,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    borderDash: [5, 5],
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatCurrencyShort(value);
                        }
                    }
                }
            }
        }
    });
    
    // Progress Chart (Gap over time)
    const progressCtx = document.getElementById('progressChart').getContext('2d');
    if (charts.progress) {
        charts.progress.destroy();
    }
    const gaps = yearByYear.map(y => y.gap);
    charts.progress = new Chart(progressCtx, {
        type: 'bar',
        data: {
            labels: years,
            datasets: [{
                label: 'Gap (Projected - Target)',
                data: gaps,
                backgroundColor: gaps.map(g => g >= 0 ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.6)'),
                borderColor: gaps.map(g => g >= 0 ? '#10b981' : '#ef4444'),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return 'Gap: ' + formatCurrency(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                y: {
                    ticks: {
                        callback: function(value) {
                            return formatCurrencyShort(value);
                        }
                    }
                }
            }
        }
    });
}

function generateCommentary() {
    if (!planData || !planData.inputs) {
        return '';
    }
    const gap = planData.gap;
    const gapPercentage = planData.gap_percentage;
    const requiredSavings = planData.required_monthly_savings;
    const currentSavings = planData.current_monthly_savings;
    const yearsUntilRetirement = planData.years_until_retirement;
    
    let html = '';
    
    // Current Status
    html += `
        <div class="commentary-item">
            <h3>Current Status</h3>
            <p>
                Based on your current financial situation, you are projected to have 
                <strong>${formatCurrency(planData.total_projected_net_worth)}</strong> at retirement age ${planData.inputs.ideal_retirement_age}, 
                which is <strong>${formatCurrency(Math.abs(gap))}</strong> 
                ${gap >= 0 ? 'more than' : 'less than'} your target of 
                <strong>${formatCurrency(planData.target_net_worth)}</strong>.
            </p>
        </div>
    `;
    
    // Gap Analysis
    if (gap < 0) {
        const shortfall = Math.abs(gap);
        const additionalMonthly = requiredSavings - currentSavings;
        
        html += `
            <div class="commentary-item">
                <h3>Gap Analysis</h3>
                <p>
                    You have a shortfall of <strong>${formatCurrency(shortfall)}</strong> 
                    (${Math.abs(gapPercentage).toFixed(1)}% below target). To close this gap, you need to:
                </p>
                <ul>
                    <li>Increase your monthly savings from ${formatCurrency(currentSavings)} to 
                        <strong>${formatCurrency(requiredSavings)}</strong> 
                        (an additional ${formatCurrency(additionalMonthly)} per month)</li>
                    <li>Or reduce your retirement income goal by approximately 
                        ${formatCurrency(planData.inputs.ideal_retirement_income * Math.abs(gapPercentage) / 100)} per month</li>
                    <li>Or delay retirement by a few years to allow more time for growth</li>
                </ul>
            </div>
        `;
    } else {
        html += `
            <div class="commentary-item">
                <h3>Gap Analysis</h3>
                <p>
                    Great news! You're on track to exceed your retirement goal by 
                    <strong>${formatCurrency(gap)}</strong> (${gapPercentage.toFixed(1)}% above target). 
                    You may consider:
                </p>
                <ul>
                    <li>Retiring earlier than planned</li>
                    <li>Increasing your retirement lifestyle goals</li>
                    <li>Reducing your current savings rate if desired</li>
                </ul>
            </div>
        `;
    }
    
    // Recommendations
    html += `
        <div class="commentary-item">
            <h3>Recommendations</h3>
            <p>Based on your plan, here are some actionable steps:</p>
            <ul>
                ${gap < 0 ? `
                    <li><strong>Increase Savings:</strong> Try to save an additional 
                        ${formatCurrency(requiredSavings - currentSavings)} per month. 
                        This could come from reducing expenses or increasing income.</li>
                    <li><strong>Review Expenses:</strong> Look for opportunities to reduce discretionary spending 
                        and redirect those funds to retirement savings.</li>
                    <li><strong>Consider Side Income:</strong> Additional income streams can significantly 
                        accelerate your retirement savings.</li>
                ` : `
                    <li><strong>Maintain Current Savings Rate:</strong> You're on track! Continue saving at your 
                        current rate of ${formatCurrency(currentSavings)} per month.</li>
                    <li><strong>Consider Early Retirement:</strong> With your current trajectory, you may be able 
                        to retire earlier than planned.</li>
                `}
                <li><strong>Review Annually:</strong> Revisit this plan annually to adjust for changes in income, 
                    expenses, or goals.</li>
                <li><strong>Diversify Investments:</strong> Ensure your portfolio is well-diversified to achieve 
                    your assumed ${Number(planData.inputs.cagr).toFixed(1)}% annual growth rate.</li>
            </ul>
        </div>
    `;
    
    // Assumptions
    html += `
        <div class="commentary-item">
            <h3>Important Assumptions</h3>
            <p>This plan is based on the following assumptions:</p>
            <ul>
                <li>Annual growth rate (CAGR) of ${Number(planData.inputs.cagr).toFixed(1)}%</li>
                <li>Withdrawal rate of ${Number(planData.inputs.withdrawal_rate).toFixed(1)}% annually</li>
                <li>Canadian tax rates applied to retirement income (effective rate: ${planData.retirement_tax_rate.toFixed(1)}%)</li>
                <li>Monthly savings contributions invested immediately</li>
                <li>All investments compound monthly</li>
            </ul>
            <p style="margin-top: 12px; color: #999; font-size: 14px;">
                <em>Note: Actual results may vary based on market conditions, tax law changes, and other factors. 
                This is a projection tool and should not be considered as financial advice.</em>
            </p>
        </div>
    `;
    
    return html;
}

function renderProjectionTable() {
    if (!planData || !Array.isArray(planData.year_by_year)) {
        return '';
    }
    const yearByYear = planData.year_by_year;
    
    let html = `
        <table>
            <thead>
                <tr>
                    <th>Age</th>
                    <th class="number">Current Assets</th>
                    <th class="number">Savings Growth</th>
                    <th class="number">Payouts</th>
                    <th class="number">Total Net Worth</th>
                    <th class="number">Target</th>
                    <th class="number">Gap</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    yearByYear.forEach(year => {
        html += `
            <tr>
                <td>${year.age}</td>
                <td class="number">${formatCurrency(year.current_assets)}</td>
                <td class="number">${formatCurrency(year.savings_contributions)}</td>
                <td class="number">${formatCurrency(year.payouts_value)}</td>
                <td class="number">${formatCurrency(year.total_net_worth)}</td>
                <td class="number">${formatCurrency(year.target_net_worth)}</td>
                <td class="number ${year.gap >= 0 ? 'positive' : 'negative'}">${formatCurrency(year.gap)}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    return html;
}

function populateEditForm() {
    const form = document.getElementById('editForm');
    if (!form || !planData || !planData.inputs) {
        return;
    }
    const inputs = planData.inputs;
    const currencyLabel = currencyState.selected;
    const formattedCurrencyInputs = {
        ideal_retirement_income: formatNumberForInput(inputs.ideal_retirement_income),
        current_asset_values: formatNumberForInput(inputs.current_asset_values),
        monthly_savings: formatNumberForInput(inputs.monthly_savings)
    };
    
    form.innerHTML = `
        <div class="edit-grid">
            <div class="form-group">
                <label>Ideal Monthly Retirement Income (${currencyLabel})</label>
                <input 
                    type="text" 
                    id="edit_ideal_retirement_income" 
                    value="${formattedCurrencyInputs.ideal_retirement_income}"
                    inputmode="decimal"
                    data-format="comma"
                >
            </div>
            <div class="form-group">
                <label>Ideal Retirement Age</label>
                <input type="number" id="edit_ideal_retirement_age" value="${inputs.ideal_retirement_age ?? ''}" min="1" max="100">
            </div>
            <div class="form-group">
                <label>Withdrawal Rate (%)</label>
                <input type="number" id="edit_withdrawal_rate" value="${inputs.withdrawal_rate ?? ''}" min="0.1" max="10" step="0.1">
            </div>
            <div class="form-group">
                <label>Current Age</label>
                <input type="number" id="edit_current_age" value="${inputs.current_age ?? ''}" min="1" max="100">
            </div>
            <div class="form-group">
                <label>Current Asset Values (${currencyLabel})</label>
                <input 
                    type="text" 
                    id="edit_current_asset_values" 
                    value="${formattedCurrencyInputs.current_asset_values}"
                    inputmode="decimal"
                    data-format="comma"
                >
            </div>
            <div class="form-group">
                <label>Expected Annual Growth Rate (CAGR %)</label>
                <input type="number" id="edit_cagr" value="${inputs.cagr ?? ''}" min="-100" max="100" step="0.1">
            </div>
            <div class="form-group">
                <label>Monthly Savings for Retirement (${currencyLabel})</label>
                <input 
                    type="text" 
                    id="edit_monthly_savings" 
                    value="${formattedCurrencyInputs.monthly_savings}"
                    inputmode="decimal"
                    data-format="comma"
                >
            </div>
        </div>
    `;
    
    setupCommaFormatting(form);
}

function openEditModal(event) {
    if (event) {
        event.preventDefault();
    }
    const modal = document.getElementById('editModal');
    populateEditForm();
    if (modal) {
        modal.classList.add('active');
    }
}

function closeEditModal() {
    document.getElementById('editModal').classList.remove('active');
}

function saveAndRecalculate() {
    if (!planData || !planData.inputs) {
        return;
    }
    const inputs = {
        ideal_retirement_income: parseFloat(getSanitizedInputValue('edit_ideal_retirement_income')),
        ideal_retirement_age: parseInt(document.getElementById('edit_ideal_retirement_age').value),
        withdrawal_rate: parseFloat(document.getElementById('edit_withdrawal_rate').value),
        current_age: parseInt(document.getElementById('edit_current_age').value),
        current_asset_values: parseFloat(getSanitizedInputValue('edit_current_asset_values')),
        cagr: parseFloat(document.getElementById('edit_cagr').value),
        monthly_savings: parseFloat(getSanitizedInputValue('edit_monthly_savings')),
        payouts: Array.isArray(planData.inputs.payouts) ? planData.inputs.payouts.map(payout => ({ ...payout })) : []
    };
    const normalizedInputs = convertInputsToBaseCurrency(inputs);
    
    // Show loading
    document.getElementById('dashboardContent').innerHTML = '<div class="loading">Recalculating...</div>';
    closeEditModal();
    
    // Recalculate
    fetch('/api/calculate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(normalizedInputs)
    })
    .then(response => response.json())
    .then(result => {
        basePlanData = result;
        sessionStorage.setItem('retirementPlan', JSON.stringify(result));
        refreshDashboardAfterCurrencyChange();
        if (chatInitialized) {
            setChatStatus('Plan updated. Ask what changed.');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Error recalculating. Please try again.');
        renderDashboard();
    });
}

function formatCurrency(amount) {
    const numericValue = typeof amount === 'number' ? amount : parseFloat(amount);
    const value = Number.isFinite(numericValue) ? numericValue : 0;
    const formatter = getCurrencyFormatter(currencyState.selected);
    return formatter.format(value);
}

function formatCurrencyShort(amount) {
    const numericValue = typeof amount === 'number' ? amount : parseFloat(amount);
    const value = Number.isFinite(numericValue) ? numericValue : 0;
    const sign = value < 0 ? '-' : '';
    const absolute = Math.abs(value);
    const meta = currencyConfig[currencyState.selected] || currencyConfig.CAD;
    const symbol = meta.shortSymbol || meta.currency || '$';
    
    if (absolute >= 1000000) {
        return `${sign}${symbol}${(absolute / 1000000).toFixed(1)}M`;
    } else if (absolute >= 1000) {
        return `${sign}${symbol}${(absolute / 1000).toFixed(0)}K`;
    }
    return `${sign}${symbol}${absolute.toFixed(0)}`;
}

function formatNumberForInput(value) {
    if (value === undefined || value === null || value === '') {
        return '';
    }
    const numeric = typeof value === 'number' ? value : parseFloat(value);
    if (!Number.isFinite(numeric)) {
        return '';
    }
    const [integerPartRaw, decimalPart] = numeric.toString().split('.');
    const integerPart = integerPartRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return decimalPart !== undefined ? `${integerPart}.${decimalPart}` : integerPart;
}

function sanitizeNumberInput(value) {
    if (value === undefined || value === null) {
        return '';
    }
    return value.toString().replace(/,/g, '').trim();
}

function setupCommaFormatting(container) {
    if (!container) {
        return;
    }
    const inputs = container.querySelectorAll('input[data-format="comma"]');
    inputs.forEach(input => {
        input.addEventListener('focus', () => {
            input.value = sanitizeNumberInput(input.value);
        });
        input.addEventListener('blur', () => {
            const sanitized = sanitizeNumberInput(input.value);
            if (sanitized === '' || Number.isNaN(Number(sanitized))) {
                input.value = '';
                return;
            }
            input.value = formatNumberForInput(sanitized);
        });
        const initialValue = sanitizeNumberInput(input.value);
        if (initialValue !== '') {
            input.value = formatNumberForInput(initialValue);
        }
    });
}

function getSanitizedInputValue(id) {
    const element = document.getElementById(id);
    if (!element) {
        return '';
    }
    return sanitizeNumberInput(element.value);
}

function initializeChatAssistant() {
    if (chatInitialized) {
        return;
    }
    
    chatElements.launcherInput = document.getElementById('chatLauncherInput');
    chatElements.overlay = document.getElementById('chatOverlay');
    chatElements.closeBtn = document.getElementById('closeChat');
    chatElements.messages = document.getElementById('chatMessages');
    chatElements.form = document.getElementById('chatForm');
    chatElements.textarea = document.getElementById('chatInput');
    chatElements.status = document.getElementById('chatStatus');
    chatElements.sendBtn = document.getElementById('sendChatBtn');
    
    if (!chatElements.launcherInput || !chatElements.form || !chatElements.overlay) {
        return;
    }
    
    chatHistory = loadChatHistory();
    renderChatMessages();
    
    chatElements.launcherInput.addEventListener('click', openChatOverlay);
    chatElements.launcherInput.addEventListener('focus', openChatOverlay);
    
    if (chatElements.closeBtn) {
        chatElements.closeBtn.addEventListener('click', closeChatOverlay);
    }
    
    chatElements.overlay.addEventListener('click', (event) => {
        if (event.target === chatElements.overlay) {
            closeChatOverlay();
        }
    });
    chatElements.form.addEventListener('submit', handleChatSubmit);
    
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && chatElements.overlay && chatElements.overlay.classList.contains('active')) {
            closeChatOverlay();
        }
    });
    
    chatInitialized = true;
}

function loadChatHistory() {
    try {
        const stored = localStorage.getItem(CHAT_STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (error) {
        console.warn('Unable to load chat history', error);
        return [];
    }
}

function saveChatHistory() {
    try {
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chatHistory));
    } catch (error) {
        console.warn('Unable to save chat history', error);
    }
}

function renderChatMessages() {
    if (!chatElements.messages) {
        return;
    }
    
    if (!chatHistory.length) {
        const intro = "I'm your plan copilot. Ask how changing retirement age, savings, or income targets affects your outlook.";
        chatElements.messages.innerHTML = `
            <div class="chat-message assistant">
                ${formatChatMessage(intro)}
            </div>
        `;
        return;
    }
    
    chatElements.messages.innerHTML = chatHistory
        .map(message => `
            <div class="chat-message ${message.role}">
                ${formatChatMessage(message.content)}
            </div>
        `)
        .join('');
    
    chatElements.messages.scrollTop = chatElements.messages.scrollHeight;
}

function addChatMessage(role, content) {
    chatHistory.push({
        role,
        content,
        timestamp: Date.now()
    });
    saveChatHistory();
    renderChatMessages();
}

function handleChatSubmit(event) {
    event.preventDefault();
    if (chatIsSending) {
        return;
    }
    
    const message = chatElements.textarea.value.trim();
    if (!message) {
        return;
    }
    
    addChatMessage('user', message);
    chatElements.textarea.value = '';
    setChatStatus('Thinking...');
    chatIsSending = true;
    if (chatElements.sendBtn) {
        chatElements.sendBtn.disabled = true;
    }
    
    fetch('/api/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message,
            plan_data: planData
        })
    })
    .then(response => response.json())
    .then(result => {
        if (result.response) {
            addChatMessage('assistant', result.response);
            setChatStatus('');
        } else {
            const errorMessage = result.error || 'Something went wrong.';
            addChatMessage('error', errorMessage);
            setChatStatus('Unable to get a reply.');
        }
    })
    .catch(() => {
        addChatMessage('error', 'Network error. Please try again.');
        setChatStatus('Unable to get a reply.');
    })
    .finally(() => {
        chatIsSending = false;
        if (chatElements.sendBtn) {
            chatElements.sendBtn.disabled = false;
        }
    });
}

function openChatOverlay() {
    if (!chatElements.overlay) {
        return;
    }
    chatElements.overlay.classList.add('active');
    chatElements.overlay.setAttribute('aria-hidden', 'false');
    setTimeout(() => {
        chatElements.textarea.focus();
    }, 0);
}

function closeChatOverlay() {
    if (!chatElements.overlay) {
        return;
    }
    chatElements.overlay.classList.remove('active');
    chatElements.overlay.setAttribute('aria-hidden', 'true');
    if (chatElements.launcherInput) {
        chatElements.launcherInput.blur();
    }
}

function setChatStatus(text) {
    if (chatElements.status) {
        chatElements.status.textContent = text;
    }
}

function formatChatMessage(content) {
    const lines = content.split(/\r?\n/);
    let html = '';
    let inList = false;
    
    lines.forEach(rawLine => {
        const line = rawLine.trim();
        if (!line) {
            if (inList) {
                html += '</ul>';
                inList = false;
            }
            return;
        }
        
        if (/^[-*]\s+/.test(line)) {
            if (!inList) {
                html += '<ul>';
                inList = true;
            }
            const text = line.replace(/^[-*]\s+/, '');
            html += `<li>${applyInlineFormatting(text)}</li>`;
            return;
        }
        
        if (inList) {
            html += '</ul>';
            inList = false;
        }
        
        if (/^###\s+/.test(line)) {
            html += `<h4>${applyInlineFormatting(line.replace(/^###\s+/, ''))}</h4>`;
        } else if (/^##\s+/.test(line)) {
            html += `<h3>${applyInlineFormatting(line.replace(/^##\s+/, ''))}</h3>`;
        } else if (/^#\s+/.test(line)) {
            html += `<h2>${applyInlineFormatting(line.replace(/^#\s+/, ''))}</h2>`;
        } else {
            html += `<p>${applyInlineFormatting(line)}</p>`;
        }
    });
    
    if (inList) {
        html += '</ul>';
    }
    
    return html;
}

function applyInlineFormatting(text) {
    let escaped = escapeHtml(text);
    escaped = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    escaped = escaped.replace(/\*(.+?)\*/g, '<em>$1</em>');
    return escaped;
}

function escapeHtml(str) {
    if (str == null) {
        return '';
    }
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };
    return String(str).replace(/[&<>"']/g, char => map[char]);
}

function initializeCurrencyControls() {
    currencyElements.dropdown = document.getElementById('currencyDropdown');
    currencyElements.toggle = document.getElementById('currencyToggle');
    currencyElements.menu = document.getElementById('currencyMenu');
    currencyElements.label = document.getElementById('currencyToggleLabel');
    
    ensureCurrencyRate(currencyState.selected);
    updateCurrencyRateUI();
    
    const selector = document.getElementById('currencySelector');
    const rateInput = document.getElementById('currencyRateInput');
    
    if (selector) {
        selector.addEventListener('change', () => {
            const selectedCurrency = selector.value;
            if (!currencyConfig[selectedCurrency]) {
                return;
            }
            currencyState.selected = selectedCurrency;
            ensureCurrencyRate(selectedCurrency);
            saveCurrencyState();
            updateCurrencyRateUI();
            refreshDashboardAfterCurrencyChange();
            setCurrencyMenuState(false);
        });
    }
    
    if (rateInput) {
        rateInput.addEventListener('change', () => {
            const updatedRate = sanitizeRate(rateInput.value, getCurrentCurrencyRate());
            currencyState.rates[currencyState.selected] = updatedRate;
            saveCurrencyState();
            updateCurrencyRateUI();
            refreshDashboardAfterCurrencyChange();
        });
    }
    
    if (currencyElements.toggle && currencyElements.dropdown) {
        currencyElements.toggle.addEventListener('click', (event) => {
            event.preventDefault();
            const isOpen = currencyElements.dropdown.classList.contains('open');
            setCurrencyMenuState(!isOpen);
        });
    }
    
    if (!currencyMenuListenersBound) {
        document.addEventListener('click', handleCurrencyMenuOutsideClick);
        document.addEventListener('keydown', handleCurrencyMenuKeydown);
        currencyMenuListenersBound = true;
    }
}

function updateCurrencyRateUI() {
    const selector = document.getElementById('currencySelector');
    const rateInput = document.getElementById('currencyRateInput');
    const rateSuffix = document.getElementById('currencyRateSuffix');
    const toggleLabel = currencyElements.label || document.getElementById('currencyToggleLabel');
    const rate = getCurrentCurrencyRate();
    
    if (selector && selector.value !== currencyState.selected) {
        selector.value = currencyState.selected;
    }
    if (rateInput) {
        rateInput.value = formatRateValue(rate);
    }
    if (rateSuffix) {
        rateSuffix.textContent = currencyState.selected;
    }
    if (toggleLabel) {
        toggleLabel.textContent = currencyState.selected;
        currencyElements.label = toggleLabel;
    }
}

function refreshDashboardAfterCurrencyChange() {
    if (!basePlanData) {
        return;
    }
    refreshPlanUsingCurrency();
    renderDashboard();
    refreshEditFormIfOpen();
}

function refreshPlanUsingCurrency() {
    if (!basePlanData) {
        planData = null;
        return;
    }
    planData = convertPlanData(basePlanData, getCurrentCurrencyRate());
}

function refreshEditFormIfOpen() {
    const modal = document.getElementById('editModal');
    if (modal && modal.classList.contains('active')) {
        populateEditForm();
    }
}

function convertPlanData(sourcePlan, rate) {
    if (!sourcePlan) {
        return null;
    }
    const safeRate = Number.isFinite(rate) && rate > 0 ? rate : 1;
    const converted = JSON.parse(JSON.stringify(sourcePlan));
    
    convertNumericFields(converted, [
        'target_net_worth',
        'projected_current_assets',
        'projected_savings',
        'projected_payouts',
        'total_projected_net_worth',
        'gap',
        'required_monthly_savings',
        'current_monthly_savings',
        'pre_tax_retirement_income'
    ], safeRate);
    
    if (Array.isArray(converted.year_by_year)) {
        converted.year_by_year = converted.year_by_year.map(entry => {
            const updatedEntry = { ...entry };
            convertNumericFields(updatedEntry, [
                'current_assets',
                'savings_contributions',
                'payouts_value',
                'total_net_worth',
                'target_net_worth',
                'gap'
            ], safeRate);
            return updatedEntry;
        });
    }
    
    if (converted.inputs) {
        convertNumericFields(converted.inputs, [
            'ideal_retirement_income',
            'current_asset_values',
            'monthly_savings'
        ], safeRate);
        
        if (Array.isArray(converted.inputs.payouts)) {
            converted.inputs.payouts = converted.inputs.payouts.map(payout => {
                const payoutClone = { ...payout };
                const amount = parseFloat(payoutClone.amount);
                if (Number.isFinite(amount)) {
                    payoutClone.amount = amount * safeRate;
                }
                return payoutClone;
            });
        }
    }
    
    return converted;
}

function convertNumericFields(target, fields, rate) {
    if (!target || !Array.isArray(fields)) {
        return;
    }
    fields.forEach(field => {
        if (typeof target[field] === 'number') {
            target[field] = target[field] * rate;
        } else if (typeof target[field] === 'string') {
            const parsed = parseFloat(target[field]);
            if (Number.isFinite(parsed)) {
                target[field] = parsed * rate;
            }
        }
    });
}

function convertInputsToBaseCurrency(inputs) {
    const rate = getCurrentCurrencyRate();
    if (!Number.isFinite(rate) || rate <= 0 || rate === 1) {
        return inputs;
    }
    const normalized = { ...inputs };
    ['ideal_retirement_income', 'current_asset_values', 'monthly_savings'].forEach(field => {
        const parsed = parseFloat(normalized[field]);
        if (Number.isFinite(parsed)) {
            normalized[field] = parsed / rate;
        }
    });
    normalized.payouts = Array.isArray(inputs.payouts)
        ? inputs.payouts.map(payout => {
            const payoutClone = { ...payout };
            const amount = parseFloat(payoutClone.amount);
            if (Number.isFinite(amount)) {
                payoutClone.amount = amount / rate;
            }
            return payoutClone;
        })
        : [];
    return normalized;
}

function getCurrentCurrencyRate() {
    const selected = currencyConfig[currencyState.selected] ? currencyState.selected : 'CAD';
    ensureCurrencyRate(selected);
    const rate = currencyState.rates[selected];
    return Number.isFinite(rate) && rate > 0 ? rate : 1;
}

function getCurrencyFormatter(code) {
    const currencyCode = currencyConfig[code] ? code : 'CAD';
    if (!currencyFormatters[currencyCode]) {
        const meta = currencyConfig[currencyCode];
        currencyFormatters[currencyCode] = new Intl.NumberFormat(meta.locale, {
            style: 'currency',
            currency: meta.currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
    }
    return currencyFormatters[currencyCode];
}

function formatRateValue(rate) {
    const numericRate = Number.isFinite(rate) && rate > 0 ? rate : 1;
    return numericRate.toFixed(2);
}

function sanitizeRate(value, fallback) {
    const parsed = typeof value === 'number' ? value : parseFloat(value);
    if (Number.isFinite(parsed) && parsed > 0) {
        return parseFloat(parsed.toFixed(2));
    }
    const safeFallback = Number.isFinite(fallback) && fallback > 0 ? fallback : 1;
    return parseFloat(safeFallback.toFixed(2));
}

function ensureCurrencyRate(currencyCode) {
    const meta = currencyConfig[currencyCode] || currencyConfig.CAD;
    if (!currencyState.rates) {
        currencyState.rates = {};
    }
    const currentRate = currencyState.rates[currencyCode];
    if (!Number.isFinite(currentRate) || currentRate <= 0) {
        currencyState.rates[currencyCode] = meta.defaultRate || 1;
    }
}

function loadCurrencyState() {
    const defaults = getDefaultCurrencyState();
    try {
        if (typeof localStorage === 'undefined') {
            return defaults;
        }
        const stored = localStorage.getItem(CURRENCY_STORAGE_KEY);
        if (!stored) {
            return defaults;
        }
        const parsed = JSON.parse(stored);
        const selected = currencyConfig[parsed.selected] ? parsed.selected : defaults.selected;
        const rates = { ...defaults.rates };
        if (parsed.rates) {
            Object.keys(parsed.rates).forEach(code => {
                const parsedRate = parseFloat(parsed.rates[code]);
                if (currencyConfig[code] && Number.isFinite(parsedRate) && parsedRate > 0) {
                    rates[code] = parsedRate;
                }
            });
        }
        return {
            selected,
            rates
        };
    } catch (error) {
        console.warn('Unable to load currency preferences', error);
        return defaults;
    }
}

function saveCurrencyState() {
    try {
        if (typeof localStorage === 'undefined') {
            return;
        }
        localStorage.setItem(CURRENCY_STORAGE_KEY, JSON.stringify(currencyState));
    } catch (error) {
        console.warn('Unable to save currency preferences', error);
    }
}

function getDefaultCurrencyState() {
    const rates = {};
    Object.keys(currencyConfig).forEach(code => {
        rates[code] = currencyConfig[code].defaultRate;
    });
    return {
        selected: 'CAD',
        rates
    };
}

function setCurrencyMenuState(isOpen) {
    const dropdown = currencyElements.dropdown;
    const menu = currencyElements.menu;
    const toggle = currencyElements.toggle;
    if (!dropdown || !menu || !toggle) {
        return;
    }
    if (isOpen) {
        dropdown.classList.add('open');
        toggle.setAttribute('aria-expanded', 'true');
        menu.setAttribute('aria-hidden', 'false');
    } else {
        dropdown.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        menu.setAttribute('aria-hidden', 'true');
    }
}

function handleCurrencyMenuOutsideClick(event) {
    const dropdown = currencyElements.dropdown;
    if (!dropdown || !dropdown.classList.contains('open')) {
        return;
    }
    if (dropdown.contains(event.target)) {
        return;
    }
    setCurrencyMenuState(false);
}

function handleCurrencyMenuKeydown(event) {
    if (event.key === 'Escape') {
        setCurrencyMenuState(false);
    }
}
