const { chromium } = require('playwright');
const http = require('http');
const path = require('path');
const fs = require('fs');

const PROXY_URL = "http://localhost:3001";
const DASHBOARD_URL = "http://localhost:3000";

const QUERIES = [
  "latest crypto news",
  "ethereum gas fees",
  "x402 payment protocol",
  "autonomous ai agents",
  "machine to machine economy",
  "stellar usdc smart contracts",
  "decentralized micropayments",
  "agentic workflow patterns"
];

async function fireBurst() {
  console.log("🚀 Firing Agentic Traffic Burst...");
  for (let i = 0; i < 15; i++) {
    const q = QUERIES[Math.floor(Math.random() * QUERIES.length)];
    const endpoint = Math.random() > 0.5 ? "/search/enriched" : "/search";
    
    // Fire and forget
    http.get(`${PROXY_URL}${endpoint}?q=${encodeURIComponent(q)}`).on('error', () => {});
    console.log(`🤖 [Agent ${i + 1}] Sent $0.00${endpoint.includes('enriched') ? '5' : '1'} USDC for: ${q}`);
    
    // Random sleep 400ms - 1500ms to mimic staggered requests
    const delay = Math.floor(Math.random() * 1100) + 400;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

(async () => {
  const videosDir = path.join(__dirname, '..', 'demo_videos');
  if (!fs.existsSync(videosDir)) {
    fs.mkdirSync(videosDir);
  }

  console.log("🎬 Setting up Playwright recorder...");
  try {
    // Launch chromium. headless: false shows the UI but is required for some visual accuracy, 
    // though Playwright captures off-screen perfectly.
    const browser = await chromium.launch({ headless: true });
    
    const context = await browser.newContext({
      recordVideo: {
        dir: videosDir,
        size: { width: 1920, height: 1080 }
      },
      viewport: { width: 1920, height: 1080 },
      colorScheme: 'dark',
      deviceScaleFactor: 2 // Retina high quality output
    });
    
    const page = await context.newPage();
    
    console.log(`🌐 Opening Next.js Dashboard: ${DASHBOARD_URL}`);
    await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle' });
    
    // Give it 2 seconds to finish any initial fetch and React hydration
    await page.waitForTimeout(2000);
    
    // Switch to "30m" view so the graph responds dynamically to bursts
    await page.selectOption('select', '30m');
    console.log("⏱️ Switched view to 'Last 30 Min' mode.");
    
    console.log("🎥 Recording started! Simulating traffic...");
    await page.waitForTimeout(1000);
    
    // Start firing burst while the page is being recorded
    await fireBurst();
    
    console.log("⏳ Letting the graph resolve animations for 5 more seconds...");
    await page.waitForTimeout(5000);
    
    await context.close();
    await browser.close();
    
    console.log(`✅ Demo recording complete! Video saved in: ${videosDir}`);
  } catch (err) {
    console.error("Failed to run demo:", err);
  }
})();
