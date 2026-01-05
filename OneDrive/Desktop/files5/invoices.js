// Invoice Management Module
const InvoiceManager = (() => {
  let invoices = [];

  // Generate invoice number in format: INV-2026-0102-123456
  const generateInvoiceNumber = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    // Generate a 6-digit number that doesn't exist yet
    let randomNum = Math.floor(Math.random() * 900000) + 100000;
    
    // Check if this number already exists for today
    const todayPrefix = `INV-${year}-${month}${day}`;
    let attempts = 0;
    
    while (invoices.some(inv => inv.invoiceNumber.startsWith(todayPrefix) && 
           inv.invoiceNumber.endsWith(randomNum.toString())) && attempts < 100) {
      randomNum = Math.floor(Math.random() * 900000) + 100000;
      attempts++;
    }
    
    return `INV-${year}-${month}${day}-${randomNum}`;
  };

  // Initialize invoices from localStorage
  const init = () => {
    const stored = localStorage.getItem('field-services-invoices');
    if (stored) {
      try {
        invoices = JSON.parse(stored);
      } catch (e) {
        console.warn('Failed to parse stored invoices:', e);
        invoices = [];
      }
    }
  };

  // Save invoices to localStorage
  const save = () => {
    localStorage.setItem('field-services-invoices', JSON.stringify(invoices));
  };

  // Create invoice
  const createInvoice = async (invoiceData) => {
    try {
      const apiResponse = await APIClient.createInvoice(invoiceData);

      if (!apiResponse.isSuccess) {
        throw new Error(apiResponse.responseText || 'Failed to create invoice');
      }

      const invoiceId = apiResponse.responseData;

      // Store locally with metadata
      const invoice = {
        id: invoiceId,
        invoiceId: invoiceId,
        invoiceNumber: invoiceData.invoiceData.invoiceNumber,
        customerId: invoiceData.customerData.customerId,
        customerName: `${invoiceData.customerData.firstName} ${invoiceData.customerData.lastName}`,
        invoiceDate: invoiceData.invoiceData.invoiceDate,
        invoiceDueDate: invoiceData.invoiceData.invoiceDueDate,
        invoiceAmount: invoiceData.invoiceData.invoiceAmount,
        invoicePaidAmount: 0,
        invoiceStatus: invoiceData.invoiceData.invoiceStatus,
        paymentTerms: invoiceData.invoiceData.paymentTerms,
        items: invoiceData.invoiceData.items,
        discount: invoiceData.invoiceData.discount,
        createdAt: new Date().toISOString(),
        apiResponse: apiResponse
      };

      invoices.push(invoice);
      save();

      return invoice;
    } catch (error) {
      console.error('Error creating invoice:', error);
      throw error;
    }
  };

  // Get invoice by ID
  const getInvoice = (invoiceId) => {
    return invoices.find(i => i.invoiceId === invoiceId || i.id === invoiceId);
  };

  // Get invoices by customer
  const getInvoicesByCustomer = (customerId) => {
    return invoices.filter(i => i.customerId === customerId);
  };

  // Get all invoices
  const getAllInvoices = () => {
    return [...invoices];
  };

  // Update invoice paid amount
  const updateInvoicePaid = (invoiceId, paidAmount, paymentMethod = 'card', cardType = null, maskedAccount = null) => {
    const invoice = invoices.find(i => i.invoiceId === invoiceId || i.id === invoiceId);
    if (invoice) {
      invoice.invoicePaidAmount = (invoice.invoicePaidAmount || 0) + paidAmount;
      invoice.paymentMethod = paymentMethod;
      invoice.cardType = cardType;
      invoice.maskedAccount = maskedAccount;
      
      // Update status based on payment
      if (invoice.invoicePaidAmount >= invoice.invoiceAmount) {
        invoice.invoiceStatus = 3; // Fully Paid
      } else if (invoice.invoicePaidAmount > 0) {
        invoice.invoiceStatus = 2; // Partially Paid
      }

      save();
      return invoice;
    }
    return null;
  };

  init();

  return {
    createInvoice,
    getInvoice,
    getInvoicesByCustomer,
    getAllInvoices,
    updateInvoicePaid,
    generateInvoiceNumber
  };
})();

