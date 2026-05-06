// ─── Types ───────────────────────────────────────────────────────────────────

export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
  wordcount?: number;
  timestamp?: string;
  pageid?: number;
  thumbnail?: string;
  source?: string; // Which search engine provided this result
}

export interface ImageResult {
  title: string;
  thumbnail: string;
  description: string;
  url: string;
  width?: number;
  height?: number;
  originalImage?: string;
}

export interface PageSummary {
  title: string;
  extract: string;
  thumbnail?: {
    source: string;
    width: number;
    height: number;
  };
  description?: string;
  originalimage?: {
    source: string;
    width: number;
    height: number;
  };
  content_urls?: {
    desktop: { page: string };
  };
}

export interface InstantAnswer {
  Abstract: string;
  AbstractText: string;
  AbstractSource: string;
  AbstractURL: string;
  Image?: string;
  Heading?: string;
  Type?: string;
  RelatedTopics?: Array<{
    Text: string;
    FirstURL: string;
    Icon?: { URL: string };
  }>;
  Results?: Array<{
    Text: string;
    FirstURL: string;
  }>;
  Infobox?: Record<string, string>;
}

export interface Definition {
  word: string;
  phonetic?: string;
  meanings: Array<{
    partOfSpeech: string;
    definitions: Array<{
      definition: string;
      example?: string;
    }>;
  }>;
}

export interface QuickAnswer {
  type: 'calculator' | 'definition' | 'weather' | 'time' | 'none';
  value?: string;
  data?: unknown;
}

export interface AISummary {
  title: string;
  summary: string;
  keyPoints: string[];
  sources: string[];
  readTime: number;
}

export interface Bookmark {
  id: string;
  title: string;
  url: string;
  snippet: string;
  timestamp: string;
  tags: string[];
}

export interface SearchFilter {
  dateRange: 'any' | 'day' | 'week' | 'month' | 'year';
  language: string;
  sortBy: 'relevance' | 'date' | 'alphabetical';
}

export interface TranslationResult {
  original: string;
  translated: string;
  sourceLang: string;
  targetLang: string;
}

// ─── Helper ─────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

// ─── Multi-Source Search Aggregator ──────────────────────────────────────
// DuckDuckGo FIRST, then 20+ free APIs (no API keys needed)

