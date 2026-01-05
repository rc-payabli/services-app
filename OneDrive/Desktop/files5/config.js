// Configuration Module
const Config = (() => {
  const storageKey = 'payabli-config';

  // Default configuration
  const defaults = {
    apiToken: '',
    entryPoint: '',
    entryId: '',
    publicToken: '',
    apiBaseUrl: 'https://api-sandbox.payabli.com'
  };

  // Initialize config from localStorage
  const init = () => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.warn('Failed to parse stored config:', e);
      }
    }
    return defaults;
  };

  let config = init();

  // Get a config value
  const get = (key) => {
    return config[key] || defaults[key];
  };

  // Get all config
  const getAll = () => {
    return { ...config };
  };

  // Set config values
  const set = (updates) => {
    config = { ...config, ...updates };
    localStorage.setItem(storageKey, JSON.stringify(config));
    return config;
  };

  // Check if essential config is set
  const isConfigured = () => {
    return config.apiToken && config.entryPoint && config.entryId && config.publicToken;
  };

  // Clear all config
  const clear = () => {
    config = { ...defaults };
    localStorage.removeItem(storageKey);
  };

  return {
    get,
    getAll,
    set,
    isConfigured,
    clear,
    defaults
  };
})();

// Configuration UI Management
const showConfig = () => {
  const modal = document.getElementById('config-modal');
  const config = Config.getAll();

  // Hardcoded Payabli credentials
  const hardcodedCredentials = {
    apiToken: 'o.pZE2ysSo0mvburU7byuDb/yU9xh6oUqDwU4+Q+elCSaFsVXSSVuyRzGitTiA51EnvRcxjsRVL01CUeQ8JpytziZmTOfqcXdX8/8N3GJlP23K8AlnGHxjsZnnUiOj4ios/YCUVTub8q4ZPPLp452lc4GNjTJLVh3Wm6NPKZWeP96Z/HF51d1I/kFpdeRsJgt89mlkR/9JOlZe40ZXruLXMeBhwVFMH8sj6VSdQrmeq7DXW+NNCpLZT8i2KAB0+Ij1kes64zjyEJ8rqgPXzkkp5qZeLW6+KUGAew8ekLVRLv2a2GrPdL+HCOwGvU6vx5SkjwPoLCXIjK04npDU8ew3SZFehnFMAzFB8Mi9CQZGcw+NKsng9C/izOLTyVwy/ely1mvAua9d1zvpmYiFLSO/6iVrF+R3Pj76uCMVfWdgbdQDiWHmH+ZYjRgxWf8k7ByG3DK3MWb0t12C4sEZZ6OL3hn5fn0h6e+EUT2bv3HETmE3HeoLIgcj9yoZwjcOaL0Y.6y7HWn9mX5R+H8M08GBjt3p63P/R9e6vOs2+R1EIW5o=',
    entryPoint: 'bcde75fe53',
    entryId: '446',
    publicToken: 'o.WDG1BGnu5sUAs9G2i8oc4Pj8jl/Vwnw//+VxT/nRnZM4hDdPWs7s4KoieabWxw34vwNlt6v8Fhluz9YkW+YXjyaUT0pm1Fylsm91TKGHOEqnX3ELOsJ8Qw+rN9Th8W9IszHmr2pRpCXSV1g97/BDN/mTGaDhgSwUqN6omqmXRrmK3is3EQk/00Zd37pwBth4G6HVfoQnGCbcE/h97+klN2ec7AvYO5l9wvOhhPQ530AlT5i0F80rSCz9cO9i50Xidzgd3yYPJURnoXTjxMftBuURH5++JUk/iKO0GUpOdYiQjCrqQ/jnHSoRCpTrvMmBbnf8izDG+abMRiQr88sSI2jLE3CDfRw2otvkJysRbCPXBThxCjtZ5oxxHBLdHxGgdOnV2YMERUTYVdns6u5ucKj9se4zrgQ9QIyBKFr1dGTlP94DBHbmBnSLXIBuzsvUiO1klZD2AnfCARf4lDhj8HO1surkYLynIGZfCoRQI5dPcfYU1WUq7k2KPSJr7Xz1.DT59BOkgOHpLJcrXCEfd4aDxdZYIxM+qxRQAG5V4qPk=',
    apiBaseUrl: 'https://api-sandbox.payabli.com'
  };

  document.getElementById('api-token').value = hardcodedCredentials.apiToken;
  document.getElementById('entry-point').value = hardcodedCredentials.entryPoint;
  document.getElementById('entry-id').value = hardcodedCredentials.entryId;
  document.getElementById('public-token').value = hardcodedCredentials.publicToken;
  document.getElementById('api-base-url').value = hardcodedCredentials.apiBaseUrl;
  document.getElementById('config-message').textContent = '';

  modal.style.display = 'flex';
};

const closeConfig = () => {
  const modal = document.getElementById('config-modal');
  modal.style.display = 'none';
};

const saveConfig = () => {
  const apiToken = document.getElementById('api-token').value.trim();
  const entryPoint = document.getElementById('entry-point').value.trim();
  const entryId = document.getElementById('entry-id').value.trim();
  const publicToken = document.getElementById('public-token').value.trim();
  const apiBaseUrl = document.getElementById('api-base-url').value.trim() || Config.defaults.apiBaseUrl;

  const messageEl = document.getElementById('config-message');

  // Validation
  if (!apiToken) {
    showMessage(messageEl, 'API Token is required', 'error');
    return;
  }

  if (!entryPoint) {
    showMessage(messageEl, 'Entry Point is required', 'error');
    return;
  }

  if (!entryId) {
    showMessage(messageEl, 'Entry ID is required', 'error');
    return;
  }

  if (!publicToken) {
    showMessage(messageEl, 'Public Token is required', 'error');
    return;
  }

  // Save configuration
  Config.set({
    apiToken,
    entryPoint,
    entryId,
    publicToken,
    apiBaseUrl
  });

  showMessage(messageEl, 'Configuration saved successfully!', 'success');

  // Close modal after 1.5 seconds
  setTimeout(() => {
    closeConfig();
  }, 1500);
};

// Utility function to show/hide messages
const showMessage = (element, text, type = 'success') => {
  element.textContent = text;
  element.className = `message show ${type}`;

  // Auto-hide messages after a delay
  if (type === 'error') {
    setTimeout(() => {
      element.className = 'message';
    }, 5000);
  } else if (type === 'success') {
    setTimeout(() => {
      element.className = 'message';
    }, 3000);
  }
};

// Phone number formatting utility
const formatPhoneNumber = (phone) => {
  if (!phone) return '';
  
  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');
  
  // Handle different lengths
  if (digitsOnly.length === 10) {
    // US format: (555) 555-5555
    return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
  } else if (digitsOnly.length === 11 && digitsOnly[0] === '1') {
    // US format with country code: (555) 555-5555
    return `(${digitsOnly.slice(1, 4)}) ${digitsOnly.slice(4, 7)}-${digitsOnly.slice(7)}`;
  } else if (digitsOnly.length > 10) {
    // International format: keep as is but extract the useful part
    return phone;
  }
  
  return phone;
};

// Close modal when clicking outside
document.addEventListener('click', (e) => {
  const modal = document.getElementById('config-modal');
  if (e.target === modal) {
    closeConfig();
  }
});

// Check configuration on page load
document.addEventListener('DOMContentLoaded', () => {
  if (!Config.isConfigured()) {
    console.warn('Payabli configuration not set. Please configure your credentials.');
    // Optionally auto-open the config modal
    // showConfig();
  }
});
