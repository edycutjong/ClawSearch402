/**
 * Server-Sent Events (SSE) module
 * Broadcasts real-time payment events to connected dashboard clients
 */

const clients = new Set();

/**
 * SSE connection handler — attach to GET /api/events
 */
export function sseHandler(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // Send initial connection event
  res.write(`event: connected\ndata: ${JSON.stringify({ status: "connected", clients: clients.size + 1 })}\n\n`);

  clients.add(res);
  console.log(`  📡 SSE client connected (${clients.size} total)`);

  // Send heartbeat every 30s to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(`event: heartbeat\ndata: ${JSON.stringify({ time: Date.now() })}\n\n`);
  }, 30000);

  req.on("close", () => {
    clients.delete(res);
    clearInterval(heartbeat);
    console.log(`  📡 SSE client disconnected (${clients.size} remaining)`);
  });
}

/**
 * Broadcast a payment event to all connected SSE clients
 */
export function emitPaymentEvent(event) {
  const data = JSON.stringify(event);
  const message = `event: payment\ndata: ${data}\n\n`;

  for (const client of clients) {
    try {
      client.write(message);
    } catch {
      clients.delete(client);
    }
  }

  console.log(
    `  💰 Payment: $${event.amount} USDC from ${event.agent?.slice(0, 8)}... → "${event.query}"`
  );
}

/**
 * Get current number of connected SSE clients
 */
export function getClientCount() {
  return clients.size;
}