export async function searchWeb(
  query: string,
  offset = 0,
  limit = 20
): Promise<{ results: SearchResult[]; totalHits: number }> {
  const allResults: SearchResult[] = [];
  const seenUrls = new Set<string>();

  const addResults = (results: SearchResult[], source: string) => {
    for (const r of results) {
      const cleanUrl = r.url.split('?')[0];
      if (!seenUrls.has(cleanUrl) && r.title && r.title.length >= 2) {
        seenUrls.add(cleanUrl);
        allResults.push({ ...r, source: r.source || source });
      }
    }
  };

  // ─── DUCKDUCKGO FIRST (as requested) ───────────────────────────────────
  try {
    const res = await fetch(
      `/api/search/ddg/lite/?q=${encodeURIComponent(query)}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (res.ok) {
      const html = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const links = doc.querySelectorAll('a.result-link');
      const snippets = doc.querySelectorAll('td.result-snippet, .result-snippet, .result-text, td.result-text');

      for (let i = 0; i < Math.min(links.length, 15); i++) {
        const link = links[i] as HTMLAnchorElement;
        let rawHref = (link.getAttribute('href') || '').replace(/[\r\n\t]+/g, '');
        let url = '';
        if (rawHref.includes('uddg=')) {
          try { url = decodeURIComponent(rawHref.split('uddg=')[1].split('&')[0]); } catch {}
        }
        if (url && url.startsWith('http')) {
          addResults([{
            title: link.textContent?.trim() || '',
            snippet: snippets[i]?.textContent?.trim() || '',
            url,
            source: 'duckduckgo',
          }], 'duckduckgo');
        }
      }
      console.log(`[Search] DDG: ${links.length} results`);
    }
  } catch (e) { console.log('[Search] DDG failed'); }

  // ─── Fetch all other sources in parallel ───────────────────────────────
  await Promise.allSettled([
    // 2. SearXNG (Google + Bing + DDG aggregator)
    (async () => {
      try {
        const res = await fetch(
          `/api/search/searx?q=${encodeURIComponent(query)}&categories=general&format=json&pageno=${Math.floor(offset / 20) + 1}`,
          { signal: AbortSignal.timeout(6000) }
        );
        if (res.ok) {
          const data = await res.json();
          if (data.results?.length > 0) {
            addResults(
              data.results.slice(0, 10).map((r: Record<string, unknown>) => ({
                title: (r.title as string) || '',
                snippet: (r.content as string) || '',
                url: (r.url as string) || '',
                thumbnail: (r.img_src as string) || undefined,
                source: (r.engine as string) || 'searx',
              })),
              'searx'
            );
          }
        }
      } catch (e) {}
    })(),

    // 3. Wikipedia
    (async () => {
      try {
        const res = await fetch(
          `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=5&format=json&origin=*`
        );
        const data = await res.json();
        if (data.query?.search?.length > 0) {
          addResults(
            data.query.search.map((item: Record<string, unknown>) => ({
              title: item.title as string,
              snippet: stripHtml(item.snippet as string),
              url: `https://en.wikipedia.org/wiki/${encodeURIComponent((item.title as string).replace(/ /g, '_'))}`,
              wordcount: item.wordcount as number,
              timestamp: item.timestamp as string,
              source: 'wikipedia',
            })),
            'wikipedia'
          );
        }
      } catch (e) {}
    })(),

    // 4. Wikidata (Structured data)
    (async () => {
      try {
        const res = await fetch(
          `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&format=json&origin=*&limit=5`
        );
        const data = await res.json();
        if (data.search?.length > 0) {
          addResults(
            data.search.map((item: Record<string, unknown>) => ({
              title: `${item.label || ''} - Wikidata`,
              snippet: (item.description as string) || 'Wikidata entity',
              url: `https://www.wikidata.org/wiki/${item.id}`,
              source: 'wikidata',
            })),
            'wikidata'
          );
        }
      } catch (e) {}
    })(),

    // 5. DBpedia (Structured Wikipedia)
    (async () => {
      try {
        const res = await fetch(
          `https://lookup.dbpedia.org/api/search?query=${encodeURIComponent(query)}&format=json&maxResults=5`
        );
        const data = await res.json();
        if (data.docs?.length > 0) {
          addResults(
            data.docs.slice(0, 5).map((item: Record<string, unknown>) => ({
              title: (item.label?.en?.[0] as string) || '',
              snippet: (item.description?.en?.[0] as string) || '',
              url: `https://dbpedia.org/resource/${encodeURIComponent((item.resource?.[0] as string || '').split('/').pop() || '')}`,
              source: 'dbpedia',
            })),
            'dbpedia'
          );
        }
      } catch (e) {}
    })(),

    // 6. Wikiquote
    (async () => {
      try {
        const res = await fetch(
          `https://en.wikiquote.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=3&format=json&origin=*`
        );
        const data = await res.json();
        if (data.query?.search?.length > 0) {
          addResults(
            data.query.search.map((item: Record<string, unknown>) => ({
              title: `${item.title as string} - Wikiquote`,
              snippet: stripHtml(item.snippet as string),
              url: `https://en.wikiquote.org/wiki/${encodeURIComponent((item.title as string).replace(/ /g, '_'))}`,
              source: 'wikiquote',
            })),
            'wikiquote'
          );
        }
      } catch (e) {}
    })(),

    // 7. Wikibooks
    (async () => {
      try {
        const res = await fetch(
          `https://en.wikibooks.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=3&format=json&origin=*`
        );
        const data = await res.json();
        if (data.query?.search?.length > 0) {
          addResults(
            data.query.search.map((item: Record<string, unknown>) => ({
              title: `${item.title as string} - Wikibooks`,
              snippet: stripHtml(item.snippet as string),
              url: `https://en.wikibooks.org/wiki/${encodeURIComponent((item.title as string).replace(/ /g, '_'))}`,
              source: 'wikibooks',
            })),
            'wikibooks'
          );
        }
      } catch (e) {}
    })(),

    // 8. Wikivoyage (Travel)
    (async () => {
      try {
        const res = await fetch(
          `https://en.wikivoyage.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=3&format=json&origin=*`
        );
        const data = await res.json();
        if (data.query?.search?.length > 0) {
          addResults(
            data.query.search.map((item: Record<string, unknown>) => ({
              title: `${item.title as string} - Wikivoyage`,
              snippet: stripHtml(item.snippet as string),
              url: `https://en.wikivoyage.org/wiki/${encodeURIComponent((item.title as string).replace(/ /g, '_'))}`,
              source: 'wikivoyage',
            })),
            'wikivoyage'
          );
        }
      } catch (e) {}
    })(),

    // 9. Wikisource (Historical texts)
    (async () => {
      try {
        const res = await fetch(
          `https://en.wikisource.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=3&format=json&origin=*`
        );
        const data = await res.json();
        if (data.query?.search?.length > 0) {
          addResults(
            data.query.search.map((item: Record<string, unknown>) => ({
              title: `${item.title as string} - Wikisource`,
              snippet: stripHtml(item.snippet as string),
              url: `https://en.wikisource.org/wiki/${encodeURIComponent((item.title as string).replace(/ /g, '_'))}`,
              source: 'wikisource',
            })),
            'wikisource'
          );
        }
      } catch (e) {}
    })(),

    // 10. Wikiversity (Learning)
    (async () => {
      try {
        const res = await fetch(
          `https://en.wikiversity.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=3&format=json&origin=*`
        );
        const data = await res.json();
        if (data.query?.search?.length > 0) {
          addResults(
            data.query.search.map((item: Record<string, unknown>) => ({
              title: `${item.title as string} - Wikiversity`,
              snippet: stripHtml(item.snippet as string),
              url: `https://en.wikiversity.org/wiki/${encodeURIComponent((item.title as string).replace(/ /g, '_'))}`,
              source: 'wikiversity',
            })),
            'wikiversity'
          );
        }
      } catch (e) {}
    })(),

    // 11. Wikimedia Commons (Media)
    (async () => {
      try {
        const res = await fetch(
          `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=5&format=json&origin=*`
        );
        const data = await res.json();
        if (data.query?.search?.length > 0) {
          addResults(
            data.query.search.map((item: Record<string, unknown>) => ({
              title: `${item.title as string} - Wikimedia Commons`,
              snippet: stripHtml(item.snippet as string),
              url: `https://commons.wikimedia.org/wiki/${encodeURIComponent((item.title as string).replace(/ /g, '_'))}`,
              source: 'commons',
            })),
            'commons'
          );
        }
      } catch (e) {}
    })(),

    // 12. Open Library (Books)
    (async () => {
      try {
        const res = await fetch(
          `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=5`
        );
        const data = await res.json();
        if (data.docs?.length > 0) {
          addResults(
            data.docs.slice(0, 5).map((item: Record<string, unknown>) => ({
              title: `${item.title || ''}${item.author_name ? ` by ${(item.author_name as string[])[0]}` : ''} - Open Library`,
              snippet: `Published ${item.first_publish_year || 'N/A'} • ${(item.number_of_pages_median as number) || '?'} pages`,
              url: `https://openlibrary.org${item.key || ''}`,
              source: 'openlibrary',
            })),
            'openlibrary'
          );
        }
      } catch (e) {}
    })(),

    // 13. Arxiv (Research papers)
    (async () => {
      try {
        const res = await fetch(
          `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&max_results=5&sortBy=relevance`
        );
        const text = await res.text();
        const entries = text.match(/<entry>([\s\S]*?)<\/entry>/g) || [];
        if (entries.length > 0) {
          addResults(
            entries.slice(0, 5).map(entry => {
              const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/);
              const summaryMatch = entry.match(/<summary>([\s\S]*?)<\/summary>/);
              const idMatch = entry.match(/<id>([\s\S]*?)<\/id>/);
              const authorMatch = entry.match(/<name>([\s\S]*?)<\/name>/);
              return {
                title: `${titleMatch?.[1]?.trim() || ''} - Arxiv`,
                snippet: `${authorMatch?.[1]?.trim() || 'Unknown'} • ${(summaryMatch?.[1]?.trim() || '').slice(0, 200)}...`,
                url: idMatch?.[1]?.trim() || '',
                source: 'arxiv',
              };
            }),
            'arxiv'
          );
        }
      } catch (e) {}
    })(),

    // 14. Hacker News
    (async () => {
      try {
        const res = await fetch(
          `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=5`
        );
        const data = await res.json();
        if (data.hits?.length > 0) {
          addResults(
            data.hits.slice(0, 5).map((item: Record<string, unknown>) => ({
              title: `${item.title || ''} - Hacker News`,
              snippet: `${item.points || 0} points • ${item.num_comments || 0} comments`,
              url: (item.url as string) || `https://news.ycombinator.com/item?id=${item.objectID}`,
              source: 'hackernews',
            })),
            'hackernews'
          );
        }
      } catch (e) {}
    })(),

    // 15. GitHub (Repos)
    (async () => {
      try {
        const res = await fetch(
          `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=5`
        );
        const data = await res.json();
        if (data.items?.length > 0) {
          addResults(
            data.items.slice(0, 5).map((item: Record<string, unknown>) => ({
              title: `${item.full_name as string} - GitHub`,
              snippet: `${item.description || 'No description'} • Stars: ${(item.stargazers_count as number) || 0} • Forks: ${(item.forks_count as number) || 0}`,
              url: item.html_url as string,
              source: 'github',
            })),
            'github'
          );
        }
      } catch (e) {}
    })(),

    // 16. Reddit
    (async () => {
      try {
        const res = await fetch(
          `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&limit=5&sort=relevance`
        );
        const data = await res.json();
        if (data.data?.children?.length > 0) {
          addResults(
            data.data.children.slice(0, 5).map((child: { data: Record<string, unknown> }) => ({
              title: `${child.data.title || ''} - Reddit`,
              snippet: `${child.data.score || 0} upvotes • ${child.data.num_comments || 0} comments`,
              url: `https://reddit.com${child.data.permalink || ''}`,
              source: 'reddit',
            })),
            'reddit'
          );
        }
      } catch (e) {}
    })(),

    // 17. Dev.to (Developer articles)
    (async () => {
      try {
        const res = await fetch(
          `https://dev.to/search/feed_content?query=${encodeURIComponent(query)}&page=1&per_page=5`
        );
        const data = await res.json();
        if (data.result?.length > 0) {
          addResults(
            data.result.slice(0, 5).map((item: Record<string, unknown>) => ({
              title: `${item.title || ''} - Dev.to`,
              snippet: `${item.user?.name || 'Unknown'} • ${(item.reading_time_minutes as number) || '?'} min read`,
              url: `https://dev.to${item.path || ''}`,
              source: 'devto',
            })),
            'devto'
          );
        }
      } catch (e) {}
    })(),

    // 18. CoinGecko (Crypto)
    (async () => {
      try {
        const res = await fetch(
          `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`
        );
        const data = await res.json();
        if (data.coins?.length > 0) {
          addResults(
            data.coins.slice(0, 5).map((item: Record<string, unknown>) => ({
              title: `${item.name || ''} (${item.symbol || ''}) - CoinGecko`,
              snippet: `CoinGecko ID: ${item.id || ''}`,
              url: `https://www.coingecko.com/en/coins/${item.id || ''}`,
              source: 'coingecko',
            })),
            'coingecko'
          );
        }
      } catch (e) {}
    })(),

    // 19. OpenMeteo (Weather)
    (async () => {
      try {
        const res = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=3`
        );
        const data = await res.json();
        if (data.results?.length > 0) {
          addResults(
            data.results.slice(0, 3).map((item: Record<string, unknown>) => ({
              title: `${item.name || ''}, ${item.admin1 || item.country || ''} - Weather`,
              snippet: `Lat: ${item.latitude} • Lon: ${item.longitude}`,
              url: `https://open-meteo.com/en/weather-api`,
              source: 'openmeteo',
            })),
            'openmeteo'
          );
        }
      } catch (e) {}
    })(),

    // 20. RestCountries
    (async () => {
      try {
        const res = await fetch(
          `https://restcountries.com/v3.1/name/${encodeURIComponent(query)}?fullText=false`
        );
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          addResults(
            data.slice(0, 5).map((item: Record<string, unknown>) => ({
              title: `${item.name?.common || ''} (${item.cca2 || ''}) - RestCountries`,
              snippet: `Capital: ${(item.capital as string[])?.[0] || 'N/A'} • Population: ${(item.population as number)?.toLocaleString() || 'N/A'}`,
              url: `https://restcountries.com/v3.1/alpha/${item.cca2 || ''}`,
              source: 'restcountries',
            })),
            'restcountries'
          );
        }
      } catch (e) {}
    })(),

    // 21. iTunes (Music/Podcasts)
    (async () => {
      try {
        const res = await fetch(
          `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&limit=5&media=music`
        );
        const data = await res.json();
        if (data.results?.length > 0) {
          addResults(
            data.results.slice(0, 5).map((item: Record<string, unknown>) => ({
              title: `${item.trackName || item.collectionName || ''} - iTunes`,
              snippet: `${item.artistName || 'Unknown'} • ${item.kind || 'track'}`,
              url: (item.trackViewUrl || item.collectionViewUrl || '') as string,
              source: 'itunes',
            })),
            'itunes'
          );
        }
      } catch (e) {}
    })(),

    // 22. Deezer (Music)
    (async () => {
      try {
        const res = await fetch(
          `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=5`
        );
        const data = await res.json();
        if (data.data?.length > 0) {
          addResults(
            data.data.slice(0, 5).map((item: Record<string, unknown>) => ({
              title: `${item.title || ''} - Deezer`,
              snippet: `${item.artist?.name || 'Unknown'} • Duration: ${item.duration ? Math.floor(item.duration as number / 60) : '?'}:${String((item.duration as number) % 60).padStart(2, '0')}`,
              url: item.link as string,
              source: 'deezer',
            })),
            'deezer'
          );
        }
      } catch (e) {}
    })(),
  ]);

  const sources = new Set(allResults.map(r => r.source));
  console.log(`[Search] Total: ${allResults.length} results from [${Array.from(sources).join(', ')}]`);

  return { results: allResults.slice(0, limit), totalHits: Math.max(allResults.length * 10, 100) };
}

