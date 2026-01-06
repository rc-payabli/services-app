// Payment Management Module
const PaymentManager = (() => {
  let payments = [];
  let payComponent = null;

  // Initialize payments from localStorage
  const init = () => {
    const stored = localStorage.getItem('field-services-payments');
    if (stored) {
      try {
        payments = JSON.parse(stored);
      } catch (e) {
        console.warn('Failed to parse stored payments:', e);
        payments = [];
      }
    }
  };

  // Save payments to localStorage
  const save = () => {
    localStorage.setItem('field-services-payments', JSON.stringify(payments));
  };

  // Process payment with temp token
  const processPayment = async (paymentData, tempToken) => {
    try {
      // Add temp token to payment method
      const paymentWithToken = {
        ...paymentData,
        paymentMethod: {
          ...paymentData.paymentMethod,
          storedMethodId: tempToken,
          saveIfSuccess: false // Don't save the payment method permanently for now
        }
      };

      const apiResponse = await APIClient.processPayment(paymentWithToken);

      if (!apiResponse.isSuccess) {
        throw new Error(apiResponse.responseText || 'Payment processing failed');
      }

      // Store payment locally
      const payment = {
        id: apiResponse.responseData.referenceId,
        transactionId: apiResponse.responseData.referenceId,
        invoiceId: paymentData.orderId,
        customerId: paymentData.customerData.customerId,
        amount: paymentData.paymentDetails.totalAmount,
        tempToken,
        status: 1, // Successful
        createdAt: new Date().toISOString(),
        apiResponse: apiResponse.responseData
      };

      payments.push(payment);
      save();

      return payment;
    } catch (error) {
      console.error('Error processing payment:', error);
      throw error;
    }
  };

  // Get payment by transaction ID
  const getPayment = (transactionId) => {
    return payments.find(p => p.transactionId === transactionId);
  };

  // Get payments by invoice
  const getPaymentsByInvoice = (invoiceId) => {
    return payments.filter(p => p.invoiceId === invoiceId);
  };

  // Log failed payment attempt
  const logFailedPayment = (invoiceId, customerId, amount, reason, paymentMethod, cardType, maskedAccount) => {
    const failedPayment = {
      id: `failed-${Date.now()}`,
      transactionId: `failed-${Date.now()}`,
      invoiceId: invoiceId,
      customerId: customerId,
      amount: amount,
      paymentMethod: paymentMethod,
      cardType: cardType,
      maskedAccount: maskedAccount,
      status: 0, // Failed
      reason: reason,
      createdAt: new Date().toISOString()
    };

    payments.push(failedPayment);
    save();

    return failedPayment;
  };

  // Log successful payment
  const logSuccessfulPayment = (invoiceId, customerId, amount, paymentMethod, cardType, binCardType, maskedAccount, transactionId) => {
    const successPayment = {
      id: transactionId || `success-${Date.now()}`,
      transactionId: transactionId || `success-${Date.now()}`,
      invoiceId: invoiceId,
      customerId: customerId,
      amount: amount,
      paymentMethod: paymentMethod,
      cardType: cardType,
      binCardType: binCardType,
      maskedAccount: maskedAccount,
      status: 1, // Successful
      createdAt: new Date().toISOString()
    };

    payments.push(successPayment);
    save();

    return successPayment;
  };

  // Get all payments
  const getAllPayments = () => {
    return [...payments];
  };

  init();

  return {
    processPayment,
    getPayment,
    getPaymentsByInvoice,
    getAllPayments,
    logFailedPayment,
    logSuccessfulPayment
  };
})();

