let planData = null;
let basePlanData = null;
let charts = {};
const CHAT_STORAGE_KEY = 'retirementChatHistory';
const CURRENCY_STORAGE_KEY = 'retirementCurrencyPreferences';
let donutLegendResizeObserver = null;

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
        </div>
        
        <div class="ai-copilot-section" id="aiCopilotSection">
            <div class="copilot-header">
                <h2>Summary</h2>
            </div>
            <div class="copilot-messages" id="chatMessages">
                <!-- Messages go here -->
            </div>
            <div class="copilot-input-container">
                <span class="copilot-status" id="chatStatus"></span>
                <form id="chatForm">
                    <input type="text" id="chatInput" class="copilot-input" placeholder="Ask a follow-up question..." autocomplete="off">
                    <button type="submit" class="btn-copilot-send" id="sendChatBtn" aria-label="Send">
                        <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>
                    </button>
                </form>
            </div>
        </div>
        
        <div class="charts-section">
            <div class="chart-container">
                <h2>Net Worth Projection</h2>
                <div class="chart-wrapper">
                    <canvas id="netWorthChart"></canvas>
                </div>
            </div>
            <div class="chart-container">
                <h2>Wealth Breakdown at Retirement</h2>
                <div class="chart-wrapper chart-wrapper-donut">
                    <canvas id="breakdownChart"></canvas>
                </div>
            </div>
        </div>
        
        ${renderKPICards()}
        
        <div class="commentary-section">
            <h2>Key Insights</h2>
            ${generateCommentary()}
        </div>
    `;

    container.innerHTML = html;

    // Render charts
    renderCharts();

    // Re-initialize chat if it was already initialized, or init relative to new DOM
    initializeChatAssistant();
    triggerAIAnalysis();
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

function renderKPICards() {
    if (!planData) return '';

    // Calculate additional savings needed if any
    const monthlyGap = planData.required_monthly_savings - planData.current_monthly_savings;
    const isShortfall = planData.gap < 0;

    return `
        <div class="kpi-cards">
            <div class="kpi-card">
                <div class="kpi-icon">⏳</div>
                <div class="kpi-content">
                    <div class="kpi-label">Time to Retirement</div>
                    <div class="kpi-value">${planData.years_until_retirement} Years</div>
                    <div class="kpi-sub">Age ${planData.inputs.current_age} → ${planData.inputs.ideal_retirement_age}</div>
                </div>
            </div>
            
            <div class="kpi-card">
                <div class="kpi-icon">🏦</div>
                <div class="kpi-content">
                    <div class="kpi-label">Effective Tax Rate</div>
                    <div class="kpi-value">${planData.retirement_tax_rate.toFixed(1)}%</div>
                    <div class="kpi-sub">Estimated in retirement</div>
                </div>
            </div>
            
            <div class="kpi-card ${isShortfall ? 'highlight-warning' : ''}">
                <div class="kpi-icon">${isShortfall ? '⚠️' : '✅'}</div>
                <div class="kpi-content">
                    <div class="kpi-label">${isShortfall ? 'Savings Shortfall' : 'Savings Status'}</div>
                    <div class="kpi-value">${isShortfall ? formatCurrencyShort(monthlyGap) + '/mo' : 'On Track'}</div>
                    <div class="kpi-sub">${isShortfall ? 'Additional needed' : 'Current plan sufficient'}</div>
                </div>
            </div>
        </div>
    `;
}

function getDonutLegendPosition(container) {
    if (!container) {
        return 'right';
    }
    return container.clientWidth <= 520 ? 'bottom' : 'right';
}

function applyDonutLegendLayout(chart) {
    if (!chart || !chart.options || !chart.options.plugins || !chart.options.plugins.legend) {
        return;
    }
    const container = chart.canvas ? chart.canvas.closest('.chart-container') : null;
    const nextPosition = getDonutLegendPosition(container);
    const nextAlign = nextPosition === 'bottom' ? 'start' : 'center';
    const legendOptions = chart.options.plugins.legend;

    if (legendOptions.position === nextPosition && legendOptions.align === nextAlign) {
        return;
    }

    legendOptions.position = nextPosition;
    legendOptions.align = nextAlign;
    chart.update('none');
}

function observeDonutLegendContainer(chart) {
    if (donutLegendResizeObserver) {
        donutLegendResizeObserver.disconnect();
        donutLegendResizeObserver = null;
    }

    if (!chart || !chart.canvas || typeof ResizeObserver === 'undefined') {
        return;
    }

    const container = chart.canvas.closest('.chart-container');
    if (!container) {
        return;
    }

    donutLegendResizeObserver = new ResizeObserver(() => {
        applyDonutLegendLayout(chart);
    });
    donutLegendResizeObserver.observe(container);
}

function renderCharts() {
    if (donutLegendResizeObserver) {
        donutLegendResizeObserver.disconnect();
        donutLegendResizeObserver = null;
    }

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
                    backgroundColor: 'rgba(16, 185, 129, 0.05)',
                    fill: true,
                    borderDash: [5, 5],
                    tension: 0.4,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    align: 'end',
                    labels: {
                        boxWidth: 10,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function (context) {
                            return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
                        }
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        borderDash: [2, 4],
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        callback: function (value) {
                            return formatCurrencyShort(value);
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });

    // Wealth Breakdown Donut Chart
    const breakdownCtx = document.getElementById('breakdownChart').getContext('2d');
    const breakdownContainer = breakdownCtx.canvas ? breakdownCtx.canvas.closest('.chart-container') : null;
    const initialLegendPosition = getDonutLegendPosition(breakdownContainer);
    if (charts.breakdown) {
        charts.breakdown.destroy();
    }

    // Prepare data for donut
    const breakdownData = [
        Math.max(0, planData.projected_current_assets),
        Math.max(0, planData.projected_savings),
        Math.max(0, planData.projected_payouts)
    ];

    charts.breakdown = new Chart(breakdownCtx, {
        type: 'doughnut',
        data: {
            labels: ['Current Assets Growth', 'Future Savings', 'One-time Payouts'],
            datasets: [{
                data: breakdownData,
                backgroundColor: [
                    'rgba(102, 126, 234, 0.8)',
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(245, 158, 11, 0.8)'
                ],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: initialLegendPosition,
                    align: initialLegendPosition === 'bottom' ? 'start' : 'center',
                    labels: {
                        boxWidth: 12,
                        padding: 15,
                        font: {
                            family: "'Space Grotesk', sans-serif",
                            size: 11
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const value = context.parsed;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                            return `${context.label}: ${formatCurrencyShort(value)} (${percentage}%)`;
                        }
                    }
                }
            },
            cutout: '70%'
        }
    });

    applyDonutLegendLayout(charts.breakdown);
    observeDonutLegendContainer(charts.breakdown);
}

function generateCommentary() {
    if (!planData || !planData.inputs) return '';

    const gap = planData.gap;
    const isSurplus = gap >= 0;
    const monthlyGap = planData.required_monthly_savings - planData.current_monthly_savings;

    let html = `
        <div class="insights-grid">
            <div class="insight-item">
                <h3>📉 The Bottom Line</h3>
                <p>
                    ${isSurplus
            ? `You are projected to have <strong>${formatCurrency(Math.abs(gap))} surplus</strong> above your target.`
            : `You have a projected shortfall of <strong>${formatCurrency(Math.abs(gap))}</strong>.`}
                </p>
            </div>
            
            <div class="insight-item">
                <h3>💡 Recommendation</h3>
                <p>
                    ${isSurplus
            ? "Consider retiring earlier or increasing your lifestyle budget."
            : `Try to increase monthly savings by <strong>${formatCurrency(monthlyGap)}</strong> or retire ${Math.ceil(monthlyGap / 1000)} years later.`}
                </p>
            </div>
            
            <div class="insight-item">
                <h3>🔧 Key Assumptions</h3>
                <p class="compact-text">
                    ${Number(planData.inputs.cagr).toFixed(1)}% Growth • ${Number(planData.inputs.withdrawal_rate).toFixed(1)}% Withdrawal Rate
                </p>
            </div>
        </div>
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
                <input type="number" id="edit_withdrawal_rate" value="${inputs.withdrawal_rate ? Number(inputs.withdrawal_rate).toFixed(2) : ''}" min="0.1" max="10" step="0.01">
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
                <input type="number" id="edit_cagr" value="${inputs.cagr ? Number(inputs.cagr).toFixed(2) : ''}" min="-100" max="100" step="0.01">
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

