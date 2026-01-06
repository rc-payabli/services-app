console.log('dashboard.js loading...');

// Initialize stub DashboardManager to prevent undefined errors when called from embedded component
if (!window.DashboardManager) {
  window.DashboardManager = {
    updateDashboard: () => console.log('DashboardManager stub: updateDashboard'),
    updateKPIs: () => console.log('DashboardManager stub: updateKPIs'),
    updateQuickStats: () => console.log('DashboardManager stub: updateQuickStats'),
    updateActivityFeed: () => console.log('DashboardManager stub: updateActivityFeed'),
    updateRevenueTrend: () => console.log('DashboardManager stub: updateRevenueTrend')
  };
  console.log('Created DashboardManager stub, window.DashboardManager:', window.DashboardManager);
}

// Initialize stub ActivityLogger to prevent undefined errors when called from embedded component
if (!window.ActivityLogger) {
  window.ActivityLogger = {
    logActivity: () => console.log('ActivityLogger stub: logActivity'),
    logEmailSent: () => console.log('ActivityLogger stub: logEmailSent'),
    logSmsSent: () => console.log('ActivityLogger stub: logSmsSent'),
    logPaymentReceived: () => console.log('ActivityLogger stub: logPaymentReceived'),
    logInvoiceCancelled: () => console.log('ActivityLogger stub: logInvoiceCancelled'),
    logPaymentFailed: () => console.log('ActivityLogger stub: logPaymentFailed'),
    logInvoiceOverdue: () => console.log('ActivityLogger stub: logInvoiceOverdue')
  };
  console.log('Created ActivityLogger stub, window.ActivityLogger:', window.ActivityLogger);
}