// Invoice Form Handler
document.addEventListener('DOMContentLoaded', () => {
  const invoiceForm = document.getElementById('invoice-form');
  const messageEl = document.getElementById('invoice-message');
  const invoiceItemsContainer = document.getElementById('invoice-items-container');

  // Function to set invoice date to today
  const setInvoiceDateToday = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    console.log('Setting invoice date to:', todayStr, 'Current date object:', today);
    document.getElementById('invoice-date').value = todayStr;
    console.log('Invoice date input now contains:', document.getElementById('invoice-date').value);
  };

  // Calculate totals when amounts change
  const calculateTotals = () => {
    let subtotal = 0;

    const items = invoiceItemsContainer.querySelectorAll('.invoice-item');
    items.forEach(item => {
      const qty = parseFloat(item.querySelector('.item-qty').value) || 0;
      const cost = parseFloat(item.querySelector('.item-cost').value) || 0;
      subtotal += qty * cost;
    });

    const discount = parseFloat(document.getElementById('invoice-discount').value) || 0;
    const discountAmount = (subtotal * discount) / 100;
    const total = subtotal - discountAmount;

    document.getElementById('subtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('discount-amount').textContent = `$${discountAmount.toFixed(2)}`;
    document.getElementById('total-amount').textContent = `$${total.toFixed(2)}`;

    return {
      subtotal,
      discount,
      discountAmount,
      total
    };
  };

  // Update totals on input change
  invoiceItemsContainer.addEventListener('change', calculateTotals);
  invoiceItemsContainer.addEventListener('input', calculateTotals);
  document.getElementById('invoice-discount').addEventListener('change', calculateTotals);
  document.getElementById('invoice-discount').addEventListener('input', calculateTotals);

  // Set default invoice date to today on page load
  setInvoiceDateToday();

  // Function to calculate due date based on payment terms
  const calculateDueDate = () => {
    const invoiceDateInput = document.getElementById('invoice-date').value;
    const paymentTermsSelect = document.getElementById('payment-terms').value;
    const dueDateInput = document.getElementById('invoice-due-date');

    if (!invoiceDateInput || !paymentTermsSelect) {
      dueDateInput.value = '';
      return;
    }

    let dueDate = invoiceDateInput; // Start with invoice date as string

    if (paymentTermsSelect === 'NET30') {
      // Add 30 days using Date object
      const [year, month, day] = invoiceDateInput.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      date.setDate(date.getDate() + 30);
      const dueDateYear = date.getFullYear();
      const dueDateMonth = String(date.getMonth() + 1).padStart(2, '0');
      const dueDateDay = String(date.getDate()).padStart(2, '0');
      dueDate = `${dueDateYear}-${dueDateMonth}-${dueDateDay}`;
    } else if (paymentTermsSelect === 'EOM') {
      // End of month
      const [year, month, day] = invoiceDateInput.split('-');
      const date = new Date(parseInt(year), parseInt(month), 0); // 0 = last day of previous month
      const dueDateYear = date.getFullYear();
      const dueDateMonth = String(date.getMonth() + 1).padStart(2, '0');
      const dueDateDay = String(date.getDate()).padStart(2, '0');
      dueDate = `${dueDateYear}-${dueDateMonth}-${dueDateDay}`;
    } else if (paymentTermsSelect === 'UR') {
      // Upon Receipt - same day as invoice date
      dueDate = invoiceDateInput;
    }

    dueDateInput.value = dueDate;
    console.log(`Due date calculated for ${paymentTermsSelect}: ${dueDate}`);
  };

  // Listen for changes to invoice date and payment terms
  document.getElementById('invoice-date').addEventListener('change', calculateDueDate);
  document.getElementById('payment-terms').addEventListener('change', calculateDueDate);

  // Auto-generate invoice number
  const invoiceNumberInput = document.getElementById('invoice-number');
  invoiceNumberInput.value = InvoiceManager.generateInvoiceNumber();

  // Allow user to regenerate if needed
  invoiceNumberInput.addEventListener('focus', () => {
    // Show hint
    invoiceNumberInput.title = 'Auto-generated. Click "Generate New" to create a new one';
  });

  // Regenerate invoice number button
  const regenerateBtn = document.getElementById('regenerate-invoice-btn');
  if (regenerateBtn) {
    regenerateBtn.addEventListener('click', (e) => {
      e.preventDefault();
      invoiceNumberInput.value = InvoiceManager.generateInvoiceNumber();
      console.log('New invoice number generated:', invoiceNumberInput.value);
    });
  }

  // Submit invoice form
  invoiceForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!Config.isConfigured()) {
      showMessage(messageEl, 'Please configure your Payabli credentials first', 'error');
      return;
    }

    const customerId = document.getElementById('invoice-customer-select').value;
    if (!customerId) {
      showMessage(messageEl, 'Please select a customer', 'error');
      return;
    }

    const customer = CustomerManager.getCustomer(parseInt(customerId));
    if (!customer) {
      showMessage(messageEl, 'Selected customer not found', 'error');
      return;
    }

    const invoiceNumber = document.getElementById('invoice-number').value.trim();
    const invoiceDate = document.getElementById('invoice-date').value;
    const invoiceDueDate = document.getElementById('invoice-due-date').value;
    const paymentTerms = document.getElementById('payment-terms').value;
    const discount = parseFloat(document.getElementById('invoice-discount').value) || 0;

    // Collect items
    const items = [];
    const itemElements = invoiceItemsContainer.querySelectorAll('.invoice-item');
    
    for (const itemEl of itemElements) {
      const description = itemEl.querySelector('.item-description').value.trim();
      const qty = parseFloat(itemEl.querySelector('.item-qty').value) || 0;
      const cost = parseFloat(itemEl.querySelector('.item-cost').value) || 0;

      if (!description) {
        showMessage(messageEl, 'All items must have a description', 'error');
        return;
      }

      if (qty <= 0) {
        showMessage(messageEl, 'Item quantity must be greater than 0', 'error');
        return;
      }

      if (cost < 0) {
        showMessage(messageEl, 'Item cost cannot be negative', 'error');
        return;
      }

      items.push({
        itemProductName: description,
        itemDescription: description,
        itemQty: qty,
        itemCost: cost,
        itemTotalAmount: qty * cost,
        itemMode: 1
      });
    }

    if (items.length === 0) {
      showMessage(messageEl, 'Invoice must have at least one item', 'error');
      return;
    }

    const totals = calculateTotals();

    // Prepare invoice data for API
    const invoiceData = {
      customerData: {
        customerId: customer.customerId,
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        company: customer.company || undefined
      },
      invoiceData: {
        invoiceNumber,
        invoiceDate,
        invoiceDueDate: invoiceDueDate || undefined,
        invoiceAmount: totals.total,
        discount,
        invoiceType: 0,
        invoiceStatus: 1,
        frequency: 'onetime',
        paymentTerms: paymentTerms || undefined,
        items
      }
    };

    try {
      showMessage(messageEl, 'Creating invoice...', 'loading');

      console.log('Invoice data being sent:', JSON.stringify(invoiceData, null, 2));

      const invoice = await InvoiceManager.createInvoice(invoiceData);

      console.log('Invoice created successfully:', invoice);

      // Reset form ONLY after successful creation
      invoiceForm.reset();
      setInvoiceDateToday();
      invoiceItemsContainer.innerHTML = '<div class="invoice-item"><div class="form-row"><div class="form-group"><label for="item-description-0">Description *</label><input type="text" class="item-description" id="item-description-0" placeholder="e.g., Plumbing repair" required></div><div class="form-group"><label for="item-qty-0">Quantity *</label><input type="number" class="item-qty" id="item-qty-0" value="1" min="1" required></div><div class="form-group"><label for="item-cost-0">Unit Cost *</label><input type="number" class="item-cost" id="item-cost-0" placeholder="0.00" min="0" step="0.01" required></div></div></div>';
      calculateTotals();

      showMessage(messageEl, `Invoice "${invoiceNumber}" created successfully! (ID: ${invoice.invoiceId})`, 'success');

      // Refresh invoice display
      refreshInvoiceDisplay();

    } catch (error) {
      console.error('Invoice creation error:', error);
      const errorMessage = error.message || 'Failed to create invoice. Please try again.';
      showMessage(messageEl, errorMessage, 'error');
    }
  });
});

