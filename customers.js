// Customer Management Module
const CustomerManager = (() => {
  let customers = [];

  // Initialize customers from localStorage
  const init = () => {
    const stored = localStorage.getItem('field-services-customers');
    if (stored) {
      try {
        customers = JSON.parse(stored);
      } catch (e) {
        console.warn('Failed to parse stored customers:', e);
        customers = [];
      }
    }
  };

  // Save customers to localStorage
  const save = () => {
    localStorage.setItem('field-services-customers', JSON.stringify(customers));
  };

  // Add customer (both local and API)
  const addCustomer = async (customerData, serviceType = null) => {
    try {
      // Log exactly what we're sending to Payabli
      console.log('EXACT payload being sent to Payabli API:', JSON.stringify(customerData, null, 2));
      
      // Create customer via Payabli API
      const apiResponse = await APIClient.createCustomer(customerData);
      
      console.log('API Response received:', apiResponse);

      if (!apiResponse.isSuccess) {
        throw new Error(apiResponse.responseText || 'Failed to create customer');
      }

      console.log('Customer created successfully:', apiResponse.responseData);

      // Store locally with additional metadata
      const customer = {
        id: apiResponse.responseData.customerId,
        customerId: apiResponse.responseData.customerId,
        customerNumber: apiResponse.responseData.customerNumber,
        firstName: apiResponse.responseData.Firstname,
        lastName: apiResponse.responseData.Lastname,
        email: apiResponse.responseData.Email,
        company: apiResponse.responseData.Company,
        phone: apiResponse.responseData.Phone,
        address: apiResponse.responseData.Address,
        city: apiResponse.responseData.City,
        state: apiResponse.responseData.State,
        zip: apiResponse.responseData.Zip,
        serviceType: serviceType,
        createdAt: new Date().toISOString(),
        apiResponse: apiResponse.responseData
      };

      console.log('Storing customer locally:', customer);

      customers.push(customer);
      save();

      console.log('Customer saved to local storage');

      return customer;
    } catch (error) {
      console.error('Error creating customer:', error);
      throw error;
    }
  };

  // Get customer by ID
  const getCustomer = (customerId) => {
    return customers.find(c => c.customerId === customerId || c.id === customerId);
  };

  // Get all customers
  const getAllCustomers = () => {
    return [...customers];
  };

  // Update customer list from API (if needed)
  const refreshCustomers = async () => {
    // Note: Payabli API doesn't have a direct customer list endpoint
    // So we maintain the list locally
    return customers;
  };

  // Remove customer from local storage
  const removeCustomer = (customerId) => {
    customers = customers.filter(c => c.customerId !== customerId && c.id !== customerId);
    save();
  };

  init();

  return {
    addCustomer,
    getCustomer,
    getAllCustomers,
    refreshCustomers,
    removeCustomer
  };
})();

// Generate unique 8-digit customer number
const generateCustomerNumber = () => {
  const customers = CustomerManager.getAllCustomers();
  const existingNumbers = new Set(customers.map(c => c.customerNumber));
  
  let customerNumber;
  let attempts = 0;
  const maxAttempts = 1000;

  // Generate random 8-digit number until we find one that doesn't exist
  do {
    customerNumber = String(Math.floor(Math.random() * 90000000) + 10000000); // 8 digits: 10000000-99999999
    attempts++;
  } while (existingNumbers.has(customerNumber) && attempts < maxAttempts);

  if (attempts >= maxAttempts) {
    throw new Error('Failed to generate unique customer number after 1000 attempts');
  }

  return customerNumber;
};