// Dashboard Manager
const DashboardManager = (() => {
  const updateDashboard = () => {
    updateKPIs();
    updatePaymentMethods();
    updateQuickStats();
    updateActivityFeed();
  };

  const updateKPIs = () => {
    const invoices = InvoiceManager.getAllInvoices();
    
    let totalRevenue = 0;
    let pendingAmount = 0;
    let pendingCount = 0;
    let overdueAmount = 0;
    let overdueCount = 0;
    let fullyPaidCount = 0;
    let partiallyPaidCount = 0;
    let sentCount = 0;
    let cardPayments = 0;
    let achPayments = 0;
    let cardTypes = { visa: 0, mastercard: 0, amex: 0, discover: 0, other: 0 };

    const today = new Date();

    invoices.forEach(invoice => {
      // Calculate total paid from successful payments in PaymentManager
      const payments = PaymentManager.getPaymentsByInvoice(invoice.invoiceId) || [];
      const totalPaid = payments
        .filter(p => p.status === 1) // Only successful payments
        .reduce((sum, p) => sum + p.amount, 0);
      
      // Check if invoice is fully paid
      const isFullyPaid = invoice.invoiceStatus === 3 || 
                          (totalPaid && totalPaid >= invoice.invoiceAmount);
      
      // Check if invoice is partially paid
      const isPartiallyPaid = totalPaid && 
                              totalPaid > 0 && 
                              totalPaid < invoice.invoiceAmount;

      if (isFullyPaid) {
        totalRevenue += invoice.invoiceAmount;
        fullyPaidCount++;
        
        // Track payment method from successful payments
        if (payments.length > 0) {
          const lastSuccessfulPayment = payments.filter(p => p.status === 1).pop();
          if (lastSuccessfulPayment && lastSuccessfulPayment.paymentMethod) {
            if (lastSuccessfulPayment.paymentMethod.toLowerCase().includes('card')) {
              cardPayments++;
              // Track card type
              if (lastSuccessfulPayment.cardType) {
                const cardType = lastSuccessfulPayment.cardType.toLowerCase();
                if (cardType.includes('visa')) cardTypes.visa++;
                else if (cardType.includes('mastercard') || cardType.includes('mc')) cardTypes.mastercard++;
                else if (cardType.includes('amex')) cardTypes.amex++;
              else if (cardType.includes('discover')) cardTypes.discover++;
              else cardTypes.other++;
              }
            } else if (lastSuccessfulPayment.paymentMethod.toLowerCase().includes('ach')) {
              achPayments++;
            }
          }
        }
      } else if (isPartiallyPaid) {
        totalRevenue += totalPaid;
        partiallyPaidCount++;
        
        // Add remaining balance to pending
        const remainingBalance = invoice.invoiceAmount - totalPaid;
        const dueDate = new Date(invoice.invoiceDueDate);
        
        if (dueDate < today) {
          overdueAmount += remainingBalance;
          overdueCount++;
        } else {
          pendingAmount += remainingBalance;
          pendingCount++;
        }
      } else if (invoice.invoiceStatus === 1) {
        sentCount++;
        const dueDate = new Date(invoice.invoiceDueDate);
        
        if (dueDate < today) {
          overdueAmount += invoice.invoiceAmount;
          overdueCount++;
        } else {
          pendingAmount += invoice.invoiceAmount;
          pendingCount++;
        }
      }
    });

    // Update total revenue
    document.getElementById('kpi-total-revenue').textContent = formatCurrency(totalRevenue);

    // Update pending (including remaining balance from partially paid invoices)
    document.getElementById('kpi-pending').textContent = formatCurrency(pendingAmount);
    document.getElementById('kpi-pending-count').textContent = pendingCount;

    // Update overdue (including remaining balance from partially paid invoices)
    document.getElementById('kpi-overdue').textContent = formatCurrency(overdueAmount);
    if (overdueCount === 0) {
      document.getElementById('kpi-overdue-days').textContent = 'No overdue invoices';
    } else {
      document.getElementById('kpi-overdue-days').textContent = `${overdueCount} overdue`;
    }

    // Update success rate (fully paid invoices / total sent)
    const totalSent = fullyPaidCount + partiallyPaidCount + sentCount;
    const successRate = totalSent > 0 ? Math.round((fullyPaidCount / totalSent) * 100) : 0;
    document.getElementById('kpi-success-rate').textContent = `${successRate}%`;
    document.getElementById('kpi-success-percent').textContent = `${successRate}% of sent invoices paid`;

    // Update trend indicator
    const trendElement = document.getElementById('kpi-success-trend');
    trendElement.classList.remove('positive', 'negative', 'neutral');
    if (successRate >= 80) {
      trendElement.classList.add('positive');
      trendElement.querySelector('span:first-child').textContent = '↑';
    } else if (successRate < 40) {
      trendElement.classList.add('negative');
      trendElement.querySelector('span:first-child').textContent = '↓';
    } else {
      trendElement.classList.add('neutral');
      trendElement.querySelector('span:first-child').textContent = '↔';
    }

    // Store payment method data for use in chart
    window.paymentMethodData = {
      cardPayments,
      achPayments,
      cardTypes
    };
  };

  const updatePaymentMethods = () => {
    // Update Revenue Trend chart
    updateRevenueTrendChart();
    
    // Update Payment Acceptance visualization
    updatePaymentAcceptanceChart();
  };

  // Publicly accessible function to update revenue trend from dropdown
  const updateRevenueTrend = () => {
    updateRevenueTrendChart();
  };

  const updateRevenueTrendChart = async () => {
    const ctx = document.getElementById('revenueTrendChart');
    if (!ctx) return;
    
    // Destroy existing chart if it exists
    if (window.revenueTrendChartInstance) {
      window.revenueTrendChartInstance.destroy();
    }
    
    // Clear any existing overlay messages
    const container = ctx.parentElement;
    const existingOverlay = container.querySelector('.chart-overlay-message');
    if (existingOverlay) {
      existingOverlay.remove();
    }
    
    // Check if config is set
    if (!Config.isConfigured()) {
      renderEmptyChart(ctx, 'Configure API credentials to view statistics');
      return;
    }
    
    // Get selected time period from dropdown
    const periodSelect = document.getElementById('revenue-trend-period');
    const mode = periodSelect ? periodSelect.value : 'd30';
    
    // Determine frequency based on mode
    let freq = 'd'; // daily by default
    if (mode === 'm12' || mode === 'ytd' || mode === 'lasty') {
      freq = 'm'; // monthly for longer periods
    } else if (mode === 'h24') {
      freq = 'h'; // hourly for 24 hours
    }
    
    // Show loading state
    const originalContent = container.innerHTML;
    container.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 200px; color: var(--text-muted);">Loading...</div>';
    
    try {
      // Fetch statistics from Payabli API
      const response = await APIClient.getStatistics(mode, freq);
      
      // Restore canvas
      container.innerHTML = originalContent;
      const newCtx = document.getElementById('revenueTrendChart');
      
      // Clear any overlay from previous renders
      const overlay = container.querySelector('.chart-overlay-message');
      if (overlay) overlay.remove();
      
      console.log('Statistics API response:', response);
      
      if (!response || !Array.isArray(response) || response.length === 0) {
        // No data available
        renderEmptyChart(newCtx, 'No revenue data available');
        return;
      }
      
      // Process the response data
      const labels = [];
      const data = [];
      
      response.forEach(item => {
        console.log('Processing stat item:', item);
        // statX contains the period label (e.g., "2024-01", "2024-01-15", "20260105h14")
        let label = item.statX || '';
        
        // Format label based on frequency
        if (freq === 'm') {
          // Monthly: show month name
          const [year, month] = label.split('-');
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          label = monthNames[parseInt(month) - 1] || label;
        } else if (freq === 'd') {
          // Daily: show MM/DD format
          const parts = label.split('-');
          if (parts.length >= 3) {
            label = `${parts[1]}/${parts[2]}`;
          }
        } else if (freq === 'h') {
          // Hourly: extract hour and show as HH:00
          // Format from API is like "20260105h14" or similar
          const hourMatch = label.match(/h(\d+)$/);
          if (hourMatch) {
            const hour = hourMatch[1].padStart(2, '0');
            label = `${hour}:00`;
          } else if (label.includes(':')) {
            // Alternative format like "14:00"
            label = label.substring(0, 5);
          }
        }
        
        labels.push(label);
        // Use inTransactionsVolume as the revenue metric (inbound payment volume)
        const volume = item.inTransactionsVolume || 0;
        console.log(`Label: ${label}, Volume: ${volume}`);
        data.push(volume);
      });
      
      // Create the chart
      window.revenueTrendChartInstance = new Chart(newCtx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'Revenue',
            data: data,
            borderColor: '#4f46e5',
            backgroundColor: 'rgba(79, 70, 229, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#4f46e5',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointRadius: data.length > 15 ? 2 : 4,
            pointHoverRadius: 6
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
              backgroundColor: '#1f2937',
              titleColor: '#ffffff',
              bodyColor: '#ffffff',
              padding: 12,
              displayColors: false,
              callbacks: {
                label: function(context) {
                  return '$' + context.parsed.y.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  });
                }
              }
            }
          },
          scales: {
            x: {
              grid: {
                display: false
              },
              ticks: {
                color: '#6b7280',
                font: { size: 11 },
                maxRotation: 45,
                minRotation: 0,
                maxTicksLimit: 12
              }
            },
            y: {
              beginAtZero: true,
              grid: {
                color: 'rgba(107, 114, 128, 0.1)'
              },
              ticks: {
                color: '#6b7280',
                font: { size: 11 },
                maxTicksLimit: 6,
                callback: function(value) {
                  if (value >= 1000) {
                    return '$' + (value / 1000).toFixed(value >= 10000 ? 0 : 1) + 'k';
                  }
                  return '$' + Math.round(value);
                }
              },
              afterDataLimits: function(axis) {
                // Calculate a nice step size to avoid duplicate labels
                const range = axis.max - axis.min;
                const targetSteps = 5;
                let stepSize = range / targetSteps;
                
                // Round to nice numbers
                const magnitude = Math.pow(10, Math.floor(Math.log10(stepSize)));
                const normalized = stepSize / magnitude;
                
                if (normalized <= 1) stepSize = magnitude;
                else if (normalized <= 2) stepSize = 2 * magnitude;
                else if (normalized <= 5) stepSize = 5 * magnitude;
                else stepSize = 10 * magnitude;
                
                // Ensure minimum step of 500 for small values
                if (stepSize < 500 && axis.max > 1000) {
                  stepSize = 500;
                } else if (stepSize < 100) {
                  stepSize = 100;
                }
                
                axis.options.ticks.stepSize = stepSize;
              }
            }
          }
        }
      });
      
    } catch (error) {
      console.error('Error fetching statistics:', error);
      // Restore canvas and show error
      container.innerHTML = originalContent;
      const newCtx = document.getElementById('revenueTrendChart');
      renderEmptyChart(newCtx, 'Unable to load data');
    }
  };

  const renderEmptyChart = (ctx, message) => {
    if (!ctx) return;
    
    window.revenueTrendChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [''],
        datasets: [{
          label: 'Revenue',
          data: [0],
          borderColor: '#e5e7eb',
          backgroundColor: 'rgba(229, 231, 235, 0.1)',
          borderWidth: 2,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        },
        scales: {
          x: { display: false },
          y: { display: false }
        }
      }
    });
    
    // Overlay message with class for easy removal
    const parent = ctx.parentElement;
    const overlay = document.createElement('div');
    overlay.className = 'chart-overlay-message';
    overlay.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: var(--text-muted); font-size: 0.875rem;';
    overlay.textContent = message;
    parent.style.position = 'relative';
    parent.appendChild(overlay);
  };

  const updatePaymentAcceptanceChart = () => {
    const container = document.getElementById('payment-acceptance-container');
    if (!container) return;

    // Destroy existing chart if it exists
    if (window.paymentAcceptanceChartInstance) {
      window.paymentAcceptanceChartInstance.destroy();
    }

    // Get all successful payments from PaymentManager
    const payments = PaymentManager.getAllPayments();
    const successfulPayments = payments.filter(p => p.status === 1);

    // Categorize by payment type and sum amounts
    let achAmount = 0;
    let debitAmount = 0;
    let creditAmount = 0;

    successfulPayments.forEach(payment => {
      const amount = payment.amount || 0;
      
      if (payment.paymentMethod && payment.paymentMethod.toLowerCase() === 'ach') {
        achAmount += amount;
      } else {
        // Check binCardType first (from API response), then fall back to cardType
        const cardType = (payment.binCardType || payment.cardType || '').toLowerCase();
        if (cardType === 'debit' || cardType.includes('debit')) {
          debitAmount += amount;
        } else if (cardType === 'credit' || cardType.includes('credit') || cardType === 'visa' || cardType === 'mastercard' || cardType === 'amex' || cardType === 'discover') {
          creditAmount += amount;
        } else if (cardType) {
          // Default card payments to credit if type is unknown but card exists
          creditAmount += amount;
        }
      }
    });

    const totalAmount = achAmount + debitAmount + creditAmount;
    const achPercent = totalAmount > 0 ? Math.round((achAmount / totalAmount) * 100) : 0;
    const debitPercent = totalAmount > 0 ? Math.round((debitAmount / totalAmount) * 100) : 0;
    const creditPercent = totalAmount > 0 ? Math.round((creditAmount / totalAmount) * 100) : 0;

    // Format currency helper
    const formatCurrency = (amount) => {
      return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    };

    // Create donut chart with legend below (showing amounts and percentages)
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; width: 100%; padding: 10px 0;">
        <div style="position: relative; width: 160px; height: 160px;">
          <canvas id="paymentAcceptanceDonut"></canvas>
        </div>
        <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 20px; width: 100%; max-width: 240px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="width: 10px; height: 10px; border-radius: 50%; background-color: #3b82f6;"></span>
              <span style="font-size: 13px; color: #374151;">Credit</span>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 13px; font-weight: 600; color: #111827;">${formatCurrency(creditAmount)}</span>
              <span style="font-size: 12px; color: #6b7280; margin-left: 4px;">(${creditPercent}%)</span>
            </div>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="width: 10px; height: 10px; border-radius: 50%; background-color: #10b981;"></span>
              <span style="font-size: 13px; color: #374151;">ACH</span>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 13px; font-weight: 600; color: #111827;">${formatCurrency(achAmount)}</span>
              <span style="font-size: 12px; color: #6b7280; margin-left: 4px;">(${achPercent}%)</span>
            </div>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="width: 10px; height: 10px; border-radius: 50%; background-color: #f59e0b;"></span>
              <span style="font-size: 13px; color: #374151;">Debit</span>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 13px; font-weight: 600; color: #111827;">${formatCurrency(debitAmount)}</span>
              <span style="font-size: 12px; color: #6b7280; margin-left: 4px;">(${debitPercent}%)</span>
            </div>
          </div>
        </div>
      </div>
    `;

    // Create the donut chart
    const ctx = document.getElementById('paymentAcceptanceDonut');
    if (ctx) {
      // Handle case where there's no data - use amounts for chart segments
      const chartData = totalAmount > 0 ? [creditAmount, achAmount, debitAmount] : [1];
      const chartColors = totalAmount > 0 ? ['#3b82f6', '#10b981', '#f59e0b'] : ['#e5e7eb'];
      
      window.paymentAcceptanceChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: totalAmount > 0 ? ['Credit', 'ACH', 'Debit'] : ['No Data'],
          datasets: [{
            data: chartData,
            backgroundColor: chartColors,
            borderWidth: 0,
            cutout: '70%'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              enabled: totalAmount > 0,
              backgroundColor: '#1f2937',
              titleColor: '#ffffff',
              bodyColor: '#ffffff',
              padding: 10,
              callbacks: {
                label: function(context) {
                  const label = context.label || '';
                  const value = context.parsed || 0;
                  const percentage = totalAmount > 0 ? Math.round((value / totalAmount) * 100) : 0;
                  return `${label}: $${value.toLocaleString()} (${percentage}%)`;
                }
              }
            }
          }
        }
      });
    }
  };

  const updateQuickStats = () => {
    const invoices = InvoiceManager.getAllInvoices();
    const customers = CustomerManager ? CustomerManager.getAllCustomers() : [];
    
    let paidCount = 0;
    let pendingCount = 0;
    
    invoices.forEach(invoice => {
      if (invoice.invoiceStatus === 3) {
        paidCount++;
      } else if (invoice.invoiceStatus === 1 || invoice.invoiceStatus === 2) {
        pendingCount++;
      }
    });
    
    // Update quick stat elements if they exist
    const totalCustomersEl = document.getElementById('stat-total-customers');
    const totalInvoicesEl = document.getElementById('stat-total-invoices');
    const paidInvoicesEl = document.getElementById('stat-paid-invoices');
    const pendingInvoicesEl = document.getElementById('stat-pending-invoices');
    
    if (totalCustomersEl) totalCustomersEl.textContent = customers.length;
    if (totalInvoicesEl) totalInvoicesEl.textContent = invoices.length;
    if (paidInvoicesEl) paidInvoicesEl.textContent = paidCount;
    if (pendingInvoicesEl) pendingInvoicesEl.textContent = pendingCount;
  };

  const updateActivityFeed = () => {
    const invoices = InvoiceManager.getAllInvoices();
    const activityFeed = document.getElementById('activity-feed');
    
    if (!activityFeed) return;
    
    if (invoices.length === 0) {
      activityFeed.innerHTML = `
        <div class="activity-empty">
          <div class="activity-empty-icon">📋</div>
          <div>No activity yet</div>
          <div style="font-size: 0.75rem; margin-top: 4px; color: var(--text-muted);">Create customers and invoices to see activity here</div>
        </div>
      `;
      return;
    }

    // Combine invoice creation events and logged activities
    const allActivities = [];
    
    // Helper to get customer name from invoice number
    const getCustomerName = (invoiceNumber) => {
      const invoice = invoices.find(inv => inv.invoiceNumber === invoiceNumber);
      return invoice?.customerName || 'Customer';
    };
    
    // Add invoice creation events
    invoices.forEach(invoice => {
      const createdDate = new Date(invoice.createdAt || invoice.invoiceDate);
      
      allActivities.push({
        timestamp: createdDate.getTime(),
        title: `Invoice created`,
        subtitle: `#${invoice.invoiceNumber}`,
        customerName: invoice.customerName || 'Customer',
        type: 'invoice_created'
      });
    });
    
    // Add logged activities (payments, emails, SMS, failed attempts)
    const loggedActivities = JSON.parse(localStorage.getItem('app_activities') || '[]');
    loggedActivities.forEach(activity => {
      let title = '';
      let subtitle = '';
      const customerName = getCustomerName(activity.invoiceNumber);
      
      switch(activity.type) {
        case 'email_sent':
          title = `Email sent`;
          subtitle = `#${activity.invoiceNumber}`;
          break;
        case 'sms_sent':
          title = `SMS sent`;
          subtitle = `#${activity.invoiceNumber}`;
          break;
        case 'invoice_cancelled':
          title = `Invoice cancelled`;
          subtitle = `#${activity.invoiceNumber}`;
          break;
        case 'payment_failed':
          title = `Payment failed`;
          subtitle = `#${activity.invoiceNumber}`;
          break;
        case 'payment_received':
          title = `Payment received`;
          subtitle = `$${activity.amount.toFixed(2)} - #${activity.invoiceNumber}`;
          break;
        case 'overdue':
          title = `Invoice overdue`;
          subtitle = `#${activity.invoiceNumber}`;
          break;
        default:
          title = `Activity`;
          subtitle = `#${activity.invoiceNumber}`;
      }
      
      allActivities.push({
        timestamp: new Date(activity.timestamp).getTime(),
        title: title,
        subtitle: subtitle,
        customerName: customerName,
        type: activity.type
      });
    });
    
    // Sort by most recent
    allActivities.sort((a, b) => b.timestamp - a.timestamp);

    let html = '';
    const items = allActivities.slice(0, 8);
    
    if (items.length > 0) {
      html = '<div class="activity-timeline">';
      
      items.forEach(activity => {
        const createdDate = new Date(activity.timestamp);
        const timeAgo = getTimeAgo(createdDate);
        
        // Determine class based on activity type
        let activityClass = 'activity-invoice'; // default
        if (activity.type === 'payment_received') {
          activityClass = 'activity-payment';
        } else if (activity.type === 'payment_failed' || activity.type === 'overdue' || activity.type === 'invoice_cancelled') {
          activityClass = 'activity-cancelled';
        } else if (activity.type === 'email_sent' || activity.type === 'sms_sent') {
          activityClass = 'activity-email';
        } else if (activity.type === 'customer_created') {
          activityClass = 'activity-customer';
        }

        html += `
          <div class="activity-timeline-item ${activityClass}">
            <div class="activity-timeline-title">${activity.title}</div>
            <div class="activity-timeline-detail">${activity.subtitle}</div>
            <div class="activity-timeline-customer">${activity.customerName}</div>
            <div class="activity-timeline-time">${timeAgo}</div>
          </div>
        `;
      });
      
      html += '</div>';
    }

    if (html === '') {
      html = `
        <div class="activity-empty">
          <div class="activity-empty-icon">📋</div>
          <div>No activity yet</div>
        </div>
      `;
    }

    activityFeed.innerHTML = html;
  };

  const getTimeAgo = (date) => {
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
    return date.toLocaleDateString();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  return {
    updateDashboard,
    updateKPIs,
    updateQuickStats,
    updateActivityFeed,
    updateRevenueTrend
  };
})();