// Payment Form Handler
document.addEventListener('DOMContentLoaded', () => {
  const paymentCustomerSelect = document.getElementById('payment-customer-select');
  const paymentInvoiceSelect = document.getElementById('payment-invoice-select');
  const paymentAmountInput = document.getElementById('payment-amount');
  const paymentDetailsSection = document.getElementById('payment-details');

  // Update invoice selector when customer changes
  paymentCustomerSelect.addEventListener('change', () => {
    const customerId = paymentCustomerSelect.value;
    
    console.log('Customer selected, customerId:', customerId);
    
    if (!customerId) {
      paymentInvoiceSelect.innerHTML = '<option value="">Select an invoice</option>';
      paymentDetailsSection.style.display = 'none';
      return;
    }

    // Get invoices for this customer
    const customerIdNum = parseInt(customerId);
    console.log('Looking for invoices with customerId:', customerIdNum);
    console.log('All invoices:', InvoiceManager.getAllInvoices());
    
    const invoices = InvoiceManager.getInvoicesByCustomer(customerIdNum);
    
    console.log('Found invoices:', invoices);
    
    paymentInvoiceSelect.innerHTML = '<option value="">Select an invoice</option>';
    
    if (invoices.length === 0) {
      console.warn('No invoices found for customer', customerIdNum);
      paymentInvoiceSelect.disabled = true;
      paymentDetailsSection.style.display = 'none';
      return;
    }

    paymentInvoiceSelect.disabled = false;
    
    invoices.forEach(invoice => {
      if (invoice.invoiceStatus !== 3) { // Not fully paid
        const option = document.createElement('option');
        option.value = invoice.invoiceId;
        option.textContent = `${invoice.invoiceNumber} - $${invoice.invoiceAmount.toFixed(2)} (Due: ${invoice.invoiceDueDate || 'N/A'})`;
        paymentInvoiceSelect.appendChild(option);
      }
    });
  });

  // Update payment details when invoice changes
  paymentInvoiceSelect.addEventListener('change', () => {
    const invoiceId = paymentInvoiceSelect.value;

    if (!invoiceId) {
      paymentDetailsSection.style.display = 'none';
      return;
    }

    const invoice = InvoiceManager.getInvoice(parseInt(invoiceId));
    if (!invoice) {
      paymentDetailsSection.style.display = 'none';
      return;
    }

    const amountDue = invoice.invoiceAmount - (invoice.invoicePaidAmount || 0);

    // Update payment details display
    document.getElementById('payment-invoice-number').textContent = invoice.invoiceNumber;
    document.getElementById('payment-customer-name').textContent = invoice.customerName;
    document.getElementById('payment-invoice-date').textContent = new Date(invoice.invoiceDate).toLocaleDateString();
    document.getElementById('payment-invoice-amount').textContent = `$${invoice.invoiceAmount.toFixed(2)}`;
    document.getElementById('payment-invoice-paid').textContent = `$${(invoice.invoicePaidAmount || 0).toFixed(2)}`;
    document.getElementById('payment-amount-due').textContent = `$${amountDue.toFixed(2)}`;

    // Set payment amount to amount due
    paymentAmountInput.max = amountDue;
    paymentAmountInput.value = amountDue.toFixed(2);

    paymentDetailsSection.style.display = 'block';

    // Initialize embedded payment component only once
    if (!payComponent) {
      initializeEmbeddedPayment(invoice);
    }
  });
});

// Initialize embedded payment component
let payComponent = null;
let currentPaymentInvoice = null; // Store current invoice for tab switching