// ─── Real News Search ────────────────────────────────────────────────────

export async function searchNews(
  query: string,
  offset = 0,
  limit = 15
): Promise<{ results: SearchResult[]; totalHits: number }> {
  try {
    // Use Reddit JSON API for real-time news
    const res = await fetch(
      `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=new&limit=${limit}&raw_json=1`
    );
    const data = await res.json();
    const results: SearchResult[] = (data.data?.children || []).map(
      (post: { data: { title: string; selftext: string; url: string; created_utc: number; permalink: string } }) => ({
        title: post.data.title,
        snippet: post.data.selftext?.slice(0, 200) || post.data.url,
        url: post.data.url.startsWith('http') ? post.data.url : `https://reddit.com${post.data.permalink}`,
        timestamp: new Date(post.data.created_utc * 1000).toISOString(),
      })
    );

    if (results.length > 0) return { results, totalHits: data.data?.dist || results.length };

    // Fallback: search news on Wikipedia
    const wikiRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&sroffset=${offset}&srlimit=${limit}&srnsort=timestamps&format=json&origin=*`
    );
    const wikiData = await wikiRes.json();
    return {
      results: (wikiData.query?.search || []).map((item: Record<string, unknown>) => ({
        title: item.title as string,
        snippet: stripHtml(item.snippet as string),
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent((item.title as string).replace(/ /g, '_'))}`,
        wordcount: item.wordcount as number,
        timestamp: item.timestamp as string,
        pageid: item.pageid as number,
      })),
      totalHits: wikiData.query?.searchinfo?.totalhits || 0,
    };
  } catch {
    return { results: [], totalHits: 0 };
  }
}

