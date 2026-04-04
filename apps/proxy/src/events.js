/**
 * Server-Sent Events (SSE) module
 * Broadcasts real-time payment events to connected dashboard clients
 */

const clients = new Set();

/**
 * Broadcast current client count to all connected clients
 */
function broadcastClientCount() {
  const data = JSON.stringify({ clients: clients.size });
  const message = `event: clients_update\ndata: ${data}\n\n`;
  for (const client of clients) {
    try {
      client.write(message);
    } catch {
      // Ignore errs
    }
  }
}

/**
 * SSE connection handler — attach to GET /api/events
 */
export function sseHandler(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // Send initial connection event to just this client
  res.write(`event: connected\ndata: ${JSON.stringify({ status: "connected", clients: clients.size + 1 })}\n\n`);

  clients.add(res);
  console.log(`  📡 SSE client connected (${clients.size} total)`);
  broadcastClientCount(); // Notify all clients

  // Send heartbeat every 30s to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(`event: heartbeat\ndata: ${JSON.stringify({ time: Date.now() })}\n\n`);
  }, 30000);

  req.on("close", () => {
    clients.delete(res);
    clearInterval(heartbeat);
    console.log(`  📡 SSE client disconnected (${clients.size} remaining)`);
    broadcastClientCount(); // Notify all clients
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
