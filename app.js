// Main Application Controller

const AppController = (() => {
  let currentSection = 'customers';

  const init = () => {
    setupSectionNavigation();
    setupTabNavigation();
    checkConfiguration();
  };

  const setupSectionNavigation = () => {
    const navButtons = document.querySelectorAll('.nav-button[data-section]');
    
    navButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const section = button.getAttribute('data-section');
        switchSection(section);
      });
    });
  };

  const setupTabNavigation = () => {
    const tabs = document.querySelectorAll('.payment-container .tab');
    
    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        // Remove active class from all tabs
        tabs.forEach(t => t.classList.remove('active'));
        // Add active class to clicked tab
        e.target.closest('.tab').classList.add('active');
      });
    });
  };

  const checkConfiguration = () => {
    if (!Config.isConfigured()) {
      console.warn('App not configured. User should configure API credentials.');
    }
  };

  return {
    init
  };
})();

// Global switch section function
const switchSection = (sectionName) => {
  // Hide all sections
  const sections = document.querySelectorAll('.section');
  sections.forEach(section => {
    section.classList.remove('active');
  });

  // Remove active from all nav buttons
  const navButtons = document.querySelectorAll('.nav-button');
  navButtons.forEach(button => {
    button.classList.remove('active');
  });

  // Show selected section
  const section = document.getElementById(`section-${sectionName}`);
  if (section) {
    section.classList.add('active');
  }

  // Mark corresponding nav button as active
  const navButton = document.querySelector(`.nav-button[data-section="${sectionName}"]`);
  if (navButton) {
    navButton.classList.add('active');
  }

  // Update page title
  const titles = {
    'customers': 'Add Customer',
    'view-customers': 'View Customers',
    'create-invoice': 'Create Invoice',
    'view-invoices': 'View Invoices',
    'pay-invoice': 'Pay Invoice'
  };

  const pageTitle = document.getElementById('page-title');
  if (pageTitle) {
    pageTitle.textContent = titles[sectionName] || 'Field Services';
  }

  // Handle specific section initializations
  if (sectionName === 'view-invoices') {
    displayInvoices();
  }

  if (sectionName === 'view-customers') {
    displayCustomers();
  }

  if (sectionName === 'dashboard') {
    if (window.DashboardManager) {
      window.DashboardManager.updateDashboard();
      console.log('Dashboard refreshed');
    } else {
      console.warn('DashboardManager not available yet');
    }
  }

  if (sectionName === 'pay-invoice') {
    // Refresh customer list in payment section
    updateCustomerSelectors();
    console.log('Pay invoice section loaded, customers available');
  }
};

// Initialize app on page load
document.addEventListener('DOMContentLoaded', () => {
  AppController.init();

  // Set first section as active
  switchSection('dashboard');

  // Load customer list in sidebar
  if (typeof displayCustomers === 'function') {
    displayCustomers();
  }
  if (typeof updateCustomerSelectors === 'function') {
    updateCustomerSelectors();
  }

  // Refresh invoice display
  if (InvoiceManager) {
    displayInvoices();
  }

  // Initialize dashboard
  if (DashboardManager) {
    DashboardManager.updateDashboard();
  }
});

// Export showMessage utility for use across modules
window.showMessage = (element, text, type = 'success') => {
  if (!element) return;

  element.textContent = text;
  element.className = `message show ${type}`;

  if (type === 'error' || type === 'success') {
    setTimeout(() => {
      element.className = 'message';
    }, 5000);
  }
};