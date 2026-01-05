# Field Services Dashboard

A demo Field Services SaaS application with Payabli payment integration. Built with vanilla JavaScript and styled with a modern Dashio-inspired design.

## Features

- **Customer Management** - Create and manage customer records
- **Invoice Management** - Create, send, and track invoices
- **Payment Processing** - Accept card and ACH payments via Payabli
- **Dashboard Analytics** - Revenue trends, payment acceptance rates, quick stats
- **Activity Feed** - Track recent actions and events

## Tech Stack

- Vanilla JavaScript (no framework)
- Chart.js for visualizations
- Payabli API for payments
- Payabli EmbeddedMethod component for secure payment forms

## Getting Started

1. Extract the files to a folder
2. Start a local server:
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node.js
   npx serve
   ```
3. Open `http://localhost:8000` in your browser
4. Click the Settings icon and save the configuration

## Configuration

The app requires Payabli credentials:

- **API Token** - Your Payabli API key
- **Entry Point** - Your paypoint entry name (e.g., `bcde75fe53`)
- **Entry ID** - Numeric paypoint ID (e.g., `446`)
- **Public Token** - Token for embedded payment components

## Project Structure

```
├── index.html          # Main HTML file
├── styles-dashio.css   # Dashio-themed styles
├── config.js           # Configuration management
├── api-client.js       # Payabli API client
├── app.js              # Main application controller
├── dashboard.js        # Dashboard and charts
├── customers.js        # Customer management
├── invoices.js         # Invoice management
├── payments.js         # Payment processing
└── server.js           # Optional Node.js server
```

## Payabli API Endpoints Used

- `POST /api/Customer/single/{entry}` - Create customer
- `POST /api/Invoice/{entry}` - Create invoice
- `GET /api/Query/invoices/{entry}` - List invoices
- `POST /api/MoneyIn/getpaid` - Process payment
- `GET /api/Statistic/basic/{mode}/{freq}/{level}/{entryId}` - Revenue statistics

## License

MIT