const initializeEmbeddedPayment = (invoice, defaultMethod = 'card') => {
  // Store invoice for later use
  currentPaymentInvoice = invoice;
  
  // Destroy previous component if it exists
  if (payComponent && payComponent.payabliExec) {
    try {
      payComponent.payabliExec('destroy');
    } catch (e) {
      console.warn('Error destroying payComponent:', e);
    }
  }
  
  // Reset payComponent to null to allow fresh initialization
  payComponent = null;
  
  // Clear the container
  const container = document.getElementById('pay-component-1');
  if (container) {
    container.innerHTML = '';
  }

  // Check if public token is configured
  if (!Config.get('publicToken')) {
    document.getElementById('pay-component-1').innerHTML = '<div style="color: #c62828; padding: 20px;">Public Token not configured. Please check your configuration.</div>';
    return;
  }

  const paymentConfig = {
    type: 'methodEmbedded',
    rootContainer: 'pay-component-1',
    token: Config.get('publicToken'),
    entryPoint: Config.get('entryPoint'),
    defaultOpen: defaultMethod,
    temporaryToken: true,
    forceCustomerCreation: false,
    card: {
      enabled: true,
      amex: true,
      discover: true,
      visa: true,
      mastercard: true,
      jcb: true,
      diners: true,
      inputs: {
        cardHolderName: {
          label: 'NAME ON CARD',
          size: 12,
          row: 0,
          order: 0
        },
        cardNumber: {
          label: 'CARD NUMBER',
          size: 6,
          row: 1,
          order: 0
        },
        cardExpirationDate: {
          label: 'EXPIRATION',
          size: 6,
          row: 1,
          order: 1
        },
        cardCvv: {
          label: 'CVV',
          size: 6,
          row: 2,
          order: 0
        },
        cardZipcode: {
          label: 'ZIP CODE',
          size: 6,
          row: 2,
          order: 1
        }
      }
    },
    ach: {
      enabled: true,
      inputs: {
        achHolderName: {
          label: 'ACCOUNT HOLDER NAME',
          size: 12,
          row: 0,
          order: 0
        },
        achAccountNumber: {
          label: 'ACCOUNT NUMBER',
          size: 6,
          row: 1,
          order: 0
        },
        achRoutingNumber: {
          label: 'ROUTING NUMBER',
          size: 6,
          row: 1,
          order: 1
        },
        achAccountType: {
          label: 'ACCOUNT TYPE',
          size: 12,
          row: 2,
          order: 0
        }
      }
    },
    functionCallBackSuccess: function (response) {
      console.log('Component SUCCESS callback fired with response:', response);
      handlePaymentSuccess(response, invoice);
    },
    functionCallBackError: function (errors) {
      console.error('Component ERROR callback fired with errors:', errors);
      handlePaymentError(errors);
    },
    functionCallBackReady: function (data) {
      console.log('Component READY callback fired with data:', data);
      const btn = document.getElementById('submit-payment-btn');
      if (data[1] === true) {
        btn.style.display = 'block';
      } else {
        btn.style.display = 'none';
      }
    }
  };

  console.log('Creating PayabliComponent with defaultOpen:', defaultMethod);
  payComponent = new PayabliComponent(paymentConfig);
  
  console.log('PayabliComponent created, payComponent is now:', !!payComponent);
  console.log('payComponent.payabliExec is:', typeof payComponent.payabliExec);
};

// Handle payment success
const handlePaymentSuccess = (response, invoice) => {
  const messageEl = document.getElementById('payment-message');
  const processingModal = document.getElementById('payment-processing-modal');

  if (response.responseText !== 'Success') {
    showMessage(messageEl, `Payment error: ${response.responseData?.resultText || 'Unknown error'}`, 'error');
    return;
  }

  // Get temp token from response (this is returned from the method call)
  const tempToken = response.responseData.referenceId;
  const paymentAmount = window.pendingPaymentAmount || parseFloat(document.getElementById('payment-amount').value);
  const currentInvoice = window.pendingInvoice || invoice;
  const paymentMethod = window.pendingPaymentMethod || 'card';

  if (!paymentAmount || paymentAmount <= 0) {
    showMessage(messageEl, 'Please enter a valid payment amount', 'error');
    return;
  }

  console.log('Method successful, received temp token:', tempToken, 'for method:', paymentMethod);

  // Show processing modal before processing payment
  if (processingModal) {
    processingModal.style.display = 'flex';
    console.log('Processing modal shown');
  }

  // Prepare payment data using the temp token
  const customer = CustomerManager.getCustomer(currentInvoice.customerId);
  
  const paymentData = {
    paymentMethod: {
      method: paymentMethod,
      storedMethodId: tempToken
    },
    orderId: currentInvoice.invoiceNumber,
    entryPoint: Config.get('entryPoint'),
    paymentDetails: {
      totalAmount: paymentAmount,
      serviceFee: 0
    },
    customerData: {
      customerId: customer.customerId,
      firstName: customer.firstName,
      lastName: customer.lastName,
      customerNumber: customer.customerNumber
    }
  };

  console.log('Processing payment with temp token:', paymentData);

  processPaymentWithToken(paymentData, tempToken, currentInvoice, paymentAmount, paymentMethod);
};

