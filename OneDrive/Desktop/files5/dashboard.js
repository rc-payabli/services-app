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
        // statX contains the period label (e.g., "2024-01", "2024-01-15", "14:00")
        let label = item.statX || '';
        
        // Format label based on frequency
        if (freq === 'm') {
          // Monthly: show month name
          const [year, month] = label.split('-');
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          label = monthNames[parseInt(month) - 1] || label;
        } else if (freq === 'd') {
          // Daily: show day/month
          const parts = label.split('-');
          if (parts.length >= 3) {
            label = `${parts[2]}/${parts[1]}`;
          }
        } else if (freq === 'h') {
          // Hourly: show hour
          label = label.includes(':') ? label.split(':')[0] + 'h' : label;
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
                callback: function(value) {
                  if (value >= 1000) {
                    return '$' + (value / 1000).toFixed(0) + 'k';
                  }
                  return '$' + value;
                }
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

    // Get all successful payments from PaymentManager
    const payments = PaymentManager.getAllPayments();
    const successfulPayments = payments.filter(p => p.status === 1);

    // Categorize by payment type
    let ach = 0;
    let debit = 0;
    let credit = 0;

    successfulPayments.forEach(payment => {
      if (payment.paymentMethod && payment.paymentMethod.toLowerCase() === 'ach') {
        ach++;
      } else if (payment.cardType) {
        const cardType = payment.cardType.toLowerCase();
        if (cardType.includes('debit')) {
          debit++;
        } else if (cardType.includes('credit') || cardType === 'visa' || cardType === 'mastercard' || cardType === 'amex' || cardType === 'discover') {
          credit++;
        }
      }
    });

    const total = ach + debit + credit;

    // Create three circles similar to KingsCRM email marketing design
    const achPercent = total > 0 ? Math.round((ach / total) * 100) : 0;
    const debitPercent = total > 0 ? Math.round((debit / total) * 100) : 0;
    const creditPercent = total > 0 ? Math.round((credit / total) * 100) : 0;

    container.innerHTML = `
      <div style="display: flex; justify-content: center; align-items: center; gap: 30px; flex-wrap: wrap; width: 100%;">
        <!-- ACH Circle -->
        <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
          <div style="position: relative; width: 100px; height: 100px; display: flex; align-items: center; justify-content: center;">
            <svg width="100" height="100" style="transform: rotate(-90deg);">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" stroke-width="3"/>
              <circle cx="50" cy="50" r="40" fill="none" stroke="#10b981" stroke-width="3" 
                      stroke-dasharray="${(achPercent / 100) * 251.2} 251.2" 
                      stroke-linecap="round"/>
            </svg>
            <div style="position: absolute; text-align: center;">
              <div style="font-size: 20px; font-weight: 700; color: #111827;">${achPercent}%</div>
              <div style="font-size: 10px; color: #6b7280;">${ach} trans</div>
            </div>
          </div>
          <span style="font-size: 13px; font-weight: 500; color: #374151;">ACH</span>
        </div>

        <!-- Debit Circle -->
        <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
          <div style="position: relative; width: 100px; height: 100px; display: flex; align-items: center; justify-content: center;">
            <svg width="100" height="100" style="transform: rotate(-90deg);">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" stroke-width="3"/>
              <circle cx="50" cy="50" r="40" fill="none" stroke="#f59e0b" stroke-width="3" 
                      stroke-dasharray="${(debitPercent / 100) * 251.2} 251.2" 
                      stroke-linecap="round"/>
            </svg>
            <div style="position: absolute; text-align: center;">
              <div style="font-size: 20px; font-weight: 700; color: #111827;">${debitPercent}%</div>
              <div style="font-size: 10px; color: #6b7280;">${debit} trans</div>
            </div>
          </div>
          <span style="font-size: 13px; font-weight: 500; color: #374151;">Debit</span>
        </div>

        <!-- Credit Circle -->
        <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
          <div style="position: relative; width: 100px; height: 100px; display: flex; align-items: center; justify-content: center;">
            <svg width="100" height="100" style="transform: rotate(-90deg);">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" stroke-width="3"/>
              <circle cx="50" cy="50" r="40" fill="none" stroke="#3b82f6" stroke-width="3" 
                      stroke-dasharray="${(creditPercent / 100) * 251.2} 251.2" 
                      stroke-linecap="round"/>
            </svg>
            <div style="position: absolute; text-align: center;">
              <div style="font-size: 20px; font-weight: 700; color: #111827;">${creditPercent}%</div>
              <div style="font-size: 10px; color: #6b7280;">${credit} trans</div>
            </div>
          </div>
          <span style="font-size: 13px; font-weight: 500; color: #374151;">Credit</span>
        </div>
      </div>
    `;
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
    
    // Add invoice creation events
    invoices.forEach(invoice => {
      const createdDate = new Date(invoice.createdAt || invoice.invoiceDate);
      
      allActivities.push({
        timestamp: createdDate.getTime(),
        title: `Invoice created`,
        subtitle: `#${invoice.invoiceNumber} - ${invoice.customerName || 'Customer'}`,
        type: 'invoice_created'
      });
    });
    
    // Add logged activities (payments, emails, SMS, failed attempts)
    const loggedActivities = JSON.parse(localStorage.getItem('app_activities') || '[]');
    loggedActivities.forEach(activity => {
      let title = '';
      let subtitle = '';
      switch(activity.type) {
        case 'email_sent':
          title = `Email sent`;
          subtitle = `Invoice #${activity.invoiceNumber}`;
          break;
        case 'sms_sent':
          title = `SMS sent`;
          subtitle = `Invoice #${activity.invoiceNumber}`;
          break;
        case 'invoice_cancelled':
          title = `Invoice cancelled`;
          subtitle = `#${activity.invoiceNumber}`;
          break;
        case 'payment_failed':
          title = `Payment failed`;
          subtitle = `Invoice #${activity.invoiceNumber}`;
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
          subtitle = `Invoice #${activity.invoiceNumber}`;
      }
      
      allActivities.push({
        timestamp: new Date(activity.timestamp).getTime(),
        title: title,
        subtitle: subtitle,
        type: activity.type
      });
    });
    
    // Sort by most recent
    allActivities.sort((a, b) => b.timestamp - a.timestamp);

    let html = '';
    allActivities.slice(0, 6).forEach(activity => {
      const createdDate = new Date(activity.timestamp);
      const timeAgo = getTimeAgo(createdDate);
      
      // Determine icon and class based on activity type
      let iconClass = 'invoice';
      let icon = '📄';
      if (activity.type === 'payment_received') {
        iconClass = 'payment';
        icon = '💰';
      } else if (activity.type === 'payment_failed') {
        iconClass = 'failed';
        icon = '❌';
      } else if (activity.type === 'overdue') {
        iconClass = 'overdue';
        icon = '⚠️';
      } else if (activity.type === 'email_sent' || activity.type === 'sms_sent') {
        iconClass = 'customer';
        icon = '✉️';
      } else if (activity.type === 'invoice_cancelled') {
        iconClass = 'failed';
        icon = '🚫';
      }

      html += `
        <div class="activity-item">
          <div class="activity-icon ${iconClass}">${icon}</div>
          <div class="activity-details">
            <div class="activity-title">${activity.title}</div>
            <div class="activity-subtitle">${activity.subtitle}</div>
          </div>
          <div class="activity-time">${timeAgo}</div>
        </div>
      `;
    });

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