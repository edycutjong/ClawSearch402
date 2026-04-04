const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const DASHBOARD_URL = process.env.DASHBOARD_URL || "http://localhost:3000";
const OUTPUT_DIR = path.join(__dirname, '..', 'demo_output');
const VIDEOS_DIR = path.join(OUTPUT_DIR, 'videos');
const SCREENSHOTS_DIR = path.join(OUTPUT_DIR, 'screenshots');

for (const dir of [OUTPUT_DIR, VIDEOS_DIR, SCREENSHOTS_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * Fires burst traffic using the burst.sh script
 */
function spawnBurst() {
  const { spawn } = require('child_process');
  return new Promise((resolve) => {
    console.log("🚀 Firing burst traffic...");
    const burst = spawn('bash', [path.join(__dirname, '..', 'public', 'projects', 'ClawSearch402', 'burst.sh')], {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
      env: { ...process.env }
    });
    burst.on('close', () => resolve());
    burst.on('error', () => resolve());
  });
}

/**
 * Fires traffic using curl directly (fallback)
 */
async function fireCurlBurst(count = 15) {
  const { execSync } = require('child_process');
  const PROXY_URL = process.env.PROXY_URL || "http://localhost:3001";
  
  const queries = [
    "decentralized micropayments",
    "AI agent infrastructure 2026",
    "stellar blockchain USDC",
    "x402 payment protocol",
    "machine to machine economy",
    "web search API pricing",
    "HTTP 402 payment required",
    "agentic web search network",
    "soroban smart contracts",
    "coinbase stablecoin payments",
    "autonomous AI agents",
    "micropayment rails crypto",
    "real-time settlement USDC",
    "agent wallet Stellar",
    "pay-per-query search API"
  ];

  for (let i = 0; i < count; i++) {
    const q = queries[i % queries.length];
    try {
      execSync(`curl -s "${PROXY_URL}/search?q=${encodeURIComponent(q)}" -o /dev/null`, {
        timeout: 5000
      });
      console.log(`  ⚡ Query ${i + 1}/${count}: "${q}"`);
    } catch {
      // Continue even if individual requests fail
    }
    // Small delay between requests for visual effect on graph
    await new Promise(r => setTimeout(r, 300));
  }
}

(async () => {
  console.log("🎬 ClawSearch 402 — Graph-Only Recorder\n");
  console.log("═══════════════════════════════════════════\n");

  try {
    console.log("🌐 Launching browser...");
    const browser = await chromium.launch({ headless: true });

    // Record video at a cropped viewport focused on the top section
    // The graph + stats cards are in roughly the top 520px of a 1080p layout
    const context = await browser.newContext({
      recordVideo: {
        dir: VIDEOS_DIR,
        size: { width: 1920, height: 600 }  // Cropped to graph area
      },
      viewport: { width: 1920, height: 600 },  // Only show top portion
      colorScheme: 'dark',
      deviceScaleFactor: 2
    });

    const page = await context.newPage();

    console.log(`📊 Opening dashboard (graph-only view): ${DASHBOARD_URL}`);
    await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Scroll down slightly so the graph is centered (skip header if needed)
    await page.evaluate(() => {
      window.scrollTo(0, 60);  // Skip just the top header to center the graph
    });
    await page.waitForTimeout(500);

    // Screenshot: Graph idle state
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'graph_idle.png'),
    });
    console.log("📸 Graph idle state captured");

    // Switch to short time window for dramatic spike
    try {
      const selectExists = await page.locator('select').count();
      if (selectExists > 0) {
        await page.selectOption('select', '5m');
        console.log("⏱️  Switched to '5m' view for dramatic spike");
      }
    } catch {
      console.log("⏱️  No time selector found, continuing...");
    }

    await page.waitForTimeout(1000);

    // ── Fire burst traffic ──────────────────────────────
    console.log("\n🚀 Starting traffic burst for graph spike...\n");
    await fireCurlBurst(15);

    // Wait for graph to update via SSE
    console.log("\n⏳ Waiting for graph to update (3s)...");
    await page.waitForTimeout(3000);

    // Screenshot: Graph mid-burst
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'graph_spike.png'),
    });
    console.log("📸 Graph spike captured!");

    // Fire another burst for even more dramatic effect
    console.log("\n🚀 Second burst wave...\n");
    await fireCurlBurst(10);

    // Let the graph settle
    console.log("\n⏳ Letting graph animations resolve (5s)...");
    await page.waitForTimeout(5000);

    // Screenshot: Graph post-burst peak
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'graph_peak.png'),
    });
    console.log("📸 Graph peak captured!");

    // Wait a bit more for video recording
    await page.waitForTimeout(2000);

    // ── Close & save ────────────────────────────────────
    const videoPath = await page.video().path();
    await context.close();
    await browser.close();

    // Rename the video to something descriptive
    const finalVideoPath = path.join(VIDEOS_DIR, 'graph_spike_recording.webm');
    if (fs.existsSync(videoPath)) {
      fs.renameSync(videoPath, finalVideoPath);
      console.log(`\n🎥 Video saved: ${finalVideoPath}`);
    }

    console.log("\n═══════════════════════════════════════════");
    console.log("✅ Graph recording complete!\n");

    // List all outputs
    console.log("📁 New screenshots:");
    for (const f of ['graph_idle.png', 'graph_spike.png', 'graph_peak.png']) {
      const fp = path.join(SCREENSHOTS_DIR, f);
      if (fs.existsSync(fp)) console.log(`   📸 ${fp}`);
    }
    console.log(`\n📁 Video:\n   🎥 ${finalVideoPath}`);

  } catch (err) {
    console.error("❌ Graph recorder failed:", err.message);
    process.exit(1);
  }
})();
