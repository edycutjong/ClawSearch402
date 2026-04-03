# ClawSearch 402 Dashboard

This is the Next.js frontend dashboard for the **ClawSearch 402** architecture. It provides real-time insights, metrics, and visualization of the proxy's performance and revenue generation via the Stellar USDC X-402 protocol.

## Features

- **Live Activity Feed**: Monitor incoming search requests in real-time as they hit the proxy.
- **Revenue Dashboard**: Track USDC earnings and micropayment accumulations.
- **Search Analytics**: View request volume, token usage, and system health.
- **Docker Ready**: Pre-configured to build as a standalone lightweight Docker container alongside the rest of the stack.

## Getting Started

Because this dashboard is part of the ClawSearch monorepo, the easiest way to run it is from the root of the project using the unified npm scripts.

### Option A: From Project Root (Recommended)

```bash
# Returns to the root monorepo directory
cd ../../

# Run the entire stack concurrently (Proxy + Dashboard)
npm run dev

# Or run just the dashboard independently
npm run dashboard
```

### Option B: From This Directory

If you are working strictly within `apps/dashboard`:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the live dashboard.

## Deployment & Dockerization

This app uses Next.js 14 structured with the Modern `app/` router and Tailwind CSS.
It is configured via `next.config.ts` to output a `standalone` build. This allows it to be bundled into an ultra-lean Docker runner.

To deploy it via Docker alongside the proxy and SearXNG search engine, simply return to the root of the project and execute:

```bash
npm run docker:up
```