// Add invoice item
const addInvoiceItem = () => {
  const container = document.getElementById('invoice-items-container');
  const itemCount = container.querySelectorAll('.invoice-item').length;

  const itemHTML = `
    <div class="invoice-item">
      <div class="form-row">
        <div class="form-group">
          <label for="item-description-${itemCount}">Description *</label>
          <input type="text" class="item-description" id="item-description-${itemCount}" placeholder="e.g., Plumbing repair" required>
        </div>
        <div class="form-group">
          <label for="item-qty-${itemCount}">Quantity *</label>
          <input type="number" class="item-qty" id="item-qty-${itemCount}" value="1" min="1" required>
        </div>
        <div class="form-group">
          <label for="item-cost-${itemCount}">Unit Cost *</label>
          <input type="number" class="item-cost" id="item-cost-${itemCount}" placeholder="0.00" min="0" step="0.01" required>
        </div>
      </div>
      <button type="button" class="btn btn-small btn-danger" onclick="removeInvoiceItem(this)">Remove</button>
    </div>
  `;

  container.insertAdjacentHTML('beforeend', itemHTML);

  // Add event listeners to new inputs
  const newInputs = container.querySelectorAll('.invoice-item:last-child input');
  newInputs.forEach(input => {
    input.addEventListener('change', () => {
      const invoiceForm = document.getElementById('invoice-form');
      invoiceForm.dispatchEvent(new Event('change'));
    });
    input.addEventListener('input', () => {
      const invoiceForm = document.getElementById('invoice-form');
      invoiceForm.dispatchEvent(new Event('input'));
    });
  });
};

// Remove invoice item
const removeInvoiceItem = (button) => {
  const container = document.getElementById('invoice-items-container');
  const items = container.querySelectorAll('.invoice-item');

  if (items.length > 1) {
    button.closest('.invoice-item').remove();
    const invoiceForm = document.getElementById('invoice-form');
    invoiceForm.dispatchEvent(new Event('change'));
  } else {
    alert('Invoice must have at least one item');
  }
};

// View Invoices Handler
document.addEventListener('DOMContentLoaded', () => {
  const filterCustomerSelect = document.getElementById('filter-customer-select');
  const filterStatusSelect = document.getElementById('filter-status');
  const sortBySelect = document.getElementById('sort-by');

  const refreshInvoices = () => {
    displayInvoices();
  };

  if (filterCustomerSelect) filterCustomerSelect.addEventListener('change', refreshInvoices);
  if (filterStatusSelect) filterStatusSelect.addEventListener('change', refreshInvoices);
  if (sortBySelect) sortBySelect.addEventListener('change', refreshInvoices);
});

// Refresh invoice display
const refreshInvoiceDisplay = () => {
  displayInvoices();
};

// Helper function to format YYYY-MM-DD string as local date without timezone issues
const formatDateString = (dateStr) => {
  if (!dateStr) return '-';
  // dateStr is in format "YYYY-MM-DD", just format it directly as M/D/YYYY
  const [year, month, day] = dateStr.split('-');
  const monthNum = parseInt(month);
  const dayNum = parseInt(day);
  return `${monthNum}/${dayNum}/${year}`;
};

