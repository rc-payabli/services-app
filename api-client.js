// API Client Module
const APIClient = (() => {
  const maxRequestsPerSecond = 20;
  let requestQueue = [];
  let lastRequestTime = 0;
  let processingQueue = false;

  // Rate limiter - process requests at max RPS
  const processQueue = async () => {
    if (processingQueue || requestQueue.length === 0) return;
    processingQueue = true;

    while (requestQueue.length > 0) {
      const now = Date.now();
      const timeSinceLastRequest = now - lastRequestTime;
      const minInterval = 1000 / maxRequestsPerSecond;

      if (timeSinceLastRequest < minInterval) {
        await new Promise(resolve => 
          setTimeout(resolve, minInterval - timeSinceLastRequest)
        );
      }

      const request = requestQueue.shift();
      lastRequestTime = Date.now();
      
      try {
        await request();
      } catch (error) {
        console.error('Queued request error:', error);
      }
    }

    processingQueue = false;
  };

  // Main request function
  const request = (method, endpoint, data = null, isQueue = true) => {
    return new Promise((resolve, reject) => {
      const executeRequest = async () => {
        try {
          const url = `${Config.get('apiBaseUrl')}${endpoint}`;
          const headers = {
            'Content-Type': 'application/json',
            'requestToken': Config.get('apiToken')
          };

          const options = {
            method,
            headers
          };

          if (data) {
            options.body = JSON.stringify(data);
          }

          const response = await fetch(url, options);
          const responseData = await response.json();

          // Handle HTTP errors
          if (!response.ok) {
            reject({
              status: response.status,
              statusText: response.statusText,
              data: responseData
            });
            return;
          }

          resolve(responseData);
        } catch (error) {
          reject({
            message: error.message,
            error
          });
        }
      };

      if (isQueue) {
        requestQueue.push(executeRequest);
        processQueue();
      } else {
        executeRequest().then(resolve).catch(reject);
      }
    });
  };

  // Customer API calls
  const createCustomer = (customerData) => {
    const entryPoint = Config.get('entryPoint');
    return request('POST', `/api/Customer/single/${entryPoint}`, customerData);
  };

  // Invoice API calls
  const createInvoice = (invoiceData) => {
    const entryPoint = Config.get('entryPoint');
    return request('POST', `/api/Invoice/${entryPoint}`, invoiceData);
  };

  const getInvoice = (invoiceId) => {
    return request('GET', `/api/Invoice/${invoiceId}`);
  };

  const listInvoices = (filters = {}, sortBy = 'desc(invoiceDate)', fromRecord = 0, limitRecord = 100) => {
    const entryPoint = Config.get('entryPoint');
    
    // Build query parameters
    const params = new URLSearchParams();
    params.append('fromRecord', fromRecord);
    params.append('limitRecord', limitRecord);
    params.append('sortBy', sortBy);

    // Add filter parameters
    if (Object.keys(filters).length > 0) {
      params.append('parameters', JSON.stringify(filters));
    }

    const endpoint = `/api/Query/invoices/${entryPoint}?${params.toString()}`;
    return request('GET', endpoint, null);
  };

  // Payment API calls
  const processPayment = (paymentData) => {
    return request('POST', '/api/MoneyIn/getpaid', paymentData);
  };

  const getPaymentStatus = (transactionId) => {
    return request('GET', `/api/Transaction/${transactionId}`);
  };

  // Statistics API calls
  // mode: wtd, mtd, ytd, d30, m12, h24, today, lastw, lastm, lasty, yesterday, custom
  // freq: d (daily), w (weekly), m (monthly), h (hourly)
  // level: 0 for Organization, 2 for Paypoint
  const getStatistics = (mode = 'd30', freq = 'd') => {
    const entryId = Config.get('entryId');
    if (!entryId) {
      return Promise.reject(new Error('Entry ID not configured'));
    }
    const level = 2; // Paypoint level
    return request('GET', `/api/Statistic/basic/${mode}/${freq}/${level}/${entryId}`);
  };

  return {
    // Customer operations
    createCustomer,

    // Invoice operations
    createInvoice,
    getInvoice,
    listInvoices,

    // Payment operations
    processPayment,
    getPaymentStatus,

    // Statistics operations
    getStatistics,

    // Utility
    request
  };
})();