// Process payment with temp token
const processPaymentWithToken = async (paymentData, tempToken, invoice, paymentAmount, paymentMethod = 'card') => {
  const messageEl = document.getElementById('payment-message');
  const processingModal = document.getElementById('payment-processing-modal');

  try {
    showMessage(messageEl, 'Processing payment...', 'loading');

    const customer = CustomerManager.getCustomer(invoice.customerId);

    // Get IP address (client-side, this will be the user's IP)
    let ipAddress = '';
    try {
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipResponse.json();
      ipAddress = ipData.ip;
    } catch (e) {
      console.warn('Could not fetch IP address:', e);
      ipAddress = '';
    }

    // Build the correct getpaid API payload
    const getpaidPayload = {
      paymentDetails: {
        totalAmount: paymentAmount,
        serviceFee: 0
      },
      paymentMethod: {
        method: paymentMethod,
        initiator: 'payor',
        storedMethodId: tempToken
      },
      customerData: {
        customerId: customer.customerId,
        billingAddress1: customer.address || '',
        billingCity: customer.city || '',
        billingCountry: 'US',
        billingEmail: customer.email || '',
        billingPhone: customer.phone || '',
        billingZip: customer.zip || '',
        billingState: customer.state || '',
        company: customer.company || ''
      },
      entryPoint: Config.get('entryPoint'),
      ipaddress: ipAddress,
      invoiceData: {
        firstName: customer.firstName,
        lastName: customer.lastName,
        invoiceAmount: invoice.invoiceAmount,
        invoiceDate: invoice.invoiceDate,
        invoiceDueDate: invoice.invoiceDueDate || invoice.invoiceDate,
        invoiceNumber: invoice.invoiceNumber,
        shippingAddress1: customer.address || '',
        shippingCity: customer.city || '',
        shippingEmail: customer.email || '',
        shippingCountry: 'US',
        shippingPhone: customer.phone || '',
        shippingState: customer.state || '',
        shippingZip: customer.zip || '',
        company: customer.company || ''
      }
    };

    console.log('getpaid API payload for', paymentMethod.toUpperCase() + ':', JSON.stringify(getpaidPayload, null, 2));

    // Make the getpaid API call
    const getpaidResponse = await fetch(`${Config.get('apiBaseUrl')}/api/v2/MoneyIn/getpaid`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'requestToken': Config.get('apiToken')
      },
      body: JSON.stringify(getpaidPayload)
    });

    const getpaidData = await getpaidResponse.json();

    console.log('getpaid response:', getpaidData);

    // Check for success - getpaid uses 'code' field with 'A0000' for success
    if (!getpaidResponse.ok || !getpaidData.code || getpaidData.code !== 'A0000') {
      throw new Error(getpaidData.explanation || getpaidData.reason || 'Payment processing failed');
    }

    // Dismiss processing modal
    if (processingModal) {
      processingModal.style.display = 'none';
      console.log('Processing modal hidden on success');
    }

    // Extract card details from transaction response
    let cardType = null;
    let binCardType = null;
    let maskedAccount = null;
    
    // API returns PaymentData (capital P) - handle both cases for safety
    const paymentData = getpaidData.data?.PaymentData || getpaidData.data?.paymentData;
    
    if (paymentData) {
      // Get account type (visa, mastercard, amex, discover, etc.)
      // API returns AccountType (capital A)
      if (paymentData.AccountType || paymentData.accountType) {
        cardType = (paymentData.AccountType || paymentData.accountType).toLowerCase();
      }
      
      // Get bin card type (DEBIT, CREDIT) - nested inside binData
      if (paymentData.binData && paymentData.binData.binCardType) {
        binCardType = paymentData.binData.binCardType.toUpperCase();
      }
      
      // Extract last 4 digits from maskedAccount
      // API returns MaskedAccount (capital M)
      const masked = paymentData.MaskedAccount || paymentData.maskedAccount;
      if (masked) {
        const lastFour = masked.slice(-4);
        maskedAccount = `X${lastFour}`;
      }
    }
    
    // Update invoice with payment and method info
    InvoiceManager.updateInvoicePaid(invoice.invoiceId, paymentAmount, paymentMethod, cardType, maskedAccount);

    // API returns PaymentTransId (capital P and T)
    const transactionId = getpaidData.data?.PaymentTransId || getpaidData.data?.paymentTransId || 'N/A';

    // Log payment to PaymentManager (include binCardType)
    PaymentManager.logSuccessfulPayment(
      invoice.invoiceId,
      invoice.customerId,
      paymentAmount,
      paymentMethod,
      cardType,
      binCardType,
      maskedAccount,
      transactionId
    );

    showMessage(messageEl, `Payment of $${paymentAmount.toFixed(2)} processed successfully! (Transaction ID: ${transactionId})`, 'success');

    // Log to activity feed - determine if partial or full payment
    const isPartialPayment = paymentAmount < invoice.invoiceAmount;
    if (window.ActivityLogger) {
      window.ActivityLogger.logPaymentReceived(invoice.invoiceNumber, paymentAmount, isPartialPayment);
    } else {
      console.warn('ActivityLogger not available, skipping activity logging');
    }

    // Reset form and component, then redirect to dashboard
    setTimeout(() => {
      document.getElementById('payment-customer-select').value = '';
      document.getElementById('payment-invoice-select').value = '';
      document.getElementById('payment-amount').value = '';
      document.getElementById('payment-details').style.display = 'none';
      
      // Refresh invoice display
      displayInvoices();
      
      // Update dashboard with new payment info
      if (window.DashboardManager) {
        window.DashboardManager.updateDashboard();
      } else {
        console.warn('DashboardManager not available, skipping dashboard update');
      }
      
      // Re-initialize component
      if (payComponent && payComponent.payabliExec) {
        payComponent.payabliExec('destroy');
      }
      
      // Clear pending data
      window.pendingInvoice = null;
      window.pendingPaymentAmount = null;
      
      // Redirect to dashboard
      switchSection('dashboard');
    }, 2000);

  } catch (error) {
    console.error('Payment error:', error);
    
    // Dismiss processing modal on error
    if (processingModal) {
      processingModal.style.display = 'none';
      console.log('Processing modal hidden on error');
    }
    
    const errorMessage = error.message || 'Payment processing failed. Please try again.';
    showMessage(messageEl, errorMessage, 'error');
    
    // Log failed payment attempt to payment history
    if (window.pendingInvoice && window.pendingPaymentAmount) {
      console.log('Logging failed payment for invoice:', window.pendingInvoice.invoiceNumber);
      
      const paymentMethod = window.pendingPaymentMethod || 'unknown';
      
      PaymentManager.logFailedPayment(
        window.pendingInvoice.invoiceId,
        window.pendingInvoice.customerId,
        window.pendingPaymentAmount,
        errorMessage,
        paymentMethod,
        null, // cardType - will be null for failed payments (card didn't go through)
        null  // maskedAccount - will be null for failed payments
      );
      if (window.ActivityLogger) {
        window.ActivityLogger.logPaymentFailed(window.pendingInvoice.invoiceNumber, errorMessage);
      } else {
        console.warn('ActivityLogger not available, skipping activity logging');
      }
    }
  }
};