// Customer Form Handler
document.addEventListener('DOMContentLoaded', () => {
  const customerForm = document.getElementById('customer-form');
  const messageEl = document.getElementById('customer-message');

  customerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Check if configured
    if (!Config.isConfigured()) {
      showMessage(messageEl, 'Please configure your Payabli credentials first', 'error');
      return;
    }

    // Get form data
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const company = document.getElementById('company').value.trim() || '';
    const address = document.getElementById('address').value.trim() || '';
    const city = document.getElementById('city').value.trim() || '';
    const state = document.getElementById('state').value.trim() || '';
    const zip = document.getElementById('zip').value.trim() || '';
    const serviceType = document.getElementById('service-type').value;

    // Validate required fields
    if (!firstName || !lastName || !email || !phone || !serviceType) {
      showMessage(messageEl, 'Please fill in all required fields', 'error');
      return;
    }

    // Check if editing or creating
    const isEditing = !!window.editingCustomerId;

    try {
      if (isEditing) {
        // Update existing customer
        const customerId = window.editingCustomerId;
        const existingCustomer = CustomerManager.getCustomer(customerId);

        // Prepare update data for API
        const updateData = {
          firstName: firstName,
          lastname: lastName,
          email: email,
          phone: phone,
          company: (company && company.length > 0) ? company : undefined,
          address: (address && address.length > 0) ? address : undefined,
          city: (city && city.length > 0) ? city : undefined,
          state: (state && state.length > 0) ? state : undefined,
          zip: (zip && zip.length > 0) ? zip : undefined,
          country: 'US',
          customerStatus: 1
        };

        showMessage(messageEl, 'Updating customer...', 'loading');

        // Call Payabli API to update customer
        const updateUrl = `${Config.get('apiBaseUrl')}/api/customer/${existingCustomer.customerId}`;
        
        const response = await fetch(updateUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'requestToken': Config.get('apiToken')
          },
          body: JSON.stringify(updateData)
        });

        const data = await response.json();

        if (!response.ok || !data.isSuccess) {
          throw new Error(data.responseText || 'Failed to update customer');
        }

        // Update local storage
        const updatedCustomer = {
          ...existingCustomer,
          firstName: firstName,
          lastName: lastName,
          email: email,
          phone: phone,
          company: company || '',
          address: address || '',
          city: city || '',
          state: state || '',
          zip: zip || '',
          serviceType: serviceType
        };

        // Replace in local storage
        const allCustomers = CustomerManager.getAllCustomers();
        const idx = allCustomers.findIndex(c => c.customerId === customerId);
        if (idx !== -1) {
          allCustomers[idx] = updatedCustomer;
          localStorage.setItem('field-services-customers', JSON.stringify(allCustomers));
        }

        // Reset form and edit mode
        customerForm.reset();
        document.getElementById('service-type').value = '';
        window.editingCustomerId = null;

        // Reset button text
        const submitBtn = document.querySelector('#customer-form button[type="submit"]');
        submitBtn.textContent = 'Create Customer';

        // Update all displays
        updateCustomerSelectors();
        displayCustomers();
        displayInvoices();

        showMessage(messageEl, `Customer "${firstName} ${lastName}" updated successfully!`, 'success');
      } else {
        // Create new customer
        let customerNumber;
        try {
          customerNumber = generateCustomerNumber();
          console.log('Generated customer number:', customerNumber);
        } catch (error) {
          console.error('Error generating customer number:', error);
          showMessage(messageEl, error.message, 'error');
          return;
        }

        // Prepare customer data for API
        const customerData = {
          firstName: firstName,
          lastname: lastName,
          email: email,
          phone: phone,
          customerNumber: customerNumber,
          company: (company && company.length > 0) ? company : undefined,
          address: (address && address.length > 0) ? address : undefined,
          city: (city && city.length > 0) ? city : undefined,
          state: (state && state.length > 0) ? state : undefined,
          zip: (zip && zip.length > 0) ? zip : undefined,
          country: 'US',
          identifierFields: ['customerNumber'],
          customerStatus: 1
        };

        console.log('About to send customer data:', JSON.stringify(customerData, null, 2));

        showMessage(messageEl, 'Creating customer...', 'loading');

        const customer = await CustomerManager.addCustomer(customerData, serviceType);

        // Reset form
        customerForm.reset();
        document.getElementById('service-type').value = '';

        // Update customer lists in all dropdowns
        updateCustomerSelectors();
        
        // Refresh view customers display
        displayCustomers();

        // Show success
        showMessage(messageEl, `Customer "${firstName} ${lastName}" created successfully! (ID: ${customer.customerId}, Customer #: ${customerNumber})`, 'success');
      }

      // Update customer status
      updateCustomerStatus();

    } catch (error) {
      console.error('Customer creation error:', error);
      const errorMessage = error.message || 'Failed to create customer. Please check your configuration and try again.';
      showMessage(messageEl, errorMessage, 'error');
    }
  });
});

