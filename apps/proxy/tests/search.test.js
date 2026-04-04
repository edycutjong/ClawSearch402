import { vi, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';

vi.useFakeTimers();

describe('search.js', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    vi.stubGlobal('fetch', vi.fn());
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it('performs standard SearXNG search successfully', async () => {
    process.env.SEARCH_PROVIDER = 'searxng';
    const { search } = await import('../src/search.js');
    
    const mockReponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: [{ title: 'Result 1', url: 'https://example.com/1', content: 'Snip 1' }]
      })
    };
    fetch.mockResolvedValueOnce(mockReponse);

    const res = await search('test query');
    expect(res).toHaveLength(1);
    expect(res[0].title).toBe('Result 1');
  });

  it('performs enriched SearXNG search successfully', async () => {
    process.env.SEARCH_PROVIDER = 'searxng';
    const { search } = await import('../src/search.js');
    
    const mockReponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: [{ title: 'R2', url: 'http://a', content: 'b', engine: 'q', score: 1 }]
      })
    };
    fetch.mockResolvedValueOnce(mockReponse);

    const res = await search('query2', { enriched: true });
    expect(res[0]).toHaveProperty('engine', 'q');
  });

  it('throws SearXNG error fallback to DDG successfully', async () => {
    process.env.SEARCH_PROVIDER = 'searxng';
    const { search } = await import('../src/search.js');
    
    fetch.mockResolvedValueOnce({ ok: false, statusText: 'Bad Gateway', status: 502 });
    fetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        AbstractURL: 'https://ddg.example/abs',
        Heading: 'DDG Title',
        AbstractText: 'DDG Snippet',
        RelatedTopics: [{ FirstURL: 'https://ddg.example/t1', Text: 'Topic 1 - desc' }]
      })
    });

    const res = await search('fallback query');
    expect(res).toHaveLength(2); 
    expect(console.warn).toHaveBeenCalled();
  });

  it('uses Brave Search when configured', async () => {
    process.env.SEARCH_PROVIDER = 'brave';
    process.env.BRAVE_API_KEY = 'test_key';
    const { search } = await import('../src/search.js');
    
    fetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        web: { results: [{ title: 'Brave 1', url: 'https://brave.com', description: 'Desc', profile: { img: 'fav.ico' }, age: '10s' }] }
      })
    });

    const res = await search('brave test', { enriched: true });
    expect(res).toHaveLength(1);
    expect(res[0].favicon).toBe('fav.ico');
  });

  it('Brave missing api key throws and falls back', async () => {
    process.env.SEARCH_PROVIDER = 'brave';
    process.env.BRAVE_API_KEY = ''; // Missing
    const { search } = await import('../src/search.js');
    
    // Should fallback to SearXNG
    fetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ results: [{ title: 'Fallback SearXNG' }] })
    });

    const res = await search('test missing brave key');
    expect(res).toBeDefined();
    expect(res[0].title).toBe('Fallback SearXNG');
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('Brave API error triggers fallback', async () => {
    process.env.SEARCH_PROVIDER = 'brave';
    process.env.BRAVE_API_KEY = 'valid';
    const { search } = await import('../src/search.js');
    
    fetch.mockResolvedValueOnce({ ok: false, status: 403, statusText: 'Forbidden' });
    fetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ AbstractURL: 'a', Heading: 'b', AbstractText: 'c' })
    });

    const res = await search('test brave 403');
    expect(res).toHaveLength(1);
  });

  it('Total failure triggers last resort fallback', async () => {
    process.env.SEARCH_PROVIDER = 'searxng';
    const { search } = await import('../src/search.js');
    
    fetch.mockRejectedValueOnce(new Error('Network error 1'));
    fetch.mockRejectedValueOnce(new Error('Network error 2'));

    const res = await search('desperate query');
    expect(res).toHaveLength(1);
  });

  it('handles caching properly', async () => {
    process.env.SEARCH_PROVIDER = 'searxng';
    const { search } = await import('../src/search.js');
    
    fetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ results: [{ title: 'cache-test' }] })
    });

    const q = 'cache query';
    const res1 = await search(q);
    const res2 = await search(q);
    
    expect(res1).toBe(res2); 
    expect(fetch).toHaveBeenCalledTimes(1);
    
    vi.advanceTimersByTime(300001);
    const res3 = await search(q);
    expect(fetch).toHaveBeenCalledTimes(2); 
  });

  it('sweeps large cache size and unrefs intervals correctly', async () => {
    process.env.SEARCH_PROVIDER = 'searxng';
    const { search } = await import('../src/search.js');
    
    fetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ results: [{ title: 'cache-fill' }] })
    });
    
    for (let i = 0; i < 505; i++) {
      await search(`overflow ${i}`);
    }
    vi.advanceTimersByTime(61000);
    expect(fetch).toHaveBeenCalledTimes(505);
  });

  it('Brave branch coverage for optional fields', async () => {
    process.env.SEARCH_PROVIDER = 'brave';
    process.env.BRAVE_API_KEY = 'test_key';
    const { search } = await import('../src/search.js');
    
    fetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        web: { results: [{ title: 'Brave No Enriched' }] } // No profile or age
      })
    });

    const res = await search('brave test missing enriched fields', { enriched: true });
    expect(res).toHaveLength(1);
    expect(res[0].favicon).toBe('');
    expect(res[0].age).toBe('');
    expect(res[0].language).toBe('en');
  });

  it('DDG fallback branch coverage when fields are missing', async () => {
    process.env.SEARCH_PROVIDER = 'searxng';
    const { search } = await import('../src/search.js');
    
    fetch.mockResolvedValueOnce({ ok: false, statusText: 'Bad Gateway', status: 502 });
    fetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        // NO AbstractURL
        Heading: '',
        AbstractText: '',
        // RelatedTopics with missing FirstURL and missing Text
        RelatedTopics: [{ FirstURL: '' }, { FirstURL: 'http://foo', Text: undefined }]
      })
    });

    const res = await search('fallback empty fields');
    // Result should skip empty AbstractURL and empty FirstURL, keeping http://foo
    expect(res).toHaveLength(1);
    expect(res[0].url).toBe('http://foo');
    expect(res[0].title).toBe('');
  });

  it('SearXNG non-enriched branch: missing optional result fields', async () => {
    process.env.SEARCH_PROVIDER = 'searxng';
    const { search } = await import('../src/search.js');
    
    // First call: enriched=true to ensure module sees both branches
    fetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: [{ title: 'E', url: 'http://e', content: 'e', engine: 'g', score: 1 }]
      })
    });
    const enrichedRes = await search('searxng enriched for branch', { enriched: true });
    expect(enrichedRes[0]).toHaveProperty('engine');

    // Second call: enriched=false — covers the falsy side of `enriched && {}`
    fetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: [{ /* no title, url, content */ }]
      })
    });
    const res = await search('test non enriched sparse fields', { enriched: false });
    expect(res).toHaveLength(1);
    expect(res[0].title).toBe('');
    expect(res[0].url).toBe('');
    expect(res[0].snippet).toBe('');
    expect(res[0]).not.toHaveProperty('engine');
    expect(res[0]).not.toHaveProperty('score');
  });

  it('Brave non-enriched branch: enriched spread is skipped', async () => {
    process.env.SEARCH_PROVIDER = 'brave';
    process.env.BRAVE_API_KEY = 'test_key';
    const { search } = await import('../src/search.js');

    // First call: enriched=true — hit truthy branch 
    fetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        web: { results: [{ title: 'BE', url: 'https://be.com', description: 'D', profile: { img: 'x' }, age: '1s' }] }
      })
    });
    const enrichedRes = await search('brave enriched for branch', { enriched: true });
    expect(enrichedRes[0]).toHaveProperty('favicon');

    // Second call: enriched=false — covers the falsy side
    fetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        web: { results: [{ title: 'Brave Basic', url: 'https://b.com', description: 'Desc' }] }
      })
    });
    const res = await search('brave non enriched', { enriched: false });
    expect(res).toHaveLength(1);
    expect(res[0].title).toBe('Brave Basic');
    expect(res[0]).not.toHaveProperty('favicon');
    expect(res[0]).not.toHaveProperty('age');
    expect(res[0]).not.toHaveProperty('language');
  });

  it('DDG fallback with AbstractURL but missing Heading and AbstractText', async () => {
    process.env.SEARCH_PROVIDER = 'searxng';
    const { search } = await import('../src/search.js');
    
    fetch.mockResolvedValueOnce({ ok: false, statusText: 'Bad', status: 500 });
    fetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        AbstractURL: 'https://ddg.example/abstract',
        // Missing Heading and AbstractText — triggers || fallbacks
        RelatedTopics: []
      })
    });

    const res = await search('ddg heading fallback');
    expect(res).toHaveLength(1);
    // Heading is falsy → should fall back to query string
    expect(res[0].title).toBe('ddg heading fallback');
    expect(res[0].url).toBe('https://ddg.example/abstract');
    // AbstractText is falsy → should fall back to ""
    expect(res[0].snippet).toBe('');
  });

  it('SearXNG handles missing results array (|| [] branch)', async () => {
    process.env.SEARCH_PROVIDER = 'searxng';
    const { search } = await import('../src/search.js');
    
    fetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        // no "results" key at all → triggers data.results || []
      })
    });

    const res = await search('searxng no results array');
    expect(res).toHaveLength(0);
  });

  it('SearXNG enriched with all optional fields missing', async () => {
    process.env.SEARCH_PROVIDER = 'searxng';
    const { search } = await import('../src/search.js');
    
    fetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: [{
          // title, url, content all missing → || "" branches
          // engine, score, category, publishedDate all missing → || fallbacks in enriched spread
        }]
      })
    });

    const res = await search('searxng enriched all missing', { enriched: true });
    expect(res).toHaveLength(1);
    expect(res[0].title).toBe('');
    expect(res[0].url).toBe('');
    expect(res[0].snippet).toBe('');
    expect(res[0].engine).toBe('');
    expect(res[0].score).toBe(0);
    expect(res[0].category).toBe('general');
    expect(res[0].publishedDate).toBeNull();
  });

  it('Brave handles missing web.results (data.web?.results || [] branch)', async () => {
    process.env.SEARCH_PROVIDER = 'brave';
    process.env.BRAVE_API_KEY = 'test_key';
    const { search } = await import('../src/search.js');
    
    fetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        // no web key at all → triggers data.web?.results || []
      })
    });

    const res = await search('brave no web results');
    expect(res).toHaveLength(0);
  });

  it('Brave search with missing result fields (|| fallbacks)', async () => {
    process.env.SEARCH_PROVIDER = 'brave';
    process.env.BRAVE_API_KEY = 'test_key';
    const { search } = await import('../src/search.js');
    
    fetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        web: { results: [{
          // All fields missing → triggers every || "" / || "en" fallback
        }] }
      })
    });

    const res = await search('brave missing fields', { enriched: true });
    expect(res).toHaveLength(1);
    expect(res[0].title).toBe('');
    expect(res[0].url).toBe('');
    expect(res[0].snippet).toBe('');
    expect(res[0].favicon).toBe('');
    expect(res[0].age).toBe('');
    expect(res[0].language).toBe('en');
  });
});