// Handle payment error
const handlePaymentError = (errors) => {
  const messageEl = document.getElementById('payment-message');
  console.error('Payment component error:', errors);
  showMessage(messageEl, 'Payment form error. Please try again.', 'error');

  if (payComponent && payComponent.payabliExec) {
    payComponent.payabliExec('reinit');
  }
};


// Tab switching for payment methods
document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.payment-container .tab');
  
  console.log('Found tabs:', tabs.length);
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      console.log('Tab clicked:', tab.dataset.method);
      
      // Update active tab styling
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Use the global invoice variable
      console.log('Current invoice:', currentPaymentInvoice?.invoiceId);
      if (!currentPaymentInvoice) {
        console.warn('No invoice selected');
        return;
      }

      const method = tab.dataset.method;
      console.log('Method:', method);
      if (!method) return;

      // Destroy the old component instance
      console.log('Destroying old component...');
      if (payComponent && payComponent.payabliExec) {
        try {
          payComponent.payabliExec('destroy');
        } catch (e) {
          console.warn('Error destroying component:', e);
        }
      }
      payComponent = null;

      // Create new component with the selected method as default
      console.log('Creating new component with method:', method);
      initializeEmbeddedPayment(currentPaymentInvoice, method);
      console.log('New component created');
    });
  });
});
// Handle payment button click - method + temp token flow
document.addEventListener('DOMContentLoaded', () => {
  const submitBtn = document.getElementById('submit-payment-btn');
  
  if (submitBtn) {
    submitBtn.addEventListener('click', (e) => {
      e.preventDefault();

      if (!Config.isConfigured()) {
        const messageEl = document.getElementById('payment-message');
        showMessage(messageEl, 'Please configure your Payabli credentials first', 'error');
        return;
      }

      // Use the global current invoice
      if (!currentPaymentInvoice) {
        const messageEl = document.getElementById('payment-message');
        showMessage(messageEl, 'Please select an invoice', 'error');
        return;
      }

      const invoice = currentPaymentInvoice;
      const customer = CustomerManager.getCustomer(invoice.customerId);
      const paymentAmount = parseFloat(document.getElementById('payment-amount').value);

      if (!paymentAmount || paymentAmount <= 0) {
        const messageEl = document.getElementById('payment-message');
        showMessage(messageEl, 'Please enter a valid payment amount', 'error');
        return;
      }

      // Detect which payment method is active (card or ach)
      const activeTab = document.querySelector('.payment-container .tab.active');
      const isAch = activeTab && activeTab.textContent.toLowerCase().includes('debit');
      const paymentMethod = isAch ? 'ach' : 'card';

      // Prepare method parameters to save payment method and get temp token
      const methodParameters = {
        customerData: {
          customerId: customer.customerId,
          firstName: customer.firstName,
          lastName: customer.lastName,
          customerNumber: customer.customerNumber
        },
        paymentDetails: {
          totalAmount: paymentAmount,
          serviceFee: 0
        },
        paymentMethod: {
          method: paymentMethod,
          initiator: 'payor'
        }
      };

      console.log('Submitting', paymentMethod.toUpperCase(), 'method to get temp token with parameters:', methodParameters);

      // Store invoice and payment info for use in success callback
      window.pendingInvoice = invoice;
      window.pendingPaymentAmount = paymentAmount;
      window.pendingPaymentMethod = paymentMethod;

      // Show loading message
      const messageEl = document.getElementById('payment-message');
      showMessage(messageEl, 'Processing payment method...', 'loading');

      console.log('payComponent exists:', !!payComponent);
      console.log('payComponent.payabliExec exists:', !!(payComponent && payComponent.payabliExec));

      // Trigger method submission on the embedded component to get temp token
      if (payComponent && payComponent.payabliExec) {
        console.log('Calling payabliExec with action: method');
        payComponent.payabliExec('method', methodParameters);
        console.log('payabliExec call completed');
      } else {
        console.error('payComponent or payabliExec not available');
        showMessage(messageEl, 'Payment component not ready. Please try again.', 'error');
      }
    });
  }
});