// Update customer selector dropdowns
const updateCustomerSelectors = (selectCustomerId = null) => {
  const customers = CustomerManager.getAllCustomers();
  
  // Update invoice creator selector with custom dropdown search
  const invoiceSearch = document.getElementById('invoice-customer-search');
  const invoiceDropdown = document.getElementById('invoice-customer-dropdown');
  const invoiceSelect = document.getElementById('invoice-customer-select');
  
  // Store all customers for filtering
  const allCustomers = customers;
  
  // Function to populate dropdown with filtered customers
  const populateDropdown = (filter = '') => {
    invoiceDropdown.innerHTML = '';
    
    const filtered = allCustomers.filter(customer => {
      const displayName = `${customer.firstName} ${customer.lastName}`;
      const searchText = filter.toLowerCase();
      return displayName.toLowerCase().includes(searchText) || 
             (customer.company && customer.company.toLowerCase().includes(searchText));
    });
    
    if (filtered.length === 0) {
      invoiceDropdown.innerHTML = '<div style="padding: 10px 12px; color: var(--text-secondary);">No customers found</div>';
      return;
    }
    
    filtered.forEach(customer => {
      const displayName = `${customer.firstName} ${customer.lastName}`;
      const option = document.createElement('div');
      option.className = 'dropdown-option';
      option.textContent = displayName;
      option.setAttribute('data-id', customer.customerId);
      option.setAttribute('data-name', displayName);
      
      option.addEventListener('click', () => {
        invoiceSearch.value = displayName;
        invoiceSelect.value = customer.customerId;
        invoiceDropdown.classList.remove('show');
        console.log('Selected customer:', displayName, 'ID:', customer.customerId);
      });
      
      option.addEventListener('mouseover', () => {
        document.querySelectorAll('.dropdown-option').forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
      });
      
      invoiceDropdown.appendChild(option);
    });
  };
  
  // Show dropdown on input focus
  invoiceSearch.addEventListener('focus', () => {
    // Don't show dropdown on focus, only on input
  });
  
  // Filter dropdown as user types
  invoiceSearch.addEventListener('input', (e) => {
    if (e.target.value.trim().length > 0) {
      populateDropdown(e.target.value);
      invoiceDropdown.classList.add('show');
    } else {
      invoiceDropdown.classList.remove('show');
    }
  });
  
  // Hide dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-dropdown-wrapper')) {
      invoiceDropdown.classList.remove('show');
    }
  });
  
  // Allow keyboard navigation
  invoiceSearch.addEventListener('keydown', (e) => {
    const options = invoiceDropdown.querySelectorAll('.dropdown-option');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const selected = invoiceDropdown.querySelector('.selected');
      if (!selected && options.length > 0) {
        options[0].classList.add('selected');
      } else if (selected) {
        const next = selected.nextElementSibling;
        if (next && next.classList.contains('dropdown-option')) {
          selected.classList.remove('selected');
          next.classList.add('selected');
        }
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const selected = invoiceDropdown.querySelector('.selected');
      if (selected) {
        const prev = selected.previousElementSibling;
        if (prev && prev.classList.contains('dropdown-option')) {
          selected.classList.remove('selected');
          prev.classList.add('selected');
        }
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = invoiceDropdown.querySelector('.selected');
      if (selected) {
        selected.click();
      }
    }
  });
  
  // Populate hidden select for form submission
  invoiceSelect.innerHTML = '<option value="">No customer selected</option>';
  customers.forEach(customer => {
    const option = document.createElement('option');
    option.value = customer.customerId;
    option.textContent = `${customer.firstName} ${customer.lastName} (${customer.email})`;
    invoiceSelect.appendChild(option);
    if (selectCustomerId === customer.customerId) {
      invoiceSearch.value = `${customer.firstName} ${customer.lastName}`;
      option.selected = true;
    }
  });

  // Update invoice filter selector
  const filterSelect = document.getElementById('filter-customer-select');
  filterSelect.innerHTML = '<option value="">All Customers</option>';
  customers.forEach(customer => {
    const option = document.createElement('option');
    option.value = customer.customerId;
    option.textContent = `${customer.firstName} ${customer.lastName}`;
    filterSelect.appendChild(option);
    if (selectCustomerId === customer.customerId) {
      option.selected = true;
    }
  });

  // Update payment customer selector
  const paymentSelect = document.getElementById('payment-customer-select');
  paymentSelect.innerHTML = '<option value="">Select a customer</option>';
  customers.forEach(customer => {
    const option = document.createElement('option');
    option.value = customer.customerId;
    option.textContent = `${customer.firstName} ${customer.lastName} (${customer.email})`;
    paymentSelect.appendChild(option);
    if (selectCustomerId === customer.customerId) {
      option.selected = true;
    }
  });
};

