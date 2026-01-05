# Build Summary

## Overview

Field Services Dashboard is a demo application showcasing Payabli payment integration for a field services business. It demonstrates customer management, invoicing, and payment processing workflows.

## Design

- **Theme**: Dashio-inspired modern design
- **Colors**: Indigo primary (#4F46E5), light gray backgrounds
- **Typography**: Inter font family
- **Layout**: Fixed sidebar with main content area

## Core Modules

### config.js
Configuration management with localStorage persistence. Stores API credentials securely in the browser.

### api-client.js
Payabli API client with rate limiting (20 requests/second). Handles all API communication.

### dashboard.js
Dashboard analytics including:
- KPI cards (Revenue, Pending, Overdue, Success Rate)
- Revenue Trend chart with time period selector
- Payment Acceptance visualization
- Quick Stats grid
- Activity Feed

### customers.js
Customer CRUD operations. Syncs with Payabli Customer API.

### invoices.js
Invoice management with line items, due dates, and status tracking.

### payments.js
Payment processing using Payabli EmbeddedMethod component for PCI-compliant card entry.

## Key Features

### Revenue Trend Chart
- Fetches data from `/api/Statistic/basic/{mode}/{freq}/{level}/{entryId}`
- Time periods: h24, wtd, lastw, mtd, d30, lastm, ytd, m12
- Auto-adjusts frequency (hourly/daily/monthly) based on range
- Displays inTransactionsVolume metric

### Payment Form
- Uses Payabli EmbeddedMethod for secure card/ACH entry
- Supports both card and ACH payment methods
- Tokenizes payment info client-side

### Activity Logging
- Tracks invoice creation, payments, emails, and cancellations
- Displays recent activity in dashboard feed

## File Structure

```
index.html           Main application shell
styles-dashio.css    All styling (1800+ lines)
config.js            Configuration and credentials
api-client.js        Payabli API wrapper
app.js               App controller and navigation
dashboard.js         Dashboard module
customers.js         Customer module
invoices.js          Invoice module
payments.js          Payment module
```

## Browser Support

Tested on modern browsers (Chrome, Firefox, Safari, Edge). Requires JavaScript enabled.