// ─── Real Search Suggestions ─────────────────────────────────────────────

export async function getSuggestions(query: string): Promise<string[]> {
  if (!query.trim()) return [];
  // Wikipedia suggestions (CORS-friendly with origin=*)
  try {
    const res = await fetch(
      `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=8&namespace=0&format=json&origin=*`
    );
    const data = await res.json();
    return data[1] || [];
  } catch {
    return [];
  }
}

// ─── Page Summary ────────────────────────────────────────────────────────────

export async function getPageSummary(
  title: string
): Promise<PageSummary | null> {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
        title.replace(/ /g, "_")
      )}`
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// ─── Instant Answer (DuckDuckGo) ────────────────────────────────────────────

export async function getInstantAnswer(
  query: string
): Promise<InstantAnswer | null> {
  try {
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(
        query
      )}&format=json&no_html=1&skip_disambig=1`
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// ─── Real Image Search ───────────────────────────────────────────────────

export async function searchImages(
  query: string,
  offset = 0
): Promise<{ results: ImageResult[]; totalHits?: number }> {
  try {
    // Try Unsplash first (free, no API key needed for basic)
    const res = await fetch(
      `https://unsplash.com/napi/search?query=${encodeURIComponent(query)}&per_page=24&page=${Math.floor(offset / 24) + 1}`
    );
    const data = await res.json();

    if (data?.photos?.results?.length > 0) {
      const results: ImageResult[] = data.photos.results.map((img: {
        id: string;
        urls: { small: string; regular: string; full: string };
        alt_description: string;
        width: number;
        height: number;
        links: { html: string };
        user: { name: string };
      }) => ({
        title: img.alt_description || img.user.name,
        thumbnail: img.urls.small,
        description: img.alt_description || '',
        url: img.links.html,
        width: img.width,
        height: img.height,
        originalImage: img.urls.full,
      }));
      return { results, totalHits: data.photos.total };
    }
  } catch {}

  // Fallback: Wikipedia images
  try {
    const res = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsroffset=${offset}&gsrlimit=24&prop=pageimages|extracts|imageinfo&piprop=thumbnail&pithumbsize=800&exintro=true&explaintext=true&exsentences=2&format=json&origin=*`
    );
    const data = await res.json();

    if (!data.query || !data.query.pages) {
      return { results: [] };
    }

    const pages = data.query.pages as Record<string, Record<string, unknown>>;
    const results: ImageResult[] = Object.values(pages)
      .filter((page) => page.thumbnail)
      .map((page) => ({
        title: page.title as string,
        thumbnail: (page.thumbnail as Record<string, unknown>)?.source as string,
        description: (page.extract as string) || '',
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent((page.title as string).replace(/ /g, '_'))}`,
        width: (page.thumbnail as Record<string, unknown>)?.width as number,
        height: (page.thumbnail as Record<string, unknown>)?.height as number,
        originalImage: (page.originalimage as Record<string, unknown>)?.source as string,
      }));

    return { results, totalHits: data.query?.searchinfo?.totalhits };
  } catch {
    return { results: [] };
  }
}

// ─── Dictionary Definition ───────────────────────────────────────────────────

export async function getDefinition(word: string): Promise<Definition | null> {
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const entry = data[0];
    return {
      word: entry.word,
      phonetic: entry.phonetic || entry.phonetics?.find((p: {text?: string}) => p.text)?.text,
      meanings: entry.meanings?.slice(0, 3).map((m: {partOfSpeech: string; definitions: Array<{definition: string; example?: string}>}) => ({
        partOfSpeech: m.partOfSpeech,
        definitions: m.definitions?.slice(0, 3) || [],
      })) || [],
    };
  } catch {
    return null;
  }
}

// ─── Calculator ──────────────────────────────────────────────────────────────

