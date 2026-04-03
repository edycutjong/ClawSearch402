/**
 * Search provider abstraction
 * Supports SearXNG (preferred — no API key) and Brave Search (fallback)
 */

const SEARXNG_URL =
  process.env.SEARXNG_URL || "https://searx.be";
const BRAVE_API_KEY = process.env.BRAVE_API_KEY || "";
const SEARCH_PROVIDER = process.env.SEARCH_PROVIDER || "searxng";

// In-memory cache (5-min TTL)
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.time > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  cache.set(key, { data, time: Date.now() });
  // Evict old entries if cache gets large
  if (cache.size > 500) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
}

/**
 * Search using SearXNG
 */
async function searchSearXNG(query, { enriched = false } = {}) {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    language: "en",
    categories: "general",
  });

  const res = await fetch(`${SEARXNG_URL}/search?${params}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`SearXNG returned ${res.status}: ${res.statusText}`);
  }

  const data = await res.json();

  return (data.results || []).slice(0, enriched ? 20 : 10).map((r) => ({
    title: r.title || "",
    url: r.url || "",
    snippet: r.content || "",
    ...(enriched && {
      engine: r.engine || "",
      score: r.score || 0,
      category: r.category || "general",
      publishedDate: r.publishedDate || null,
    }),
  }));
}

/**
 * Search using Brave Search API
 */
async function searchBrave(query, { enriched = false } = {}) {
  if (!BRAVE_API_KEY) {
    throw new Error("BRAVE_API_KEY is required for Brave Search provider");
  }

  const params = new URLSearchParams({
    q: query,
    count: enriched ? "20" : "10",
  });

  const res = await fetch(
    `https://api.search.brave.com/res/v1/web/search?${params}`,
    {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": BRAVE_API_KEY,
      },
      signal: AbortSignal.timeout(10000),
    }
  );

  if (!res.ok) {
    throw new Error(`Brave Search returned ${res.status}: ${res.statusText}`);
  }

  const data = await res.json();

  return (data.web?.results || []).map((r) => ({
    title: r.title || "",
    url: r.url || "",
    snippet: r.description || "",
    ...(enriched && {
      favicon: r.profile?.img || "",
      age: r.age || "",
      language: r.language || "en",
    }),
  }));
}

/**
 * Fallback: DuckDuckGo Instant Answer (very basic, no API key)
 */
async function searchDDG(query) {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    no_html: "1",
    skip_disambig: "1",
  });

  const res = await fetch(`https://api.duckduckgo.com/?${params}`, {
    signal: AbortSignal.timeout(10000),
  });

  const data = await res.json();

  const results = [];

  if (data.AbstractURL) {
    results.push({
      title: data.Heading || query,
      url: data.AbstractURL,
      snippet: data.AbstractText || "",
    });
  }

  for (const topic of data.RelatedTopics || []) {
    if (topic.FirstURL) {
      results.push({
        title: topic.Text?.split(" - ")[0] || "",
        url: topic.FirstURL,
        snippet: topic.Text || "",
      });
    }
  }

  return results.slice(0, 10);
}

/**
 * Main search function with caching and provider fallback
 */
export async function search(query, { enriched = false } = {}) {
  const cacheKey = `${query}:${enriched}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  let results;

  try {
    if (SEARCH_PROVIDER === "brave" && BRAVE_API_KEY) {
      results = await searchBrave(query, { enriched });
    } else {
      results = await searchSearXNG(query, { enriched });
    }
  } catch (err) {
    console.warn(`Primary search (${SEARCH_PROVIDER}) failed:`, err.message);

    // Fallback chain: SearXNG → DuckDuckGo
    try {
      results = await searchDDG(query);
    } catch (fallbackErr) {
      console.warn("Fallback search (DDG) also failed:", fallbackErr.message);

      // Last resort: return a "no results" response instead of crashing
      results = [
        {
          title: `Search results for: ${query}`,
          url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
          snippet: `No results available at this time. Try searching directly.`,
        },
      ];
    }
  }

  setCache(cacheKey, results);
  return results;
}
