# Quick Start Guide

Get the Field Services Dashboard running in 5 minutes.

## 1. Start the Server

```bash
# Navigate to the project folder
cd field-services-dashboard

# Start a local server (choose one)
python -m http.server 8000
# or
npx serve
```

## 2. Open the App

Go to `http://localhost:8000` in your browser.

## 3. Configure Credentials

1. Click the **Settings** icon (gear) in the sidebar
2. Enter your Payabli credentials:
   - API Token
   - Entry Point
   - Entry ID
   - Public Token
3. Click **Save Configuration**

## 4. Create a Customer

1. Click **Customers** in the sidebar
2. Fill out the customer form
3. Click **Add Customer**

## 5. Create an Invoice

1. Click **Invoices** in the sidebar
2. Click **Create Invoice**
3. Search and select a customer
4. Add line items
5. Click **Create Invoice**

## 6. Process a Payment

1. Click **Payments** in the sidebar
2. Select an invoice
3. Enter payment details using the secure form
4. Click **Pay Now**

## Dashboard Features

- **Revenue Trend** - Select time periods from the dropdown (Last 24 Hours, Month to Date, Year to Date, etc.)
- **Payment Acceptance** - Shows card vs ACH acceptance rates
- **Quick Stats** - Customer and invoice counts
- **Recent Activity** - Latest actions in the app

## Troubleshooting

**Config modal won't open?**
- Hard refresh the page (Ctrl+Shift+R)

**API errors?**
- Check browser console for details
- Verify your credentials are correct
- Make sure Entry ID is the numeric ID, not the entry point string

**Charts not loading?**
- Ensure configuration is saved
- Check that Entry ID is set correctly
