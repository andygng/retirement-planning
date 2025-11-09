let planData = null;
let charts = {};

// Load plan data from sessionStorage
document.addEventListener('DOMContentLoaded', () => {
    const storedData = sessionStorage.getItem('retirementPlan');
    if (storedData) {
        planData = JSON.parse(storedData);
        renderDashboard();
    } else {
        // No data, redirect to welcome page
        window.location.href = '/';
    }
    
    // Edit button
    document.getElementById('editBtn').addEventListener('click', openEditModal);
    document.getElementById('closeModal').addEventListener('click', closeEditModal);
    document.getElementById('cancelEdit').addEventListener('click', closeEditModal);
    document.getElementById('saveEdit').addEventListener('click', saveAndRecalculate);
    
    // Restart button
    document.getElementById('restartBtn').addEventListener('click', () => {
        sessionStorage.clear();
        window.location.href = '/';
    });
});

function renderDashboard() {
    const container = document.getElementById('dashboardContent');
    
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
                    your assumed ${(planData.inputs.cagr * 100).toFixed(1)}% annual growth rate.</li>
            </ul>
        </div>
    `;
    
    // Assumptions
    html += `
        <div class="commentary-item">
            <h3>Important Assumptions</h3>
            <p>This plan is based on the following assumptions:</p>
            <ul>
                <li>Annual growth rate (CAGR) of ${(planData.inputs.cagr * 100).toFixed(1)}%</li>
                <li>Withdrawal rate of ${(planData.inputs.withdrawal_rate * 100).toFixed(1)}% annually</li>
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
    const yearByYear = planData.year_by_year;
    
    let html = `
        <table>
            <thead>
                <tr>
                    <th>Year</th>
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
                <td>${year.year}</td>
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

function openEditModal() {
    const modal = document.getElementById('editModal');
    const form = document.getElementById('editForm');
    const inputs = planData.inputs;
    
    form.innerHTML = `
        <div class="form-group">
            <label>Ideal Monthly Retirement Income ($)</label>
            <input type="number" id="edit_ideal_retirement_income" value="${inputs.ideal_retirement_income}" min="0" step="100">
        </div>
        <div class="form-group">
            <label>Ideal Retirement Age</label>
            <input type="number" id="edit_ideal_retirement_age" value="${inputs.ideal_retirement_age}" min="1" max="100">
        </div>
        <div class="form-group">
            <label>Withdrawal Rate (%)</label>
            <input type="number" id="edit_withdrawal_rate" value="${inputs.withdrawal_rate}" min="0.1" max="10" step="0.1">
        </div>
        <div class="form-group">
            <label>Current Age</label>
            <input type="number" id="edit_current_age" value="${inputs.current_age}" min="1" max="100">
        </div>
        <div class="form-group">
            <label>Current Monthly Income ($)</label>
            <input type="number" id="edit_current_monthly_income" value="${inputs.current_monthly_income}" min="0" step="100">
        </div>
        <div class="form-group">
            <label>Current Asset Values ($)</label>
            <input type="number" id="edit_current_asset_values" value="${inputs.current_asset_values}" min="0" step="1000">
        </div>
        <div class="form-group">
            <label>Expected Annual Growth Rate (CAGR %)</label>
            <input type="number" id="edit_cagr" value="${inputs.cagr}" min="-100" max="100" step="0.1">
        </div>
        <div class="form-group">
            <label>Monthly Savings for Retirement ($)</label>
            <input type="number" id="edit_monthly_savings" value="${inputs.monthly_savings}" min="0" step="100">
        </div>
        <div class="form-group">
            <label>Working Years Tax Rate (%)</label>
            <input type="number" id="edit_working_tax_rate" value="${inputs.working_tax_rate}" min="0" max="100" step="0.1">
        </div>
    `;
    
    modal.classList.add('active');
}

function closeEditModal() {
    document.getElementById('editModal').classList.remove('active');
}

function saveAndRecalculate() {
    const inputs = {
        ideal_retirement_income: parseFloat(document.getElementById('edit_ideal_retirement_income').value),
        ideal_retirement_age: parseInt(document.getElementById('edit_ideal_retirement_age').value),
        withdrawal_rate: parseFloat(document.getElementById('edit_withdrawal_rate').value),
        current_age: parseInt(document.getElementById('edit_current_age').value),
        current_monthly_income: parseFloat(document.getElementById('edit_current_monthly_income').value),
        current_asset_values: parseFloat(document.getElementById('edit_current_asset_values').value),
        cagr: parseFloat(document.getElementById('edit_cagr').value),
        monthly_savings: parseFloat(document.getElementById('edit_monthly_savings').value),
        working_tax_rate: parseFloat(document.getElementById('edit_working_tax_rate').value),
        payouts: planData.inputs.payouts || []
    };
    
    // Show loading
    document.getElementById('dashboardContent').innerHTML = '<div class="loading">Recalculating...</div>';
    closeEditModal();
    
    // Recalculate
    fetch('/api/calculate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(inputs)
    })
    .then(response => response.json())
    .then(result => {
        planData = result;
        sessionStorage.setItem('retirementPlan', JSON.stringify(result));
        renderDashboard();
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Error recalculating. Please try again.');
        renderDashboard();
    });
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-CA', {
        style: 'currency',
        currency: 'CAD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

function formatCurrencyShort(amount) {
    if (amount >= 1000000) {
        return '$' + (amount / 1000000).toFixed(1) + 'M';
    } else if (amount >= 1000) {
        return '$' + (amount / 1000).toFixed(0) + 'K';
    }
    return '$' + amount.toFixed(0);
}

