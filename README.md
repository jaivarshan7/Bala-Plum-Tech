# PlumbTrack

PlumbTrack is a lightweight commercial plumbing inventory management system built with HTML, CSS, and Vanilla JavaScript using Firebase services.

## Overview

This app helps plumbing businesses track inventory, record stock movements, monitor low-stock items, and keep an audit trail of every stock action. It is designed for simple use by non-technical employees while still enforcing important business rules.

## Features

- Firebase Authentication with OWNER and EMPLOYEE roles
- Inventory management with categories and stock levels
- Stock In and Stock Out workflows
- Firestore transaction-based inventory updates
- Recent transactions and low-stock alerts
- Dashboard summary cards and activity feed
- Employee and profile management
- Mobile-first responsive design
- Searchable Tom Select product dropdowns with dependent plumbing subcategories

## Project Structure

- `index.html` – entry page redirect
- `login.html` – login screen
- `dashboard.html` – overview dashboard
- `inventory.html` – inventory index and add-item modal
- `item-details.html` – item details and recent activity
- `transactions.html` – transaction history
- `low-stock.html` – low-stock alert page
- `employees.html` – owner-only employee management page
- `profile.html` – user profile details
- `settings.html` – business settings placeholder

## Firebase Setup

1. Create a Firebase project at https://console.firebase.google.com
2. Enable Authentication and choose Email/Password and Google sign-in providers
3. For Google sign-in, configure the authorized domain for your local and production hosts
4. Create a Firestore database
5. Copy your Firebase configuration into a local `.env` file using `.env.example` as a guide
6. Configure Firestore security rules using the provided `firestore.rules` file
7. Ensure your app loads through a local web server such as VS Code Live Server or a simple static server

## Local Development

Because the app uses ES modules and Firebase client APIs, do not open the HTML files directly with `file://` in a browser. Use a local HTTP server.

The inventory page loads Tom Select from jsDelivr for searchable Category, Subcategory, and Brand controls. An internet connection is required for those enhanced dropdowns; the underlying native select fields remain in the HTML for form compatibility.

Example:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

## Security Notes

The Firebase client configuration is not a secret, but the real protection comes from Firebase Authentication, Firestore security rules, and carefully designed access permission checks. Never expose service account credentials or admin SDK secrets in browser code.

## Recommended Workflow for Creating Employee Accounts

For a production-ready deployment, create new employee authentication accounts through a secure backend or Firebase Admin workflow. Do not build client-side account creation that exposes privileged admin logic to the browser.

## Important Inventory Integrity Rule

Stock changes must use Firestore transactions so that inventory is never updated incorrectly when multiple employees act at the same time.

## Firestore Data Model

The app expects collections including:

- `users`
- `inventory`
- `inventoryTransactions`
- `notifications`

Each document should follow the business rules described in the app specification.

## Inventory Categories and Units

Inventory creation uses the reusable plumbing category/subcategory map and unit list in `js/utils/constants.js`. Units are stored by symbol, such as `pcs`, `box`, `m`, or `kg`.

New inventory documents include `category`, `subcategory`, `unit`, `brand`, `size`, `stock`, `minimumStock`, `sku`, and `description`. Existing documents using `quantity` and `minimumQuantity` remain supported and are displayed through compatibility fallbacks. No Firebase migration is required immediately; existing products can be edited to populate the new fields.

## Google Login Roles

New Google accounts are automatically given the `EMPLOYEE` role. To make a Google account an owner, update that user document in Firestore and set `role` to `OWNER`.

## License

This project is intended as a business inventory management starter and can be expanded into a broader plumbing operations platform.
