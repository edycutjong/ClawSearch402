# ClawSearch Mock Clients

This directory contains standalone scripts (written across various languages like Node.js and Python) that simulate HTTP requests hitting the ClawSearch Proxy. 

These scripts demonstrate how an AI Agent or CLI tool would:
1. Fire a request to the proxy protected by the X-402 paywall.
2. Intercept the resulting `402 Payment Required` challenge.
3. Automatically calculate and sign a Stellar USDC micropayment transaction through the `x402` SDK protocols.
4. Retry the request with the attached receipt and retrieve the protected web search data.

> **Note**: These are internal testing workspaces of the ClawSearch monorepo.
> 
> For initial setup, Stellar wallet funding, API key management, and Docker deployment instructions, please see the **[Root Documentation](../README.md)**.
