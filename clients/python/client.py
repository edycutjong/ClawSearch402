"""
ClawSearch 402 — Python Agent Client

Autonomous AI agent that searches via x402 protocol on Stellar.
Manually handles the 402 Payment Required flow for demonstration.

Usage:
    python client.py "what is x402 protocol"
    python client.py --demo
"""

import sys
import os
import json
import time
import base64
import httpx

PROXY_URL = os.getenv("PROXY_URL", "http://localhost:3001")


def discover_endpoints():
    """Discover payable routes via x402 well-known endpoint."""
    print("\n  🔍 Discovering x402 endpoints...")
    res = httpx.get(f"{PROXY_URL}/.well-known/x402", timeout=10)
    data = res.json()
    print(f"  ✅ Found {len(data.get('routes', []))} payable routes")
    for route in data.get("routes", []):
        print(f"     {route['method']} {route['path']} → {route['price']}")
    return data


def search(query: str, enriched: bool = False):
    """
    Perform a search query.
    
    Note: Full x402 payment flow requires stellar-sdk.
    This client demonstrates the discovery + request pattern.
    For the complete payment handshake, use the Node.js client.
    """
    endpoint = "/search/enriched" if enriched else "/search"
    url = f"{PROXY_URL}{endpoint}"
    price = "$0.005" if enriched else "$0.001"
    
    print(f"\n  🔍 Searching: \"{query}\"")
    print(f"  📡 {url}?q={query}")
    print(f"  💰 Price: {price} USDC")
    
    start = time.time()
    
    try:
        # Initial request — expect 402
        res = httpx.get(url, params={"q": query}, timeout=15)
        latency = round((time.time() - start) * 1000)
        
        if res.status_code == 402:
            print(f"  ⚡ Received 402 Payment Required ({latency}ms)")
            # In production, the agent would sign a Stellar USDC payment here
            # and retry with the PAYMENT-SIGNATURE header
            payment_header = res.headers.get("payment-required", "")
            if payment_header:
                try:
                    requirements = json.loads(base64.b64decode(payment_header))
                    print(f"  📋 Payment requirements:")
                    print(f"     Network: {requirements.get('network', 'unknown')}")
                    print(f"     Price: {requirements.get('maxAmountRequired', 'unknown')}")
                except Exception:
                    print(f"  📋 Payment header received (raw)")
            
            print(f"\n  ℹ️  Full payment flow requires stellar-sdk.")
            print(f"     Use the Node.js client for complete x402 handshake.")
            return None
            
        elif res.status_code == 200:
            data = res.json()
            print(f"  ✅ Results received! ({latency}ms)")
            print(f"  📊 {data.get('resultCount', 0)} results")
            
            for i, result in enumerate(data.get("results", [])[:5], 1):
                print(f"  {i}. {result.get('title', 'Untitled')}")
                print(f"     {result.get('url', '')}")
            
            return data
        else:
            print(f"  ❌ Unexpected status: {res.status_code}")
            return None
            
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return None


def demo():
    """Fire multiple queries for dashboard demonstration."""
    queries = [
        "stellar blockchain",
        "x402 payment protocol",
        "AI autonomous agents",
        "USDC stablecoin",
        "micropayments web3",
    ]
    
    print("\n  🚀 Python Demo — Discovering endpoints & firing queries\n")
    discover_endpoints()
    
    for q in queries:
        search(q)
        time.sleep(0.5)
    
    print("\n  ✅ Demo complete!")


if __name__ == "__main__":
    args = sys.argv[1:]
    
    if "--demo" in args:
        demo()
    elif "--discover" in args:
        discover_endpoints()
    elif args:
        query = " ".join(a for a in args if not a.startswith("--"))
        enriched = "--enriched" in args
        search(query, enriched)
    else:
        print("\n  🔍 ClawSearch 402 — Python Agent Client\n")
        print("  Usage:")
        print('    python client.py "your search query"')
        print('    python client.py "query" --enriched')
        print("    python client.py --discover")
        print("    python client.py --demo\n")
