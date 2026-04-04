# Contributing to ClawSearch402

First off, thank you for considering contributing to ClawSearch402! This document provides guidelines and instructions for contributing to the Agentic Web Search Monetization Network.

## Project Structure
ClawSearch402 is structured as a monorepo containing multiple apps and clients:

- `apps/proxy`: The core x402-gated proxy server handling search requests.
- `apps/dashboard`: Next.js 16 analytics and live view dashboard.
- `clients/node`: Example Node.js autonomous agent client using Stellar USDC.
- `clients/python`: Example Python agent script for x402 discovery.

## Local Setup

### Prerequisites
- [Node.js](https://nodejs.org/en/) v18+ 
- [NPM](https://www.npmjs.com/) or Yarn/PNPM
- A Stellar Testnet Keypair (with some testnet lumens)

### 1. Install Dependencies
From the root of the repository, navigate to each app and install:
```bash
cd apps/proxy && npm install
cd ../dashboard && npm install
cd ../../clients/node && npm install
```

### 2. Configure Environment Variables
You will need to set up `.env` files in `apps/proxy` and `clients/node`.

#### `apps/proxy/.env`
```env
# The Stellar address that will receive the USDC micropayments
PAY_TO="GXXXXXXXX..."

# External facilitator URL for L4 HTTP payment protocols
FACILITATOR_URL="https://x402.org/facilitator"

# (Optional) API Keys for search fallbacks
BRAVE_API_KEY=""
```

#### `clients/node/.env`
```env
# Your Stellar Testnet private key (used to sign payments)
STELLAR_PRIVATE_KEY="SXXXXXXXX..."
PROXY_URL="http://localhost:3001"
```

### 3. Run the Proxy and Dashboard

Start the proxy server (handles search, SQLite, and payments):
```bash
cd apps/proxy
npm run dev
```

Start the Next.js dashboard (live visualizing payments):
```bash
cd apps/dashboard
npm run dev
```

The dashboard will be available at [http://localhost:3000](http://localhost:3000).

### 4. Run the Client (Test Search)

In a separate terminal, trigger the Node.js client to perform a simulated agentic search:
```bash
cd clients/node
node index.js "machine to machine payments"
```
Or run the demo script to fire multiple queries logic and light up your local dashboard:
```bash
node index.js --demo
```

## Pull Request Process

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. Ensure the test suite passes.
4. Issue that pull request!

### Coding Standards
- Follow the existing code style.
- Prefer ESModules (`import`/`export`).
- Ensure any `x402` specific integrations use `@x402/core` packages correctly.
- Add validations around external data passing into SQLite.

## Reporting Bugs

Please use GitHub Issues to report bugs. Include a detail of the bug, the environment (Node version, OS), and instructions to reproduce it.

Thanks for contributing!
