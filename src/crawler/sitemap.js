import { load } from 'cheerio';
import zlib from 'node:zlib';

const createSitemapFetcher = ({
  client,
  baseUrl,
  sitemapUserAgent,
  getSitemapsFromRobots,
  normalizeUrl,
  isArticleUrl,
  isAllowed
}) => {
  const closeSitemapBrowser = async () => {};

  const fetchSitemapXml = async (url) => {
    const response = await client.get(url, {
      responseType: 'arraybuffer',
      headers: {
        Accept: 'application/xml, text/xml, */*',
        'User-Agent': sitemapUserAgent
      },
      timeout: 15000
    });

    const body = Buffer.from(response.data);
    const contentType = (response.headers['content-type'] || '').toLowerCase();
    const contentEncoding = (response.headers['content-encoding'] || '').toLowerCase();
    const isGzipByExt = url.toLowerCase().endsWith('.gz');
    const isGzipByHeader = contentType.includes('gzip') || contentEncoding.includes('gzip');

    if (isGzipByExt || isGzipByHeader) {
      return zlib.gunzipSync(body).toString('utf8');
    }

    return body.toString('utf8');
  };

  const parseLocEntries = (xmlText) => {
    if (!xmlText || typeof xmlText !== 'string') return [];
    const $ = load(xmlText, { xmlMode: true });
    const entries = [];

    $('loc').each((_, elem) => {
      const text = $(elem).text().trim();
      if (text) entries.push(text);
    });

    return entries;
  };

  const getAllPagesLinks = async (maxPages = 5000) => {
    const links = [];
    let apcontinue = null;

    console.log(`Falling back to MediaWiki API bootstrap (max ${maxPages} pages)...`);

    while (links.length < maxPages) {
      const params = {
        action: 'query',
        format: 'json',
        list: 'allpages',
        aplimit: 'max',
        apnamespace: 0
      };

      if (apcontinue) {
        params.apcontinue = apcontinue;
      }

      const response = await client.get('/w/api.php', { params });
      const pages = response.data && response.data.query && Array.isArray(response.data.query.allpages)
        ? response.data.query.allpages
        : [];

      for (const page of pages) {
        if (!page || !page.title) continue;
        const title = String(page.title).trim().replace(/\s+/g, '_');
        if (!title) continue;
        links.push(`${baseUrl}/wiki/${encodeURIComponent(title).replace(/%2F/g, '/')}`);
        if (links.length >= maxPages) break;
      }

      apcontinue = response.data && response.data.continue ? response.data.continue.apcontinue : null;
      if (!apcontinue || pages.length === 0) break;
    }

    return links;
  };

  const getSitemapLinks = async () => {
    const sitemapLinks = [];

    const defaultSitemaps = [
      `${baseUrl}/sitemap.xml`,
      `${baseUrl}/w/sitemap.xml`
    ];

    const sitemapQueue = [...new Set([...getSitemapsFromRobots(), ...defaultSitemaps])];
    const visitedSitemaps = new Set();

    console.log(`Discovered ${sitemapQueue.length} sitemap roots.`);

    try {
      while (sitemapQueue.length > 0) {
        const sitemapUrl = sitemapQueue.shift();
        if (!sitemapUrl || visitedSitemaps.has(sitemapUrl)) continue;
        visitedSitemaps.add(sitemapUrl);

        try {
          console.log(`Fetching sitemap: ${sitemapUrl}`);
          const xml = await fetchSitemapXml(sitemapUrl);
          const entries = parseLocEntries(xml);

          if (entries.length === 0) continue;

          const hasSitemapEntries = /<sitemapindex/i.test(xml);

          if (hasSitemapEntries) {
            for (const entry of entries) {
              if (!visitedSitemaps.has(entry)) {
                sitemapQueue.push(entry);
              }
            }
          } else {
            sitemapLinks.push(...entries);
          }
        } catch (error) {
          console.error(`Error fetching sitemap ${sitemapUrl}:`, error.message);
        }
      }
    } finally {
      await closeSitemapBrowser();
    }

    let normalizedArticleLinks = [...new Set(sitemapLinks
      .map((url) => normalizeUrl(url))
      .filter((url) => isArticleUrl(url))
      .filter((url) => isAllowed(url)))];

    if (normalizedArticleLinks.length === 0) {
      try {
        const apiLinks = await getAllPagesLinks(5000);
        normalizedArticleLinks = [...new Set(apiLinks
          .map((url) => normalizeUrl(url))
          .filter((url) => isArticleUrl(url))
          .filter((url) => isAllowed(url)))];
      } catch (error) {
        console.error('MediaWiki API fallback failed:', error.message);
      }
    }

    if (normalizedArticleLinks.length === 0) {
      normalizedArticleLinks = [`${baseUrl}/wiki/প্রধান_পাতা`];
    }

    return normalizedArticleLinks;
  };

  return {
    fetchSitemapXml,
    getSitemapLinks,
    closeSitemapBrowser
  };
};

export default createSitemapFetcher;