export function evaluateExpression(expr: string): string | null {
  try {
    // Sanitize - only allow numbers, operators, parentheses, and basic math functions
    const sanitized = expr.replace(/[^0-9+\-*/().%^√piPIe\s]/g, '');
    if (!sanitized.trim()) return null;

    // Replace ^ with ** for exponentiation
    let processed = sanitized
      .replace(/\^/g, '**')
      .replace(/π|pi/gi, String(Math.PI))
      .replace(/√(\d+)/g, 'Math.sqrt($1)')
      .replace(/\be\b/g, String(Math.E));

    // Safety check - only allow safe expressions
    if (/[a-zA-Z]/.test(processed.replace(/Math\.(sqrt|PI|E|pow|abs|round|ceil|floor)/g, ''))) {
      return null;
    }

    // eslint-disable-next-line no-eval
    const result = eval(processed);
    if (typeof result === 'number' && isFinite(result)) {
      // Round to avoid floating point issues
      return Number(result.toPrecision(12)).toString();
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Quick Answer Detection ──────────────────────────────────────────────────

export function detectQuickAnswer(query: string): QuickAnswer {
  const q = query.trim().toLowerCase();

  // Calculator detection
  const calcPattern = /^[\d\s+\-*/().%^√piePIE]+$/;
  const calcPrefixPattern = /^(calculate|compute|solve|what is|what's|whats|evaluate|convert)\s+(.+)/i;
  
  if (calcPattern.test(q) && /[\d]+\s*[+\-*/^%]/.test(q)) {
    const result = evaluateExpression(q);
    if (result) {
      return { type: 'calculator', value: result };
    }
  }

  const prefixMatch = q.match(calcPrefixPattern);
  if (prefixMatch) {
    const expr = prefixMatch[2];
    const result = evaluateExpression(expr);
    if (result) {
      return { type: 'calculator', value: result, data: expr };
    }
  }

  // Time detection
  if (q.includes('what time') || q === 'time' || q.includes('current time')) {
    return {
      type: 'time',
      value: new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }),
    };
  }

  // Date detection
  if (q.includes('what date') || q.includes("today's date") || q.includes('todays date') || q === 'date') {
    return {
      type: 'time',
      value: new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    };
  }

  return { type: 'none' };
}

// ─── Utility Functions ───────────────────────────────────────────────────────

export function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

export function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)} days ago`;
  if (seconds < 31536000) return `${Math.floor(seconds / 2592000)} months ago`;
  return `${Math.floor(seconds / 31536000)} years ago`;
}

export function getRandomFact(): string {
  const facts = [
    "The human brain weighs about 3 pounds and contains 86 billion neurons.",
    "Honey never spoils. Archaeologists have found 3,000-year-old honey in Egyptian tombs that was still edible.",
    "Octopuses have three hearts and blue blood.",
    "The total weight of all ants on Earth is roughly equal to the total weight of all humans.",
    "A day on Venus is longer than a year on Venus.",
    "Bananas are naturally radioactive because they contain potassium-40.",
    "The shortest war in history lasted only 38 to 45 minutes between Britain and Zanzibar.",
    "There are more possible iterations of a game of chess than there are atoms in the observable universe.",
    "The world's oldest known living tree is over 5,000 years old.",
    "Light takes 8 minutes and 20 seconds to travel from the Sun to Earth.",
    "The Great Wall of China is not visible from space with the naked eye.",
    "A group of flamingos is called a 'flamboyance'.",
    "The inventor of the Pringles can is buried in one.",
    "There are more stars in the universe than grains of sand on all of Earth's beaches.",
    "The first computer programmer was Ada Lovelace, who lived in the 1800s.",
  ];
  return facts[Math.floor(Math.random() * facts.length)];
}

// ─── AI Summary Generation ─────────────────────────────────────────────────

export function generateAISummary(
  query: string,
  results: SearchResult[],
  pageSummary: PageSummary | null
): AISummary | null {
  if (results.length === 0 && !pageSummary) return null;

  const allText = [
    pageSummary?.extract || '',
    ...results.slice(0, 5).map((r) => r.snippet),
  ].filter(Boolean).join(' ');

  if (!allText.trim()) return null;

  const sentences = allText.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 20);

  // Score sentences by relevance to query
  const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const scoredSentences = sentences.map((sentence) => {
    const lower = sentence.toLowerCase();
    let score = 0;

    // Relevance to query
    queryWords.forEach((word) => {
      if (lower.includes(word)) score += 3;
    });

    // Position bonus (first sentences are usually more important)
    const idx = sentences.indexOf(sentence);
    if (idx < 3) score += 2;
    else if (idx < 6) score += 1;

    // Length bonus (prefer medium-length sentences)
    const wordCount = sentence.split(/\s+/).length;
    if (wordCount >= 10 && wordCount <= 25) score += 1;

    return { sentence, score };
  });

  // Extract top sentences for summary
  const topSentences = scoredSentences
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .sort((a, b) => sentences.indexOf(a.sentence) - sentences.indexOf(b.sentence))
    .map((s) => s.sentence);

  // Extract key points
  const keyPoints = sentences
    .filter((s) => {
      const wordCount = s.split(/\s+/).length;
      return wordCount >= 8 && wordCount <= 20;
    })
    .slice(0, 5);

  // Calculate read time (average 200 words per minute)
  const totalWords = allText.split(/\s+/).length;
  const readTime = Math.max(1, Math.ceil(totalWords / 200));

  return {
    title: `About ${query}`,
    summary: topSentences.join('. ') + '.',
    keyPoints,
    sources: [
      ...new Set([
        pageSummary?.content_urls?.desktop?.page,
        ...results.slice(0, 3).map((r) => r.url),
      ].filter(Boolean) as string[]),
    ],
    readTime,
  };
}

// ─── Bookmarks Management ──────────────────────────────────────────────────

export function saveBookmark(bookmark: Bookmark): void {
  try {
    const saved = localStorage.getItem("5*A-bookmarks");
    const bookmarks: Bookmark[] = saved ? JSON.parse(saved) : [];

    // Avoid duplicates
    if (!bookmarks.find((b) => b.url === bookmark.url)) {
      bookmarks.unshift(bookmark);
      localStorage.setItem("5*A-bookmarks", JSON.stringify(bookmarks.slice(0, 100)));
    }
  } catch {}
}

export function getBookmarks(): Bookmark[] {
  try {
    const saved = localStorage.getItem("5*A-bookmarks");
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function removeBookmark(url: string): void {
  try {
    const saved = localStorage.getItem("5*A-bookmarks");
    const bookmarks: Bookmark[] = saved ? JSON.parse(saved) : [];
    const filtered = bookmarks.filter((b) => b.url !== url);
    localStorage.setItem("5*A-bookmarks", JSON.stringify(filtered));
  } catch {}
}

export function isBookmarked(url: string): boolean {
  return getBookmarks().some((b) => b.url === url);
}

// ─── Search History Analytics ──────────────────────────────────────────────

export function getSearchHistory(): { term: string; count: number; lastSearched: string }[] {
  try {
    const saved = localStorage.getItem("5*A-recent-searches");
    const searches: string[] = saved ? JSON.parse(saved) : [];

    const frequency: Record<string, { count: number; lastSearched: string }> = {};
    searches.forEach((term, index) => {
      const key = term.toLowerCase();
      if (!frequency[key]) {
        frequency[key] = { count: 0, lastSearched: '' };
      }
      frequency[key].count += 1;
      frequency[key].lastSearched = new Date(Date.now() - index * 60000).toISOString();
    });

    return Object.entries(frequency)
      .map(([term, data]) => ({ term, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  } catch {
    return [];
  }
}

export function clearSearchHistory(): void {
  try {
    localStorage.removeItem("5*A-recent-searches");
  } catch {}
}

// ─── Translation ───────────────────────────────────────────────────────────

export async function translateText(
  text: string,
  targetLang: string = 'en'
): Promise<TranslationResult | null> {
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 500))}&langpair=en|${targetLang}`
    );
    const data = await res.json();
    return {
      original: text,
      translated: data.responseData?.translatedText || text,
      sourceLang: 'en',
      targetLang,
    };
  } catch {
    return null;
  }
}

// ─── Reading Time Estimation ───────────────────────────────────────────────

export function estimateReadTime(text: string): number {
  const wordsPerMinute = 200;
  const wordCount = text.split(/\s+/).length;
  return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
}

// ─── Share Utility ─────────────────────────────────────────────────────────

export async function shareContent(
  title: string,
  text: string,
  url: string
): Promise<boolean> {
  try {
    if (navigator.share) {
      await navigator.share({ title, text, url });
      return true;
    } else {
      await navigator.clipboard.writeText(`${title}\n${text}\n${url}`);
      return true;
    }
  } catch {
    return false;
  }
}

// ─── Print Utility ─────────────────────────────────────────────────────────

