# ClawSearch 402

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

ClawSearch 402 is an intelligent search gateway designed to be monetized on a per-request basis using the **X-402 protocol** and **Stellar USDC micropayments**. It lets AI agents or developers programmatically query the web while paying programmatically per HTTP request.

## Architecture

This project is built using a monorepo structure with Next.js, Express, and Node.js.

- `apps/proxy`: An Express server that proxies requests to a search API and guards those endpoints with the `@x402/express` middleware. It rejects requests lacking proper payment tokens with a HTTP `402 Payment Required` challenge, forcing the caller to settle a predefined Stellar USDC price.
- `apps/dashboard`: A Next.js dashboard providing insights into the system's traffic, search requests, and accumulated earnings.
- `clients/node`: A standalone Node.js CLI script simulating an AI agent correctly navigating the X-402 protocol using the `@x402/client` library. The client receives a 402, resolves the Stellar payment challenge, and safely requests data.

## Features

- Search the web endpoints protected by the `x-402` payment protocol.
- Pre-configured `Stellar Testnet` wallets dynamically funded via Friendbot.
- Rich responses: Retrieve basic search lists or markdown-enriched AI-optimised datasets.
- Event-streaming capabilities via `SSE` to observe searches in real-time.

## Setup Instructions

### 1. Generate & Fund Wallets

First, start by generating your cryptographic wallets and establishing the necessary Stellar Testnet configurations:

```bash
cd clients/node && npm install

# Autogenerate keys, create the testnet wallets, fund XLM, and setup USDC trustlines
node fund.js
```

> **Note**: This will automatically write to `.env` files across both the proxy and the node client configurations, preventing the need to securely manage them yourself!

### 2. Fund your Client Wallet with Testnet USDC

Because the `fund.js` script handles everything except generating the actual Testnet USDC (which is blocked by Cloudflare + CAPTCHA bots), you need to get the `USDC` manually to successfully trigger searches through the paywall.

1. Locate your **Client Wallet Address** (which is written your terminal or `clients/node/.env` as `STELLAR_PUBLIC_KEY`).
2. Visit the [Circle Testnet Faucet](https://faucet.circle.com/).
3. Choose the **Stellar Testnet** and input your public key.
4. Click 'Add Funds' and complete the CAPTCHA.

### 3. Start the Server

```bash
# Start all the apps concurrently from the root directory
npm install
npm run dev

# Or start the proxy independently
npm run proxy
```

Your search proxy will listen on `localhost:3001` and your dashboard on `localhost:3000`.

### 4. Perform a Search!

```bash
# In a new terminal, run the agent:
npm run agent "latest AI news"

# Try an enriched query (higher cost, more data):
npm run agent "latest AI news" --enriched
```

The node agent will query `localhost:3001/search`. Upon receipt of the 402 challenge, it will initiate a `.pay()` routine via Stellar, complete it successfully, and return an array of the latest web results.

## License
MIT