// Display invoices in table
const displayInvoices = () => {
  const filterCustomerSelect = document.getElementById('filter-customer-select');
  const filterStatusSelect = document.getElementById('filter-status');
  const sortBySelect = document.getElementById('sort-by');
  const tbody = document.getElementById('invoices-tbody');

  if (!tbody) return;

  const filterCustomerId = filterCustomerSelect ? filterCustomerSelect.value : '';
  const filterStatus = filterStatusSelect ? filterStatusSelect.value : '';
  const sortBy = sortBySelect ? sortBySelect.value : '';

  // Get invoices
  let displayInvoices = InvoiceManager.getAllInvoices();

  // Apply customer filter
  if (filterCustomerId) {
    displayInvoices = displayInvoices.filter(i => i.customerId === parseInt(filterCustomerId));
  }

  // Apply status filter
  if (filterStatus) {
    displayInvoices = displayInvoices.filter(i => i.invoiceStatus === parseInt(filterStatus));
  }

  // Apply sorting
  if (sortBy === 'date-desc') {
    displayInvoices.sort((a, b) => new Date(b.invoiceDate) - new Date(a.invoiceDate));
  } else if (sortBy === 'date-asc') {
    displayInvoices.sort((a, b) => new Date(a.invoiceDate) - new Date(b.invoiceDate));
  } else if (sortBy === 'amount-desc') {
    displayInvoices.sort((a, b) => b.invoiceAmount - a.invoiceAmount);
  } else if (sortBy === 'amount-asc') {
    displayInvoices.sort((a, b) => a.invoiceAmount - b.invoiceAmount);
  } else if (sortBy === 'invoice-number') {
    displayInvoices.sort((a, b) => a.invoiceNumber.localeCompare(b.invoiceNumber));
  }

  // Render table
  if (displayInvoices.length === 0) {
    tbody.innerHTML = '<tr class="empty-state"><td colspan="8">No invoices found.</td></tr>';
    return;
  }

  tbody.innerHTML = displayInvoices.map(invoice => {
    const statusMap = {
      1: { text: 'Open', class: 'status-open' },
      2: { text: 'Past Due', class: 'status-past-due' },
      3: { text: 'Paid', class: 'status-paid' }
    };

    const status = statusMap[invoice.invoiceStatus] || { text: 'Unknown', class: '' };
    const invoiceDate = formatDateString(invoice.invoiceDate);
    const dueDate = formatDateString(invoice.invoiceDueDate);

    return `
      <tr>
        <td><strong>${invoice.invoiceNumber}</strong></td>
        <td>${invoice.customerName}</td>
        <td>${invoiceDate}</td>
        <td>${dueDate}</td>
        <td>$${invoice.invoiceAmount.toFixed(2)}</td>
        <td>$${(invoice.invoicePaidAmount || 0).toFixed(2)}</td>
        <td><span class="status-badge ${status.class}">${status.text}</span></td>
        <td>
          <div class="action-buttons">
            <button class="btn btn-small btn-primary" onclick="showInvoiceDetails(${invoice.invoiceId})">View</button>
            <button class="btn btn-small btn-primary" onclick="navigateToPayment(${invoice.customerId}, ${invoice.invoiceId})">Pay</button>
            <button class="btn btn-small btn-secondary" onclick="showSendInvoiceModal(${invoice.invoiceId})">Send</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
};

// Populate payment details display
const populatePaymentDetails = (invoice) => {
  const customer = CustomerManager.getCustomer(invoice.customerId);
  
  document.getElementById('payment-invoice-number').textContent = invoice.invoiceNumber || '-';
  document.getElementById('payment-customer-name').textContent = customer ? `${customer.firstName} ${customer.lastName}` : '-';
  document.getElementById('payment-invoice-date').textContent = formatDateString(invoice.invoiceDate) || '-';
  document.getElementById('payment-invoice-amount').textContent = `$${(invoice.invoiceAmount || 0).toFixed(2)}`;
  document.getElementById('payment-invoice-paid').textContent = `$${(invoice.invoicePaidAmount || 0).toFixed(2)}`;
  
  const amountDue = (invoice.invoiceAmount || 0) - (invoice.invoicePaidAmount || 0);
  document.getElementById('payment-amount-due').textContent = `$${Math.max(0, amountDue).toFixed(2)}`;
  
  // Pre-fill payment amount with full balance due
  document.getElementById('payment-amount').value = Math.max(0, amountDue).toFixed(2);
};

// Navigate to payment section with context-aware display
const navigateToPayment = (customerId, invoiceId) => {
  const customer = CustomerManager.getCustomer(customerId);
  const invoice = InvoiceManager.getInvoice(invoiceId);
  
  if (customer && invoice) {
    // Update context header
    document.getElementById('payment-context-customer').textContent = `${customer.firstName} ${customer.lastName}`;
    document.getElementById('payment-context-invoice').textContent = invoice.invoiceNumber;
    
    // Hide customer and invoice selectors (context already shown in header)
    const selectorDiv = document.getElementById('payment-invoice-selector');
    if (selectorDiv) selectorDiv.style.display = 'none';
    
    // Set the hidden select values for reference
    document.getElementById('payment-customer-select').value = customerId;
    document.getElementById('payment-invoice-select').value = invoiceId;
    
    // Populate payment details
    populatePaymentDetails(invoice);
    
    // Show payment details section
    document.getElementById('payment-details').style.display = 'block';
    
    // Initialize embedded payment component
    if (typeof initializeEmbeddedPayment === 'function') {
      initializeEmbeddedPayment(invoice);
    }
    
    switchSection('pay-invoice');
  }
};

// Show send invoice modal
const showSendInvoiceModal = (invoiceId) => {
  const invoice = InvoiceManager.getInvoice(invoiceId);
  if (!invoice) {
    alert('Invoice not found');
    return;
  }

  const customer = CustomerManager.getCustomer(invoice.customerId);
  if (!customer) {
    alert('Customer not found');
    return;
  }

  // Check if customer has email and phone
  if (!customer.email || !customer.phone) {
    alert('Customer must have both email and phone number to send invoice');
    return;
  }

  // Populate modal with invoice details
  document.getElementById('send-invoice-number').textContent = invoice.invoiceNumber;
  document.getElementById('send-invoice-customer').textContent = invoice.customerName;
  document.getElementById('send-invoice-email').textContent = customer.email;
  document.getElementById('send-invoice-phone').textContent = customer.phone;
  
  // Store current invoice ID for sending
  window.currentSendInvoiceId = invoiceId;

  // Show modal
  const modal = document.getElementById('send-invoice-modal');
  modal.style.display = 'flex';
  
  // Clear message
  document.getElementById('send-invoice-message').innerHTML = '';
};

// Close send invoice modal
const closeSendInvoiceModal = () => {
  const modal = document.getElementById('send-invoice-modal');
  modal.style.display = 'none';
  window.currentSendInvoiceId = null;
};

// Show invoice details modal
// Populate payment history from invoice and PaymentManager
const populatePaymentHistory = (invoice) => {
  const historyTable = document.getElementById('detail-payment-history');
  
  // Get payment records from PaymentManager
  const payments = PaymentManager.getPaymentsByInvoice(invoice.invoiceId) || [];
  
  // Calculate total paid from successful payments only
  const totalPaid = payments
    .filter(p => p.status === 1) // Only successful payments
    .reduce((sum, p) => sum + p.amount, 0);
  
  const amountDue = invoice.invoiceAmount || 0;
  const remainingBalance = Math.max(0, amountDue - totalPaid);

  if (payments.length === 0) {
    // No payment attempts at all
    historyTable.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 16px;">No payment attempts yet</td></tr>';
  } else {
    // Show all payment attempts (successful and failed)
    historyTable.innerHTML = payments.map(payment => {
      const methodDisplay = formatPaymentMethod(payment.paymentMethod || invoice.paymentMethod, payment.cardType || invoice.cardType, payment.maskedAccount || invoice.maskedAccount);
      const statusBadge = payment.status === 0 
        ? `<span class="status-badge failed">Failed</span>` 
        : `<span class="status-badge paid">Approved</span>`;
      
      return `
      <tr>
        <td>${new Date(payment.createdAt).toLocaleDateString()}</td>
        <td>$${payment.amount.toFixed(2)}</td>
        <td>${methodDisplay}</td>
        <td>${statusBadge}</td>
      </tr>
    `;
    }).join('');
  }

  // Update payment summary with calculated totals from PaymentManager
  document.getElementById('detail-amount-due').textContent = `$${amountDue.toFixed(2)}`;
  document.getElementById('detail-total-paid').textContent = `$${totalPaid.toFixed(2)}`;
  document.getElementById('detail-remaining-balance').textContent = `$${remainingBalance.toFixed(2)}`;
};

// Format payment method display with card type and last 4 digits
const formatPaymentMethod = (method, cardType, maskedAccount) => {
  if (!method) return 'Unknown';
  
  if (method.toLowerCase().includes('ach')) {
    return maskedAccount ? `ACH ${maskedAccount}` : 'ACH';
  }
  
  if (method.toLowerCase().includes('card') || cardType) {
    // Capitalize card type (visa, mastercard, amex, discover)
    const cardBrand = cardType ? cardType.charAt(0).toUpperCase() + cardType.slice(1).toLowerCase() : 'Card';
    return maskedAccount ? `${cardBrand} ${maskedAccount}` : cardBrand;
  }
  
  return method;
};

const showInvoiceDetails = (invoiceId) => {
  const invoice = InvoiceManager.getInvoice(invoiceId);
  if (!invoice) {
    alert('Invoice not found');
    return;
  }

  const customer = CustomerManager.getCustomer(invoice.customerId);
  if (!customer) {
    alert('Customer not found');
    return;
  }

  // Populate customer information
  document.getElementById('detail-customer-name').textContent = invoice.customerName || '-';
  document.getElementById('detail-customer-number').textContent = customer.customerNumber || '-';
  document.getElementById('detail-customer-email').textContent = customer.email || '-';
  document.getElementById('detail-customer-phone').textContent = formatPhoneNumber(customer.phone) || '-';
  document.getElementById('detail-customer-company').textContent = customer.company || '-';
  document.getElementById('detail-customer-address').textContent = customer.address || '-';
  document.getElementById('detail-customer-city').textContent = customer.city || '-';
  document.getElementById('detail-customer-state').textContent = customer.state || '-';
  document.getElementById('detail-customer-zip').textContent = customer.zip || '-';

  // Populate invoice information
  document.getElementById('detail-invoice-number').textContent = invoice.invoiceNumber || '-';
  document.getElementById('detail-invoice-date').textContent = formatDateString(invoice.invoiceDate) || '-';
  document.getElementById('detail-invoice-due-date').textContent = formatDateString(invoice.invoiceDueDate) || '-';
  document.getElementById('detail-payment-terms').textContent = invoice.paymentTerms || '-';
  document.getElementById('detail-invoice-amount').textContent = `$${(invoice.invoiceAmount || 0).toFixed(2)}`;
  document.getElementById('detail-paid-amount').textContent = `$${(invoice.invoicePaidAmount || 0).toFixed(2)}`;
  
  const balanceDue = (invoice.invoiceAmount || 0) - (invoice.invoicePaidAmount || 0);
  document.getElementById('detail-balance-due').textContent = `$${balanceDue.toFixed(2)}`;

  // Populate payment status
  const statusMap = {
    1: { text: 'Open', class: 'open' },
    2: { text: 'Past Due', class: 'past-due' },
    3: { text: 'Paid', class: 'paid' }
  };
  const status = statusMap[invoice.invoiceStatus] || { text: 'Unknown', class: '' };
  document.getElementById('detail-payment-status').textContent = status.text;

  // Populate line items
  const itemsTable = document.getElementById('detail-items-tbody');
  if (invoice.items && invoice.items.length > 0) {
    itemsTable.innerHTML = invoice.items.map(item => `
      <tr>
        <td>${item.itemDescription || item.itemProductName || '-'}</td>
        <td>${item.itemQty || 0}</td>
        <td>$${(item.itemCost || 0).toFixed(2)}</td>
        <td>$${(item.itemTotalAmount || 0).toFixed(2)}</td>
      </tr>
    `).join('');
  } else {
    itemsTable.innerHTML = '<tr><td colspan="4" style="text-align: center;">No items</td></tr>';
  }

  // Calculate and populate summary
  const subtotal = invoice.items ? invoice.items.reduce((sum, item) => sum + (item.itemTotalAmount || 0), 0) : 0;
  const discountAmount = (subtotal * (invoice.discount || 0)) / 100;
  const total = subtotal - discountAmount;

  document.getElementById('detail-subtotal').textContent = `$${subtotal.toFixed(2)}`;
  document.getElementById('detail-discount').textContent = `$${discountAmount.toFixed(2)}`;
  document.getElementById('detail-total').textContent = `$${total.toFixed(2)}`;

  // Populate payment history and summary
  populatePaymentHistory(invoice);

  // Show modal
  const modal = document.getElementById('invoice-details-modal');
  modal.style.display = 'flex';
};

// Close invoice details modal
const closeInvoiceDetailsModal = () => {
  const modal = document.getElementById('invoice-details-modal');
  modal.style.display = 'none';
};

// Send invoice via email using Payabli API - with payment link
const sendInvoiceViaEmail = async () => {
  const invoiceId = window.currentSendInvoiceId;
  if (!invoiceId) {
    showMessage(document.getElementById('send-invoice-message'), 'Invoice ID not found', 'error');
    return;
  }

  const invoice = InvoiceManager.getInvoice(invoiceId);
  const customer = CustomerManager.getCustomer(invoice.customerId);

  if (!customer.email) {
    showMessage(document.getElementById('send-invoice-message'), 'Customer does not have an email address', 'error');
    return;
  }

  try {
    showMessage(document.getElementById('send-invoice-message'), 'Creating payment link...', 'loading');

    // Get invoice from cache
    let invoice = InvoiceManager.getInvoice(invoiceId);
    
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    // Step 1: Generate payment link from invoice
    const generatePaymentLinkUrl = `${Config.get('apiBaseUrl')}/api/PaymentLink/${invoice.invoiceId}`;
    
    const paymentLinkBody = {
      contactUs: {
        emailLabel: 'Email',
        enabled: true,
        header: 'Contact Us',
        order: 0,
        paymentIcons: true,
        phoneLabel: 'Phone'
      },
      invoices: {
        enabled: true,
        invoiceLink: {
          enabled: true,
          label: 'View Invoice',
          order: 0
        },
        order: 0,
        viewInvoiceDetails: {
          enabled: true,
          label: 'Invoice Details',
          order: 0
        }
      },
      logo: {
        enabled: true,
        order: 0
      },
      messageBeforePaying: {
        enabled: true,
        label: 'Please review your payment details',
        order: 0
      },
      notes: {
        enabled: true,
        header: 'Additional Notes',
        order: 0,
        placeholder: 'Enter any additional notes here',
        value: ''
      },
      page: {
        description: 'Complete your payment securely',
        enabled: true,
        header: 'Payment Page',
        order: 0
      },
      paymentButton: {
        enabled: true,
        label: 'Pay Now',
        order: 0
      },
      paymentMethods: {
        allMethodsChecked: true,
        enabled: true,
        header: 'Payment Methods',
        methods: {
          amex: true,
          applePay: true,
          discover: true,
          eCheck: true,
          googlePay: true,
          mastercard: true,
          visa: true
        },
        order: 0,
        settings: {
          applePay: {
            buttonStyle: 'black',
            buttonType: 'pay',
            language: 'en-US'
          },
          googlePay: {
            buttonColor: 'black',
            buttonType: 'pay',
            merchantId: 'YOUR_MERCHANT_ID'
          }
        }
      },
      review: {
        enabled: true,
        header: 'Review Payment',
        order: 0
      },
      settings: {
        color: '#667eea',
        language: 'en',
        redirectAfterApprove: true,
        redirectAfterApproveUrl: window.location.origin
      },
      scheduledOptions: {
        includePayLink: true
      }
    };

    const paymentLinkResponse = await fetch(generatePaymentLinkUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'requestToken': Config.get('apiToken')
      },
      body: JSON.stringify(paymentLinkBody)
    });

    const paymentLinkData = await paymentLinkResponse.json();

    console.log('Payment link generation response:', paymentLinkData);

    let payLinkId = null;
    
    // Check if the error is because payment link already exists (error code 3413)
    if (paymentLinkData.responseCode === 3413) {
      console.log('Payment link already exists for this invoice');
      
      // Try multiple sources for the payment link ID
      const paymentLinkMap = JSON.parse(localStorage.getItem('payment-link-map') || '{}');
      if (paymentLinkMap[invoice.invoiceId]) {
        payLinkId = paymentLinkMap[invoice.invoiceId];
        console.log('Using stored paymentLinkId from localStorage:', payLinkId);
      } else if (invoice.paymentLinkId) {
        payLinkId = invoice.paymentLinkId;
        console.log('Using paymentLinkId from invoice object:', payLinkId);
      } else if (invoice.paylinkId) {
        payLinkId = invoice.paylinkId;
        console.log('Using paylinkId from invoice:', payLinkId);
      } else {
        throw new Error('Payment link already exists but ID not found. Please try again or contact support.');
      }
    } else if (!paymentLinkResponse.ok || !paymentLinkData.isSuccess) {
      throw new Error(paymentLinkData.responseText || 'Failed to create payment link');
    } else {
      payLinkId = paymentLinkData.responseData;
      console.log('Created new payment link ID:', payLinkId);
    }
    
    if (!payLinkId) {
      throw new Error('No payment link ID returned');
    }

    // Store the payment link ID for this invoice in localStorage for future resends
    const paymentLinkMap = JSON.parse(localStorage.getItem('payment-link-map') || '{}');
    paymentLinkMap[invoice.invoiceId] = payLinkId;
    localStorage.setItem('payment-link-map', JSON.stringify(paymentLinkMap));
    console.log('Stored payment link ID in localStorage:', payLinkId);

    showMessage(document.getElementById('send-invoice-message'), 'Sending payment link via email...');

    // Step 2: Send payment link via email
    const sendPaymentLinkUrl = `${Config.get('apiBaseUrl')}/api/PaymentLink/push/${payLinkId}`;
    
    const sendPaymentLinkBody = {
      channel: 'email',
      additionalEmails: [customer.email],
      attachFile: true
    };

    const sendResponse = await fetch(sendPaymentLinkUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'requestToken': Config.get('apiToken')
      },
      body: JSON.stringify(sendPaymentLinkBody)
    });

    const sendResponseData = await sendResponse.json();

    console.log('Send payment link response:', sendResponseData);

    if (!sendResponse.ok || !sendResponseData.isSuccess) {
      throw new Error(sendResponseData.responseText || 'Failed to send payment link via email');
    }

    showMessage(document.getElementById('send-invoice-message'), 
      `Payment link sent successfully to ${customer.email}!`, 'success');

    // Log activity
    console.log('Logging email sent for invoice:', invoice.invoiceNumber);
    ActivityLogger.logEmailSent(invoice.invoiceNumber, customer.email);

    // Close modal after 3 seconds
    setTimeout(() => {
      closeSendInvoiceModal();
    }, 3000);

  } catch (error) {
    console.error('Error sending invoice via email:', error);
    const errorMessage = error.message || 'Failed to send invoice via email. Please try again.';
    showMessage(document.getElementById('send-invoice-message'), errorMessage, 'error');
  }
};

// Send invoice via SMS using Payabli API - Create payment link then send via SMS
const sendInvoiceViaSMS = async () => {
  const invoiceId = window.currentSendInvoiceId;
  if (!invoiceId) {
    showMessage(document.getElementById('send-invoice-message'), 'Invoice ID not found', 'error');
    return;
  }

  const invoice = InvoiceManager.getInvoice(invoiceId);
  const customer = CustomerManager.getCustomer(invoice.customerId);

  if (!customer.phone) {
    showMessage(document.getElementById('send-invoice-message'), 'Customer does not have a phone number', 'error');
    return;
  }

  try {
    showMessage(document.getElementById('send-invoice-message'), 'Creating payment link...', 'loading');

    // Get invoice from cache
    let invoice = InvoiceManager.getInvoice(invoiceId);
    
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    // Step 1: Create a payment link from the invoice using POST
    const paymentLinkUrl = `${Config.get('apiBaseUrl')}/api/PaymentLink/${invoice.invoiceId}`;
    
    const paymentLinkBody = {
      contactUs: {
        emailLabel: 'Email',
        enabled: true,
        header: 'Contact Us',
        order: 0,
        paymentIcons: true,
        phoneLabel: 'Phone'
      },
      invoices: {
        enabled: true,
        invoiceLink: {
          enabled: true,
          label: 'View Invoice',
          order: 0
        },
        order: 0,
        viewInvoiceDetails: {
          enabled: true,
          label: 'Invoice Details',
          order: 0
        }
      },
      logo: {
        enabled: true,
        order: 0
      },
      messageBeforePaying: {
        enabled: true,
        label: 'Please review your payment details',
        order: 0
      },
      notes: {
        enabled: true,
        header: 'Additional Notes',
        order: 0,
        placeholder: 'Enter any additional notes here',
        value: ''
      },
      page: {
        description: 'Complete your payment securely',
        enabled: true,
        header: 'Payment Page',
        order: 0
      },
      paymentButton: {
        enabled: true,
        label: 'Pay Now',
        order: 0
      },
      paymentMethods: {
        allMethodsChecked: true,
        enabled: true,
        header: 'Payment Methods',
        methods: {
          amex: true,
          applePay: true,
          discover: true,
          eCheck: true,
          googlePay: true,
          mastercard: true,
          visa: true
        },
        order: 0,
        settings: {
          applePay: {
            buttonStyle: 'black',
            buttonType: 'pay',
            language: 'en-US'
          },
          googlePay: {
            buttonColor: 'black',
            buttonType: 'pay',
            merchantId: 'YOUR_MERCHANT_ID'
          }
        }
      },
      payor: {
        enabled: true,
        fields: [
          {
            display: true,
            fixed: true,
            identifier: true,
            label: 'Full Name',
            name: 'fullName',
            order: 0,
            required: true,
            validation: 'alpha',
            value: '',
            width: 0
          }
        ],
        header: 'Payor Information',
        order: 0
      },
      review: {
        enabled: true,
        header: 'Review Payment',
        order: 0
      },
      settings: {
        color: '#667eea',
        language: 'en',
        redirectAfterApprove: true,
        redirectAfterApproveUrl: window.location.origin
      },
      scheduledOptions: {
        includePayLink: true
      }
    };

    const paymentLinkResponse = await fetch(paymentLinkUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'requestToken': Config.get('apiToken')
      },
      body: JSON.stringify(paymentLinkBody)
    });

    const paymentLinkData = await paymentLinkResponse.json();

    console.log('Payment link response:', paymentLinkData);

    let payLinkId = null;
    
    // Check if the error is because payment link already exists (error code 3413)
    if (paymentLinkData.responseCode === 3413) {
      console.log('Payment link already exists for this invoice');
      
      // Try multiple sources for the payment link ID
      const paymentLinkMap = JSON.parse(localStorage.getItem('payment-link-map') || '{}');
      if (paymentLinkMap[invoice.invoiceId]) {
        payLinkId = paymentLinkMap[invoice.invoiceId];
        console.log('Using stored paymentLinkId from localStorage:', payLinkId);
      } else if (invoice.paymentLinkId) {
        payLinkId = invoice.paymentLinkId;
        console.log('Using paymentLinkId from invoice object:', payLinkId);
      } else if (invoice.paylinkId) {
        payLinkId = invoice.paylinkId;
        console.log('Using paylinkId from invoice:', payLinkId);
      } else {
        throw new Error('Payment link already exists but ID not found. Please try again or contact support.');
      }
    } else if (!paymentLinkResponse.ok || !paymentLinkData.isSuccess) {
      throw new Error(paymentLinkData.responseData?.explanation || paymentLinkData.responseText || 'Failed to create payment link');
    } else {
      payLinkId = paymentLinkData.responseData;
      console.log('Created new payment link ID:', payLinkId);
    }
    
    if (!payLinkId) {
      throw new Error('No payment link ID returned');
    }

    // Store the payment link ID for this invoice in localStorage for future resends
    const paymentLinkMap = JSON.parse(localStorage.getItem('payment-link-map') || '{}');
    paymentLinkMap[invoice.invoiceId] = payLinkId;
    localStorage.setItem('payment-link-map', JSON.stringify(paymentLinkMap));
    console.log('Stored payment link ID in localStorage:', payLinkId);

    showMessage(document.getElementById('send-invoice-message'), 'Sending via SMS...', 'loading');

    // Step 2: Send the payment link via SMS using POST
    const pushUrl = `${Config.get('apiBaseUrl')}/api/PaymentLink/push/${payLinkId}`;
    
    const pushResponse = await fetch(pushUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'requestToken': Config.get('apiToken')
      },
      body: JSON.stringify({
        channel: 'sms'
      })
    });

    const pushData = await pushResponse.json();

    console.log('SMS push response:', pushData);

    if (!pushResponse.ok || !pushData.isSuccess) {
      throw new Error(pushData.responseText || 'Failed to send SMS');
    }

    showMessage(document.getElementById('send-invoice-message'), `Invoice link sent successfully to ${customer.phone}!`, 'success');

    // Log activity
    console.log('Logging SMS sent for invoice:', invoice.invoiceNumber);
    ActivityLogger.logSmsSent(invoice.invoiceNumber, customer.phone);

    // Close modal after 2 seconds
    setTimeout(() => {
      closeSendInvoiceModal();
    }, 2000);

  } catch (error) {
    console.error('Error sending invoice via SMS:', error);
    const errorMessage = error.message || 'Failed to send invoice via SMS. Please try again.';
    showMessage(document.getElementById('send-invoice-message'), errorMessage, 'error');
  }
};

// Close modal when clicking outside
document.addEventListener('click', (e) => {
  const modal = document.getElementById('send-invoice-modal');
  if (e.target === modal) {
    closeSendInvoiceModal();
  }
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  displayInvoices();
});