function setMobileModalScrollLock(shouldLock) {
    const isPhoneViewport = window.matchMedia && window.matchMedia('(max-width: 640px)').matches;
    if (!isPhoneViewport) {
        document.body.classList.remove('modal-open-mobile');
        return;
    }
    document.body.classList.toggle('modal-open-mobile', shouldLock);
}

function openEditModal(event) {
    if (event) {
        event.preventDefault();
    }
    const modal = document.getElementById('editModal');
    populateEditForm();
    if (modal) {
        modal.classList.add('active');
        setMobileModalScrollLock(true);
    }
}

function closeEditModal() {
    const modal = document.getElementById('editModal');
    if (modal) {
        modal.classList.remove('active');
    }
    setMobileModalScrollLock(false);
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
            basePlanData = result;
            sessionStorage.setItem('retirementPlan', JSON.stringify(result));
            refreshDashboardAfterCurrencyChange();
            if (chatInitialized) {
                setChatStatus('Plan updated. Ask what changed.');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            const message = typeof error === 'string' ? error : (error.message || 'An unknown error occurred');
            alert(`We couldn’t update your plan. ${message} Please try again.`);
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
        return `${sign}${symbol}${(absolute / 1000000).toFixed(0)}M`;
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
    // Re-bind elements every time renderDashboard is called because the DOM is replaced
    chatElements.messages = document.getElementById('chatMessages');
    chatElements.form = document.getElementById('chatForm');
    chatElements.textarea = document.getElementById('chatInput'); // It's an input now, but keeping var name
    chatElements.status = document.getElementById('chatStatus');
    chatElements.sendBtn = document.getElementById('sendChatBtn');

    if (!chatElements.form || !chatElements.messages) {
        return;
    }

    // Unbind previous event listeners to avoid duplicates if any (though innerHTML replacement usually kills them)
    // We'll just bind new ones.
    chatElements.form.removeEventListener('submit', handleChatSubmit);
    chatElements.form.addEventListener('submit', handleChatSubmit);

    // Initial message is handled by triggerAIAnalysis
    // But if we have history that is NOT the initial analysis, we might want to keep it?
    // For now, let's clear and re-analyze on dashboard refresh to keep context fresh with new numbers.
    chatHistory = [];
    // renderChatMessages(); // Will be called by triggerAIAnalysis
}

function triggerAIAnalysis() {
    if (!chatElements.messages) return;

    chatElements.messages.innerHTML = ''; // Clear previous
    chatElements.messages.innerHTML = ''; // Clear previous
    showTypingIndicator();

    // Add a temporary "Thinking..." message or just wait for stream/response
    // slightly different behavior than standard user chat

    const analysisPrompt = "Provide a single, conversational sentence summarizing the high-level result of this retirement plan. Be extremely concise and encouraging. Avoid detailed bullet points.";

    chatIsSending = true;
    if (chatElements.sendBtn) chatElements.sendBtn.disabled = true;

    fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message: analysisPrompt,
            plan_data: planData
        })
    })
        .then(response => response.json())
        .then(result => {
            if (result.response) {
                removeTypingIndicator();
                addChatMessage('assistant', result.response);
            } else {
                removeTypingIndicator();
                addChatMessage('assistant', "I couldn't analyze the plan right now. Try asking a question below.");
            }
        })
        .catch(err => {
            console.error(err);
            removeTypingIndicator();
            addChatMessage('error', 'Analysis failed.');
        })
        .finally(() => {
            chatIsSending = false;
            if (chatElements.sendBtn) chatElements.sendBtn.disabled = false;
        });
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
    showTypingIndicator();
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
            removeTypingIndicator();
            if (result.response) {
                addChatMessage('assistant', result.response);
            } else {
                const errorMessage = result.error || 'Something went wrong.';
                addChatMessage('error', errorMessage);
                if (result.details) {
                    console.warn('Chat error details:', result.details);
                }
            }
        })
        .catch(() => {
            removeTypingIndicator();
            addChatMessage('error', 'Network error. Please try again.');
        })
        .finally(() => {
            chatIsSending = false;
            if (chatElements.sendBtn) {
                chatElements.sendBtn.disabled = false;
            }
        });
}




function showTypingIndicator() {
    if (!chatElements.messages) return;

    // Check if already showing
    if (document.getElementById('typing-indicator')) return;

    const indicatorHtml = `
        <div class="typing-indicator" id="typing-indicator">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        </div>
    `;

    const wrapper = document.createElement('div');
    wrapper.style.alignSelf = 'flex-start'; // Align left
    wrapper.innerHTML = indicatorHtml;
    chatElements.messages.appendChild(wrapper);
    chatElements.messages.scrollTop = chatElements.messages.scrollHeight;
}

function removeTypingIndicator() {
    const indicators = document.querySelectorAll('#typing-indicator');
    indicators.forEach(el => {
        // Remove the parent wrapper we added or the element itself if direct
        if (el.parentElement && el.parentElement.parentElement === chatElements.messages) {
            el.parentElement.remove();
        } else {
            el.remove();
        }
    });
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
