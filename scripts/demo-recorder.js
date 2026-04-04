const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const DASHBOARD_URL = process.env.DASHBOARD_URL || "http://localhost:3000";
const AGENT_DIR = path.join(__dirname, '..', 'clients', 'node');

const OUTPUT_DIR = path.join(__dirname, '..', 'demo_output');
const SCREENSHOTS_DIR = path.join(OUTPUT_DIR, 'screenshots');
const VIDEOS_DIR = path.join(OUTPUT_DIR, 'videos');

// Create output directories
for (const dir of [OUTPUT_DIR, SCREENSHOTS_DIR, VIDEOS_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * Spawns the agent client in demo mode (10 real x402 queries).
 * Returns a Promise that resolves when the agent finishes.
 */
function spawnAgentBurst() {
  return new Promise((resolve, reject) => {
    console.log("🤖 Spawning agent client (--demo) with real x402 payments...\n");

    const agent = spawn('node', ['index.js', '--demo'], {
      cwd: AGENT_DIR,
      stdio: 'inherit',  // Stream agent output to our terminal
      env: { ...process.env }
    });

    agent.on('close', (code) => {
      if (code === 0) {
        console.log("\n🤖 Agent burst complete!");
        resolve();
      } else {
        reject(new Error(`Agent exited with code ${code}`));
      }
    });

    agent.on('error', reject);
  });
}

(async () => {
  console.log("🎬 ClawSearch 402 — Demo Recorder\n");
  console.log("═══════════════════════════════════════════\n");

  try {
    // ── Launch Playwright ──────────────────────────────────
    console.log("🌐 Launching browser...");
    const browser = await chromium.launch({ headless: true });

    const context = await browser.newContext({
      recordVideo: {
        dir: VIDEOS_DIR,
        size: { width: 1920, height: 1080 }
      },
      viewport: { width: 1920, height: 1080 },
      colorScheme: 'dark',
      deviceScaleFactor: 2
    });

    const page = await context.newPage();

    // ── Load Dashboard ─────────────────────────────────────
    console.log(`📊 Opening dashboard: ${DASHBOARD_URL}`);
    await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Screenshot 1: Dashboard idle state
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '01_dashboard_idle.png'),
      fullPage: true
    });
    console.log("📸 Screenshot 1: Dashboard idle state");

    // ── Try switching time window for better visual ────────
    try {
      // Try selecting 30m view for dynamic graph response
      const selectExists = await page.locator('select').count();
      if (selectExists > 0) {
        await page.selectOption('select', '30m');
        console.log("⏱️  Switched to '30m' view");
      }
    } catch {
      console.log("⏱️  No time selector found, continuing...");
    }

    await page.waitForTimeout(1000);

    // Screenshot 2: Dashboard ready (before traffic)
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '02_dashboard_ready.png'),
      fullPage: true
    });
    console.log("📸 Screenshot 2: Dashboard ready state");

    // ── Fire Agent Traffic ──────────────────────────────────
    console.log("\n🚀 Starting agent traffic burst...\n");

    // Start the agent in parallel — dashboard will update via SSE
    const agentPromise = spawnAgentBurst();

    // Take mid-burst screenshots
    await new Promise(r => setTimeout(r, 4000));
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '03_dashboard_mid_burst.png'),
      fullPage: true
    });
    console.log("📸 Screenshot 3: Mid-burst (traffic flowing)");

    // Wait for agent to finish
    await agentPromise;

    // ── Post-burst captures ────────────────────────────────
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '04_dashboard_post_burst.png'),
      fullPage: true
    });
    console.log("📸 Screenshot 4: Post-burst (all payments settled)");

    // Scroll to the ledger table
    try {
      await page.evaluate(() => {
        const ledger = document.querySelector('table') ||
                       document.querySelector('[class*="ledger"]') ||
                       document.querySelector('[class*="payment"]');
        if (ledger) ledger.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      await page.waitForTimeout(1500);
    } catch {
      // Scroll to bottom as fallback
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000);
    }

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '05_payment_ledger.png'),
      fullPage: true
    });
    console.log("📸 Screenshot 5: Payment Ledger detail");

    // ── Let graph animations finish ────────────────────────
    console.log("\n⏳ Letting animations resolve (5s)...");
    await page.waitForTimeout(5000);

    // ── Close & save video ─────────────────────────────────
    await context.close();
    await browser.close();

    // List output files
    console.log("\n═══════════════════════════════════════════");
    console.log("✅ Demo recording complete!\n");
    console.log("📁 Output:");

    const screenshots = fs.readdirSync(SCREENSHOTS_DIR);
    for (const f of screenshots) {
      console.log(`   📸 ${path.join('demo_output/screenshots', f)}`);
    }

    const videos = fs.readdirSync(VIDEOS_DIR);
    for (const f of videos) {
      console.log(`   🎥 ${path.join('demo_output/videos', f)}`);
    }

    console.log("");

  } catch (err) {
    console.error("❌ Demo recorder failed:", err.message);
    process.exit(1);
  }
})();
