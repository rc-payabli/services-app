# Field Services Web App - Payabli Integration

A modular, single-page web application for field services companies to manage customers, invoices, and payments using Payabli's APIs and EmbeddedMethod UI.

## Features

- **Customer Management**: Create and manage customers with detailed contact information and service types
- **Invoice Management**: Create invoices with line items, discounts, and automatic total calculations
- **Invoice Viewing**: Filter and sort invoices by customer, status, date, and amount
- **Payment Processing**: Accept payments directly in the app using EmbeddedMethod UI with card and ACH options
- **Persistent Storage**: All data stored locally in browser localStorage (read-only from Payabli APIs)
- **Rate Limiting**: Built-in request throttling to stay under 20 RPS limit
- **PCI Compliance**: Uses EmbeddedMethod UI for secure payment handling without storing card data

## Project Structure

```
field-services-app/
├── index.html           # Main HTML entry point with modular sections
├── styles.css           # Complete styling for UI
├── config.js            # Configuration management and modal
├── api-client.js        # Payabli API client with rate limiting
├── customers.js         # Customer creation and management
├── invoices.js          # Invoice creation, viewing, filtering, sorting
├── payments.js          # Payment processing with EmbeddedMethod UI
├── app.js               # Main app controller and navigation
└── README.md            # This file
```

## Installation and Setup

### 1. Local Setup

No build process required. Simply clone or download the files to a directory and serve via HTTP:

```bash
# Using Python 3
python -m http.server 8000

# Using Node.js http-server
npx http-server

# Using PHP
php -S localhost:8000
```

Then navigate to `http://localhost:8000`

### 2. Configure Payabli Credentials

1. Click the **⚙️ Config** button in the bottom of the sidebar
2. Enter your credentials:
   - **API Token**: Your Payabli API key (from PartnerHub)
   - **Entry Point**: Your Payabli entry point ID
   - **Public Token**: Your public token for embedded components
   - **API Base URL**: (defaults to sandbox; use production URL if needed)
3. Click **Save Configuration**

Your credentials are stored in browser localStorage only (never sent anywhere except Payabli API).

## Architecture

### Modular Design

The app is organized into independent modules that communicate through:

1. **Config Module** - Centralized configuration management
2. **APIClient Module** - Handles all Payabli API calls with rate limiting
3. **CustomerManager Module** - Customer data operations
4. **InvoiceManager Module** - Invoice operations with local storage
5. **PaymentManager Module** - Payment processing and temp token handling
6. **AppController Module** - Navigation and app state management

### Data Flow

```
User Input → Form Handlers → Manager Modules → APIClient → Payabli APIs
                                    ↓
                            localStorage Cache
                                    ↓
                            UI Display/Tables
```

### API Integration

**Verified endpoints (Swagger Authority: 95% confidence)**

#### Customer Creation
- **Endpoint**: `POST /api/Customer/single/{entryPoint}`
- **Response**: Returns `customerId` and full customer record
- **Storage**: Customer data cached in localStorage with Payabli response

#### Invoice Creation
- **Endpoint**: `POST /api/Invoice/{entryPoint}`
- **Payload**: Customer data + invoice data with line items
- **Response**: Returns `invoiceId`
- **Storage**: Invoice metadata stored locally; invoices queried from localStorage

#### Invoice Retrieval
- **Endpoint**: `GET /api/Query/invoices/{entryPoint}`
- **Filtering**: Supports customerId, customerEmail, status filters
- **Storage**: Results cached in localStorage after first load

#### Payment Processing (Temp Token Flow)
1. **Component Generation**: EmbeddedMethod UI generates temp token (`referenceId`)
2. **Payment**: `POST /api/MoneyIn/getpaid` with temp token as `storedMethodId`
3. **Tracking**: Payment stored locally; invoice marked as paid

## API Confidence Matrix

| Source | Confidence | Details |
|--------|-----------|---------|
| Swagger (Live APIs) | 95% | Real-time API contracts; primary authority |
| Inkeep MCP | 80% | May lag 1-2 sprints; used for implementation examples |
| Local Storage | 90% | Customer/invoice data cached locally |
| Component Callbacks | 95% | EmbeddedMethod UI response handling verified |

## Key Implementation Details

### Rate Limiting

The APIClient enforces 20 RPS (requests per second) by:
1. Queuing all requests
2. Calculating minimum interval between requests (50ms for 20 RPS)
3. Processing queued requests sequentially with proper timing