// Update customer status display
const updateCustomerStatus = () => {
  const customers = CustomerManager.getAllCustomers();
  const statusEl = document.getElementById('customer-status');
  
  if (customers.length === 0) {
    statusEl.classList.add('empty');
    statusEl.innerHTML = '';
  }
};

// Display all customers in table
const displayCustomers = () => {
  const customers = CustomerManager.getAllCustomers();
  const tbody = document.getElementById('customers-tbody');

  if (!tbody) return;

  if (customers.length === 0) {
    tbody.innerHTML = '<tr class="empty-state"><td colspan="7">No customers found. Create one to get started.</td></tr>';
    return;
  }

  tbody.innerHTML = customers.map(customer => `
    <tr>
      <td><strong>${customer.customerNumber}</strong></td>
      <td>${customer.firstName} ${customer.lastName}</td>
      <td>${customer.email}</td>
      <td>${formatPhoneNumber(customer.phone)}</td>
      <td>${customer.company || '-'}</td>
      <td>${customer.state || '-'}</td>
      <td>
        <div class="action-buttons">
          <button class="btn btn-small btn-primary" onclick="showCustomerDetails(${customer.customerId})">View</button>
          <button class="btn btn-small btn-secondary" onclick="editCustomer(${customer.customerId})">Edit</button>
        </div>
      </td>
    </tr>
  `).join('');
};

// Show customer details modal
const showCustomerDetails = (customerId) => {
  const customer = CustomerManager.getCustomer(customerId);
  if (!customer) {
    alert('Customer not found');
    return;
  }

  // Store current customer ID for edit/delete actions
  window.currentCustomerId = customerId;

  // Populate modal with customer details
  document.getElementById('detail-cust-number').textContent = customer.customerNumber || '-';
  document.getElementById('detail-cust-first-name').textContent = customer.firstName || '-';
  document.getElementById('detail-cust-last-name').textContent = customer.lastName || '-';
  document.getElementById('detail-cust-email').textContent = customer.email || '-';
  document.getElementById('detail-cust-phone').textContent = formatPhoneNumber(customer.phone) || '-';
  document.getElementById('detail-cust-company').textContent = customer.company || '-';
  document.getElementById('detail-cust-address').textContent = customer.address || '-';
  document.getElementById('detail-cust-city').textContent = customer.city || '-';
  document.getElementById('detail-cust-state').textContent = customer.state || '-';
  document.getElementById('detail-cust-zip').textContent = customer.zip || '-';

  // Populate customer invoices
  populateCustomerInvoices(customerId);

  // Show modal
  const modal = document.getElementById('customer-details-modal');
  modal.style.display = 'flex';
};