// Expose DashboardManager to window for use in other files
window.DashboardManager = DashboardManager;

// Activity Logger - tracks events across the app
const ActivityLogger = (() => {
  const logActivity = (type, invoiceNumber, amount, details = '') => {
    console.log(`ActivityLogger.logActivity called: type=${type}, invoiceNumber=${invoiceNumber}`);
    const invoice = InvoiceManager.getAllInvoices().find(inv => inv.invoiceNumber === invoiceNumber);
    console.log(`Invoice lookup result:`, invoice);
    if (!invoice) {
      console.warn(`Invoice not found for activity logging: ${invoiceNumber}`);
      return;
    }

    // Store activity in a simple list (could be enhanced with backend storage)
    const activities = JSON.parse(localStorage.getItem('app_activities') || '[]');
    
    const activity = {
      id: Date.now(),
      type: type, // 'email_sent', 'sms_sent', 'payment_received', 'invoice_cancelled', 'payment_failed', 'overdue'
      invoiceNumber: invoiceNumber,
      amount: amount,
      details: details,
      timestamp: new Date().toISOString()
    };
    
    console.log(`Logging activity:`, activity);
    activities.unshift(activity); // Add to beginning
    localStorage.setItem('app_activities', JSON.stringify(activities.slice(0, 100))); // Keep last 100
    console.log(`Activity saved to localStorage`);
    
    // Refresh activity feed immediately
    if (window.DashboardManager) {
      console.log(`Calling DashboardManager.updateActivityFeed()`);
      window.DashboardManager.updateActivityFeed();
    } else {
      console.warn('DashboardManager not available for activity feed update');
    }
  };

  return {
    logActivity,
    logEmailSent: (invoiceNumber, email) => logActivity('email_sent', invoiceNumber, 0, `Email sent to ${email}`),
    logSmsSent: (invoiceNumber, phone) => logActivity('sms_sent', invoiceNumber, 0, `SMS sent to ${phone}`),
    logPaymentReceived: (invoiceNumber, amount, isPartial = false) => {
      const suffix = isPartial ? ' (partial)' : '';
      logActivity('payment_received', invoiceNumber, amount, suffix);
    },
    logInvoiceCancelled: (invoiceNumber) => logActivity('invoice_cancelled', invoiceNumber, 0, 'Invoice cancelled'),
    logPaymentFailed: (invoiceNumber, reason) => logActivity('payment_failed', invoiceNumber, 0, `Failed: ${reason}`),
    logInvoiceOverdue: (invoiceNumber) => logActivity('overdue', invoiceNumber, 0, 'Invoice overdue')
  };
})();

// Expose ActivityLogger to window for use in other files
window.ActivityLogger = ActivityLogger;

// Refresh dashboard when data changes
const refreshDashboard = () => {
  const activeSection = document.querySelector('.section.active');
  if (activeSection && activeSection.id === 'section-dashboard') {
    if (window.DashboardManager) {
      window.DashboardManager.updateDashboard();
    }
  }
};