```javascript
const maxRequestsPerSecond = 20;
const minInterval = 1000 / maxRequestsPerSecond; // 50ms
```

### Customer Identifier Configuration

Customers require at least one identifier field. This app uses `email` as the primary identifier. Configure additional identifiers in your Payabli PartnerHub settings.

### Invoice Items

Invoices support multiple line items with:
- Description, quantity, unit cost
- Automatic total calculation
- Discount percentage applied to subtotal
- Server-side validation in Payabli API

### Payment Flow (Temp Token)

```
User enters card → EmbeddedMethod UI tokenizes → Temp token returned
  → Frontend sends temp token to backend → Backend calls MoneyIn/getpaid
    → Payment processed → Invoice marked paid → UI updates
```

**Why Temp Tokens?**
- Single-use tokens that expire after 2 minutes
- Reduces PCI scope by keeping tokens off-screen
- User can retry if initial transaction fails
- No permanent token storage on client

## Limitations and Considerations

### Current State (MVP)

- **No Persistence Backend**: All data stored in browser localStorage only
- **Single-Device**: Data not synced across devices/browsers
- **Offline**: Requires internet connection; no offline mode
- **Pagination**: Invoices limited to ~100 records per load
- **Webhooks**: Uses polling; real-time updates not implemented

### Recommended Enhancements for Production

1. **Backend Database**: Move customer/invoice storage to persistent backend
2. **User Authentication**: Add login/multi-tenant support
3. **Webhooks**: Replace polling with real-time webhook updates
4. **Error Retry Logic**: Implement exponential backoff for failed requests
5. **Audit Logging**: Track all payment/invoice changes
6. **Export**: Add PDF invoice generation and payment receipts
7. **Mobile**: Responsive design works; consider native app for offline
8. **PCI Audit**: Verify all requirements met before production

## Error Handling

The app handles errors in three layers:

1. **Form Validation**: Client-side checks before API calls
2. **API Errors**: Caught and displayed in user-friendly messages
3. **Configuration Errors**: Warns if credentials not set

Error messages auto-hide after 5 seconds; users can also manually close.

## Testing the App

### Test Flow

1. **Configure**: Enter test API credentials from Payabli sandbox
2. **Create Customer**: Add a test customer (any name/email)
3. **Create Invoice**: Select customer, add items, set amount
4. **View Invoices**: Filter/sort to verify data
5. **Pay Invoice**: Select invoice, enter amount, use test card
   - Test Card: 4111 1111 1111 1111 (any future expiry, any CVV)
6. **Verify**: Check invoice status updates to "Paid"

### Browser Console

Monitor API calls and data flow:
```javascript
// Check stored customers
JSON.parse(localStorage.getItem('field-services-customers'))

// Check stored invoices
JSON.parse(localStorage.getItem('field-services-invoices'))

// Check stored payments
JSON.parse(localStorage.getItem('field-services-payments'))

// View configuration
Config.getAll()
```

## API Rate Limiting Best Practices

The app implements request queuing to respect the 20 RPS limit:

```javascript
// All API requests are queued automatically
await APIClient.createCustomer(data); // Queued
await APIClient.createInvoice(data);  // Queued sequentially
```

For bulk operations (> 50 items), consider adding delays between requests.

## Troubleshooting

### "Configuration not set" warning
- Click ⚙️ Config button and enter your credentials
- Verify API token has correct permissions in PartnerHub

### "Failed to create customer"
- Check API token is valid
- Verify entry point ID matches your Payabli setup
- Ensure email is unique (or use `replaceExisting: 1` parameter)

### "EmbeddedMethod UI not loading"
- Verify public token is set in config
- Check browser console for CORS errors
- Ensure `entryPoint` matches your Payabli setup

### "Payment shows success but invoice not updated"
- Check browser console for API errors
- Verify payment amount matches invoice amount due
- Refresh page to see updated invoice status

## API Documentation References

- [Payabli Customer API](https://docs.payabli.com/developers/api-reference/customer)
- [Payabli Invoice API](https://docs.payabli.com/developers/api-reference/invoice)
- [Payabli EmbeddedMethod UI](https://docs.payabli.com/developers/developer-guides/embedded-components-embeddedmethodui)
- [Payabli Temp Token Flow](https://docs.payabli.com/developers/developer-guides/tokenization-temporary-flow)
- [Payabli MoneyIn API](https://docs.payabli.com/developers/api-reference/moneyin)

## License

This example app is provided as-is. Adapt for your specific needs.