export function printResults(query: string, results: SearchResult[]): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>5*A Search Results: ${query}</title>
      <style>
        body { font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #111; }
        h1 { font-size: 24px; margin-bottom: 8px; }
        .meta { color: #666; font-size: 14px; margin-bottom: 24px; }
        .result { margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid #eee; }
        .result h2 { font-size: 18px; margin-bottom: 4px; }
        .result a { color: #1a0dab; text-decoration: none; }
        .result a:hover { text-decoration: underline; }
        .result .url { color: #006621; font-size: 14px; }
        .result .snippet { color: #555; font-size: 14px; line-height: 1.5; }
        @media print { body { margin: 0; } }
      </style>
    </head>
    <body>
      <h1>Search Results for "${query}"</h1>
      <p class="meta">${results.length} results | 5*A Search Engine | ${new Date().toLocaleDateString()}</p>
      ${results.map((r) => `
        <div class="result">
          <h2><a href="${r.url}">${r.title}</a></h2>
          <p class="url">${r.url}</p>
          <p class="snippet">${r.snippet}</p>
        </div>
      `).join('')}
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.print();
}

// ─── Keyboard Shortcuts ────────────────────────────────────────────────────

export interface KeyboardShortcut {
  key: string;
  description: string;
  modifier?: string;
}

export const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  { key: '/', description: 'Focus search bar' },
  { key: 'Escape', description: 'Close suggestions / Clear search' },
  { key: 'ArrowUp', description: 'Navigate suggestions up' },
  { key: 'ArrowDown', description: 'Navigate suggestions down' },
  { key: 'Enter', description: 'Search selected suggestion' },
  { key: 'd', description: 'Toggle dark mode', modifier: 'Ctrl' },
  { key: 'h', description: 'Go to home page', modifier: 'Ctrl' },
  { key: 'b', description: 'Open bookmarks', modifier: 'Ctrl' },
  { key: 'k', description: 'Show keyboard shortcuts', modifier: 'Ctrl' },
  { key: 'p', description: 'Print results', modifier: 'Ctrl' },
  { key: 'e', description: 'Export results', modifier: 'Ctrl' },
  { key: 'r', description: 'Reading mode', modifier: 'Ctrl' },
  { key: 'c', description: 'Compare view', modifier: 'Ctrl' },
  { key: 's', description: 'Search analytics', modifier: 'Ctrl' },
  { key: '+', description: 'Increase font size', modifier: 'Ctrl' },
  { key: '-', description: 'Decrease font size', modifier: 'Ctrl' },
];

// ─── Knowledge Sources ───────────────────────────────────────────────────

export interface KnowledgeSource {
  name: string;
  url: string;
  icon: string;
  description: string;
}

export const KNOWLEDGE_SOURCES: KnowledgeSource[] = [
  { name: "Wikipedia", url: "https://en.wikipedia.org", icon: "W", description: "Free encyclopedia" },
  { name: "Wiktionary", url: "https://en.wiktionary.org", icon: "Wt", description: "Dictionary & thesaurus" },
  { name: "Wikinews", url: "https://en.wikinews.org", icon: "Wn", description: "Free news source" },
  { name: "Wikiquote", url: "https://en.wikiquote.org", icon: "Wq", description: "Quotations" },
  { name: "Wikibooks", url: "https://en.wikibooks.org", icon: "Wb", description: "Free textbooks" },
  { name: "Wikivoyage", url: "https://en.wikivoyage.org", icon: "Wv", description: "Travel guide" },
  { name: "Wikisource", url: "https://en.wikisource.org", icon: "Ws", description: "Source texts" },
  { name: "Wikiversity", url: "https://en.wikiversity.org", icon: "Wu", description: "Learning resources" },
  { name: "Wikimedia Commons", url: "https://commons.wikimedia.org", icon: "Wc", description: "Free media library" },
  { name: "Scholarpedia", url: "https://www.scholarpedia.org", icon: "Sp", description: "Peer-reviewed encyclopedia" },
  { name: "HandWiki", url: "https://handwiki.org", icon: "H", description: "Science & tech encyclopedia" },
  { name: "Encyclopedia.com", url: "https://www.encyclopedia.com", icon: "E", description: "Multi-source reference" },
  { name: "Britannica", url: "https://www.britannica.com", icon: "B", description: "Trusted encyclopedia" },
  { name: "Citizendium", url: "https://citizendium.org", icon: "C", description: "Expert-reviewed wiki" },
  { name: "Conservapedia", url: "https://www.conservapedia.com", icon: "Cv", description: "Alternative encyclopedia" },
  { name: "Everipedia", url: "https://iq.wiki", icon: "Ei", description: "Blockchain encyclopedia" },
  { name: "RationalWiki", url: "https://rationalwiki.org", icon: "Rw", description: "Analysis of fringe topics" },
  { name: "Metapedia", url: "https://metapedia.org", icon: "Mp", description: "Cultural encyclopedia" },
  { name: "WikiAlpha", url: "https://wikialpha.org", icon: "Wa", description: "Flexible rules wiki" },
  { name: "Fandom", url: "https://www.fandom.com", icon: "F", description: "Fan wikis" },
];

// ─── Multi-Source Search ─────────────────────────────────────────────────

export async function searchMultipleSources(
  query: string,
  sources: string[] = ['wikipedia', 'wiktionary', 'wikinews']
): Promise<{ results: SearchResult[]; totalHits: number }> {
  const results: SearchResult[] = [];

  const sourceApis: Record<string, (q: string) => Promise<SearchResult[]>> = {
    wikipedia: async (q) => {
      const res = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=5&format=json&origin=*`
      );
      const data = await res.json();
      return (data.query?.search || []).map((item: Record<string, unknown>) => ({
        title: item.title as string,
        snippet: stripHtml(item.snippet as string),
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent((item.title as string).replace(/ /g, '_'))}`,
        wordcount: item.wordcount as number,
        timestamp: item.timestamp as string,
      }));
    },
    wiktionary: async (q) => {
      const res = await fetch(
        `https://en.wiktionary.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=3&format=json&origin=*`
      );
      const data = await res.json();
      return (data.query?.search || []).map((item: Record<string, unknown>) => ({
        title: item.title as string,
        snippet: stripHtml(item.snippet as string),
        url: `https://en.wiktionary.org/wiki/${encodeURIComponent((item.title as string).replace(/ /g, '_'))}`,
      }));
    },
    wikinews: async (q) => {
      const res = await fetch(
        `https://en.wikinews.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=3&format=json&origin=*`
      );
      const data = await res.json();
      return (data.query?.search || []).map((item: Record<string, unknown>) => ({
        title: item.title as string,
        snippet: stripHtml(item.snippet as string),
        url: `https://en.wikinews.org/wiki/${encodeURIComponent((item.title as string).replace(/ /g, '_'))}`,
        timestamp: item.timestamp as string,
      }));
    },
    wikiquote: async (q) => {
      const res = await fetch(
        `https://en.wikiquote.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=3&format=json&origin=*`
      );
      const data = await res.json();
      return (data.query?.search || []).map((item: Record<string, unknown>) => ({
        title: item.title as string,
        snippet: stripHtml(item.snippet as string),
        url: `https://en.wikiquote.org/wiki/${encodeURIComponent((item.title as string).replace(/ /g, '_'))}`,
      }));
    },
  };

  await Promise.all(
    sources
      .filter((s) => sourceApis[s])
      .map(async (source) => {
        try {
          const sourceResults = await sourceApis[source](query);
          results.push(...sourceResults);
        } catch {}
      })
  );

  return { results, totalHits: results.length };
}

// ─── Export Results ────────────────────────────────────────────────────────

export function exportToCSV(query: string, results: SearchResult[]): void {
  const headers = ['Title', 'URL', 'Snippet', 'Word Count', 'Timestamp'];
  const rows = results.map((r) => [
    `"${r.title.replace(/"/g, '""')}"`,
    r.url,
    `"${r.snippet.replace(/"/g, '""')}"`,
    r.wordcount || '',
    r.timestamp || '',
  ]);

  const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `5*A-${query.replace(/\s+/g, '-').toLowerCase()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportToJSON(query: string, results: SearchResult[]): void {
  const data = {
    query,
    timestamp: new Date().toISOString(),
    totalResults: results.length,
    results: results.map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.snippet,
      wordCount: r.wordcount,
      timestamp: r.timestamp,
    })),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `5*A-${query.replace(/\s+/g, '-').toLowerCase()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

// ─── Text-to-Speech ────────────────────────────────────────────────────────

export function speakText(text: string, lang: string = 'en-US'): void {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  }
}

export function stopSpeaking(): void {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

// ─── Result Highlighting ───────────────────────────────────────────────────

export function highlightText(text: string, query: string): string {
  if (!query.trim()) return text;
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  let result = text;
  words.forEach((word) => {
    const regex = new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    result = result.replace(regex, '<mark class="bg-yellow-200 text-black px-0.5 rounded">$1</mark>');
  });
  return result;
}

// ─── Font Size Management ──────────────────────────────────────────────────

export function getFontSize(): number {
  try {
    const saved = localStorage.getItem('5*A-font-size');
    return saved ? parseInt(saved, 10) : 16;
  } catch {
    return 16;
  }
}

export function setFontSize(size: number): void {
  const clamped = Math.max(12, Math.min(24, size));
  try {
    localStorage.setItem('5*A-font-size', String(clamped));
    document.documentElement.style.fontSize = `${clamped}px`;
  } catch {}
}

export function adjustFontSize(delta: number): number {
  const current = getFontSize();
  const newSize = current + delta;
  setFontSize(newSize);
  return newSize;
}

// ─── Theme Management ──────────────────────────────────────────────────────

export type ThemeMode = 'light' | 'dark' | 'midnight' | 'sepia' | 'ocean';

export interface ThemeConfig {
  mode: ThemeMode;
  bg: string;
  text: string;
  cardBg: string;
  border: string;
  accent: string;
}

export const THEMES: Record<ThemeMode, ThemeConfig> = {
  light: {
    mode: 'light',
    bg: 'bg-white',
    text: 'text-[#111]',
    cardBg: 'bg-[#fafafa]',
    border: 'border-[#eee]',
    accent: 'text-[#1a0dab]',
  },
  dark: {
    mode: 'dark',
    bg: 'bg-[#0a0a0a]',
    text: 'text-white',
    cardBg: 'bg-[#111]',
    border: 'border-[#1f1f1f]',
    accent: 'text-[#7ea8f0]',
  },
  midnight: {
    mode: 'midnight',
    bg: 'bg-[#0f172a]',
    text: 'text-[#e2e8f0]',
    cardBg: 'bg-[#1e293b]',
    border: 'border-[#334155]',
    accent: 'text-[#60a5fa]',
  },
  sepia: {
    mode: 'sepia',
    bg: 'bg-[#f4ecd8]',
    text: 'text-[#5b4636]',
    cardBg: 'bg-[#faf6ee]',
    border: 'border-[#d4c5a9]',
    accent: 'text-[#8b6914]',
  },
  ocean: {
    mode: 'ocean',
    bg: 'bg-[#0c1929]',
    text: 'text-[#c7d2fe]',
    cardBg: 'bg-[#1a2744]',
    border: 'border-[#2d4a7a]',
    accent: 'text-[#818cf8]',
  },
};

export function getTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem('5*A-theme');
    return (saved as ThemeMode) || 'light';
  } catch {
    return 'light';
  }
}

export function setTheme(mode: ThemeMode): void {
  try {
    localStorage.setItem('5*A-theme', mode);
  } catch {}
}

// ─── Search Collections ────────────────────────────────────────────────────

export interface SearchCollection {
  id: string;
  name: string;
  queries: string[];
  createdAt: string;
  color: string;
}

const COLLECTION_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4'];

export function saveCollection(name: string, queries: string[]): void {
  try {
    const saved = localStorage.getItem('5*A-collections');
    const collections: SearchCollection[] = saved ? JSON.parse(saved) : [];
    const color = COLLECTION_COLORS[collections.length % COLLECTION_COLORS.length];
    collections.unshift({
      id: Date.now().toString(),
      name,
      queries,
      createdAt: new Date().toISOString(),
      color,
    });
    localStorage.setItem('5*A-collections', JSON.stringify(collections.slice(0, 50)));
  } catch {}
}

export function getCollections(): SearchCollection[] {
  try {
    const saved = localStorage.getItem('5*A-collections');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function deleteCollection(id: string): void {
  try {
    const saved = localStorage.getItem('5*A-collections');
    const collections: SearchCollection[] = saved ? JSON.parse(saved) : [];
    localStorage.setItem('5*A-collections', JSON.stringify(collections.filter((c) => c.id !== id)));
  } catch {}
}

// ─── Performance Metrics ───────────────────────────────────────────────────

export interface PerformanceMetrics {
  searchCount: number;
  totalSearchTime: number;
  avgSearchTime: number;
  fastestSearch: number;
  slowestSearch: number;
  searchesToday: number;
  searchesThisWeek: number;
}

export function getPerformanceMetrics(): PerformanceMetrics {
  try {
    const saved = localStorage.getItem('5*A-metrics');
    const metrics: { times: number[]; dates: string[] } = saved ? JSON.parse(saved) : { times: [], dates: [] };
    const times = metrics.times;

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const searchesToday = metrics.dates.filter((d) => d.startsWith(today)).length;
    const searchesThisWeek = metrics.dates.filter((d) => d >= weekAgo).length;

    return {
      searchCount: times.length,
      totalSearchTime: times.reduce((a, b) => a + b, 0),
      avgSearchTime: times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0,
      fastestSearch: times.length > 0 ? Math.min(...times) : 0,
      slowestSearch: times.length > 0 ? Math.max(...times) : 0,
      searchesToday,
      searchesThisWeek,
    };
  } catch {
    return {
      searchCount: 0,
      totalSearchTime: 0,
      avgSearchTime: 0,
      fastestSearch: 0,
      slowestSearch: 0,
      searchesToday: 0,
      searchesThisWeek: 0,
    };
  }
}

export function recordSearchMetric(time: number): void {
  try {
    const saved = localStorage.getItem('5*A-metrics');
    const metrics: { times: number[]; dates: string[] } = saved ? JSON.parse(saved) : { times: [], dates: [] };
    metrics.times.push(time);
    metrics.dates.push(new Date().toISOString());
    // Keep last 1000 records
    metrics.times = metrics.times.slice(-1000);
    metrics.dates = metrics.dates.slice(-1000);
    localStorage.setItem('5*A-metrics', JSON.stringify(metrics));
  } catch {}
}

// ─── Offline Cache ─────────────────────────────────────────────────────────

export interface CachedResult {
  query: string;
  results: SearchResult[];
  timestamp: string;
}

export function cacheSearchResults(query: string, results: SearchResult[]): void {
  try {
    const saved = localStorage.getItem('5*A-cache');
    const cache: CachedResult[] = saved ? JSON.parse(saved) : [];
    const existing = cache.findIndex((c) => c.query.toLowerCase() === query.toLowerCase());
    const entry = { query, results, timestamp: new Date().toISOString() };

    if (existing >= 0) {
      cache[existing] = entry;
    } else {
      cache.unshift(entry);
    }

    // Keep last 50 cached searches
    localStorage.setItem('5*A-cache', JSON.stringify(cache.slice(0, 50)));
  } catch {}
}

export function getCachedResults(query: string): CachedResult | null {
  try {
    const saved = localStorage.getItem('5*A-cache');
    const cache: CachedResult[] = saved ? JSON.parse(saved) : [];
    return cache.find((c) => c.query.toLowerCase() === query.toLowerCase()) || null;
  } catch {
    return null;
  }
}

export function clearCache(): void {
  try {
    localStorage.removeItem('5*A-cache');
  } catch {}
}

// ─── Search Presets ────────────────────────────────────────────────────────

export interface SearchPreset {
  id: string;
  name: string;
  query: string;
  tab: string;
  dateRange: string;
  sortBy: string;
}

export function savePreset(name: string, query: string, tab: string, dateRange: string, sortBy: string): void {
  try {
    const saved = localStorage.getItem('5*A-presets');
    const presets: SearchPreset[] = saved ? JSON.parse(saved) : [];
    presets.unshift({
      id: Date.now().toString(),
      name,
      query,
      tab,
      dateRange,
      sortBy,
    });
    localStorage.setItem('5*A-presets', JSON.stringify(presets.slice(0, 20)));
  } catch {}
}

export function getPresets(): SearchPreset[] {
  try {
    const saved = localStorage.getItem('5*A-presets');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function deletePreset(id: string): void {
  try {
    const saved = localStorage.getItem('5*A-presets');
    const presets: SearchPreset[] = saved ? JSON.parse(saved) : [];
    localStorage.setItem('5*A-presets', JSON.stringify(presets.filter((p) => p.id !== id)));
  } catch {}
}

// ─── Advanced Search Parsing ───────────────────────────────────────────────

export interface ParsedQuery {
  original: string;
  terms: string[];
  excludeTerms: string[];
  exactPhrases: string[];
  siteFilter: string | null;
  fileType: string | null;
}

export function parseAdvancedQuery(query: string): ParsedQuery {
  const terms: string[] = [];
  const excludeTerms: string[] = [];
  const exactPhrases: string[] = [];
  let siteFilter: string | null = null;
  let fileType: string | null = null;

  // Extract exact phrases
  const phraseRegex = /"([^"]+)"/g;
  let match;
  let remaining = query;
  while ((match = phraseRegex.exec(query)) !== null) {
    exactPhrases.push(match[1]);
    remaining = remaining.replace(match[0], '');
  }

  // Extract site: filter
  const siteMatch = remaining.match(/site:(\S+)/);
  if (siteMatch) {
    siteFilter = siteMatch[1];
    remaining = remaining.replace(siteMatch[0], '');
  }

  // Extract filetype: filter
  const fileMatch = remaining.match(/filetype:(\S+)/);
  if (fileMatch) {
    fileType = fileMatch[1];
    remaining = remaining.replace(fileMatch[0], '');
  }

  // Parse remaining terms
  remaining.split(/\s+/).filter(Boolean).forEach((term) => {
    if (term.startsWith('-')) {
      excludeTerms.push(term.slice(1));
    } else {
      terms.push(term);
    }
  });

  return { original: query, terms, excludeTerms, exactPhrases, siteFilter, fileType };
}

// ─── Notes/Annotations ─────────────────────────────────────────────────────

export interface ResultNote {
  url: string;
  note: string;
  timestamp: string;
}

export function saveNote(url: string, note: string): void {
  try {
    const saved = localStorage.getItem('5*A-notes');
    const notes: ResultNote[] = saved ? JSON.parse(saved) : [];
    const existing = notes.findIndex((n) => n.url === url);
    if (existing >= 0) {
      notes[existing] = { url, note, timestamp: new Date().toISOString() };
    } else {
      notes.unshift({ url, note, timestamp: new Date().toISOString() });
    }
    localStorage.setItem('5*A-notes', JSON.stringify(notes.slice(0, 100)));
  } catch {}
}

export function getNote(url: string): string {
  try {
    const saved = localStorage.getItem('5*A-notes');
    const notes: ResultNote[] = saved ? JSON.parse(saved) : [];
    return notes.find((n) => n.url === url)?.note || '';
  } catch {
    return '';
  }
}

export function deleteNote(url: string): void {
  try {
    const saved = localStorage.getItem('5*A-notes');
    const notes: ResultNote[] = saved ? JSON.parse(saved) : [];
    localStorage.setItem('5*A-notes', JSON.stringify(notes.filter((n) => n.url !== url)));
  } catch {}
}

// ─── Compare View ──────────────────────────────────────────────────────────

export interface CompareItem {
  url: string;
  title: string;
  snippet: string;
  wordCount: number;
}

export function addToCompare(items: CompareItem[]): void {
  try {
    const saved = localStorage.getItem('5*A-compare');
    const compare: CompareItem[] = saved ? JSON.parse(saved) : [];
    const updated = [...items, ...compare.filter((c) => !items.find((i) => i.url === c.url))].slice(0, 4);
    localStorage.setItem('5*A-compare', JSON.stringify(updated));
  } catch {}
}

export function getCompareItems(): CompareItem[] {
  try {
    const saved = localStorage.getItem('5*A-compare');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function clearCompare(): void {
  try {
    localStorage.removeItem('5*A-compare');
  } catch {}
}