// Populate customer invoices in the details modal
const populateCustomerInvoices = (customerId) => {
  const invoicesTableBody = document.getElementById('detail-customer-invoices');
  
  // Get all invoices from InvoiceManager
  const allInvoices = InvoiceManager.getAllInvoices();
  
  // Filter invoices for this customer
  const customerInvoices = allInvoices.filter(inv => inv.customerId === customerId);
  
  if (customerInvoices.length === 0) {
    invoicesTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 16px;">No invoices yet</td></tr>';
    return;
  }

  // Sort by date descending (newest first)
  customerInvoices.sort((a, b) => new Date(b.invoiceDate) - new Date(a.invoiceDate));

  // Populate table with invoices
  invoicesTableBody.innerHTML = customerInvoices.map(invoice => {
    const statusMap = {
      1: { text: 'Open', class: 'open' },
      2: { text: 'Past Due', class: 'past-due' },
      3: { text: 'Paid', class: 'paid' }
    };
    const status = statusMap[invoice.invoiceStatus] || { text: 'Unknown', class: '' };
    
    return `
      <tr class="clickable-row" onclick="handleInvoiceClick(${invoice.invoiceId})" style="cursor: pointer;">
        <td><strong>${invoice.invoiceNumber}</strong></td>
        <td>${new Date(invoice.invoiceDate).toLocaleDateString()}</td>
        <td>$${(invoice.invoiceAmount || 0).toFixed(2)}</td>
        <td>$${(invoice.invoicePaidAmount || 0).toFixed(2)}</td>
        <td><span class="status-badge ${status.class}">${status.text}</span></td>
      </tr>
    `;
  }).join('');
};

// Handle invoice click from customer details
const handleInvoiceClick = (invoiceId) => {
  // Close customer details modal
  closeCustomerDetailsModal();
  
  // Show invoice details
  showInvoiceDetails(invoiceId);
};

// Close customer details modal
const closeCustomerDetailsModal = () => {
  const modal = document.getElementById('customer-details-modal');
  modal.style.display = 'none';
  window.currentCustomerId = null;
};

// Edit customer - populate form and switch to edit mode
const editCustomer = (customerId) => {
  const customer = CustomerManager.getCustomer(customerId);
  if (!customer) {
    alert('Customer not found');
    return;
  }

  // Close details modal if open
  closeCustomerDetailsModal();

  // Populate form with customer data
  document.getElementById('firstName').value = customer.firstName || '';
  document.getElementById('lastName').value = customer.lastName || '';
  document.getElementById('email').value = customer.email || '';
  document.getElementById('phone').value = customer.phone || '';
  document.getElementById('company').value = customer.company || '';
  document.getElementById('address').value = customer.address || '';
  document.getElementById('city').value = customer.city || '';
  document.getElementById('state').value = customer.state || '';
  document.getElementById('zip').value = customer.zip || '';
  document.getElementById('service-type').value = customer.serviceType || '';

  // Store in edit mode
  window.editingCustomerId = customerId;

  // Change submit button text
  const submitBtn = document.querySelector('#customer-form button[type="submit"]');
  submitBtn.textContent = 'Update Customer';

  // Switch to customer form section
  switchSection('customers');

  // Scroll to top
  document.querySelector('.section-content').scrollIntoView({ behavior: 'smooth' });
};

// Delete customer with confirmation
const deleteCustomerConfirm = (customerId) => {
  const customer = CustomerManager.getCustomer(customerId);
  if (!customer) {
    alert('Customer not found');
    return;
  }

  if (confirm(`Are you sure you want to delete customer "${customer.firstName} ${customer.lastName}"? This action cannot be undone.`)) {
    deleteCustomer(customerId);
  }
};

// Delete customer via API and local storage
const deleteCustomer = async (customerId) => {
  try {
    const customer = CustomerManager.getCustomer(customerId);
    if (!customer) {
      alert('Customer not found');
      return;
    }

    // Call Payabli API to delete customer
    const deleteUrl = `${Config.get('apiBaseUrl')}/api/customer/${customer.customerId}`;
    
    const response = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'requestToken': Config.get('apiToken')
      }
    });

    const data = await response.json();

    if (!response.ok || !data.isSuccess) {
      throw new Error(data.responseText || 'Failed to delete customer from Payabli');
    }

    // Remove from local storage
    CustomerManager.removeCustomer(customerId);

    // Close modal and refresh display
    closeCustomerDetailsModal();
    displayCustomers();
    updateCustomerSelectors();
    updateCustomerStatus();

    // Show success message
    alert(`Customer "${customer.firstName} ${customer.lastName}" has been deleted successfully.`);

    // Refresh invoice list if visible
    if (document.getElementById('invoices-tbody')) {
      displayInvoices();
    }
  } catch (error) {
    console.error('Error deleting customer:', error);
    alert('Failed to delete customer: ' + error.message);
  }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  updateCustomerSelectors();
  updateCustomerStatus();
});