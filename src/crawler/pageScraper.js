import axios from 'axios';
import { load } from 'cheerio';

const scrapePage = async ({ url, userAgent, proxy, workerName, normalizeUrl, isAllowed, isArticleUrl }) => {
  try {
    const normalizedTargetUrl = normalizeUrl(url);
    if (!normalizedTargetUrl) return null;

    if (!isAllowed(normalizedTargetUrl)) {
        console.log(`\x1b[43;90m[Skipping] disallowed URL: ${normalizedTargetUrl}\x1b[0m`);
      return null;
    }

    const workerTag = workerName ? ` [${workerName}]` : '';
    console.log(`\x1b[40;90m[Scraping${workerTag}]\x1b[0m \x1b[37m${normalizedTargetUrl}\x1b[0m`);

    const useProxy = Boolean(proxy) && proxy !== 'none';
    const proxiedUrl = useProxy ? `${proxy}${encodeURIComponent(normalizedTargetUrl)}` : null;
    let response;

    if (useProxy) {
      try {
        response = await axios.get(proxiedUrl, {
          headers: { 'User-Agent': userAgent },
          timeout: 10000
        });
      } catch (proxyError) {
        console.warn(`\x1b[43;90m[Proxy Failed${workerTag}] ${normalizedTargetUrl} (${proxyError.message})\x1b[0m`);
        response = await axios.get(normalizedTargetUrl, {
          headers: { 'User-Agent': userAgent },
          timeout: 10000
        });
      }
    } else {
      response = await axios.get(normalizedTargetUrl, {
        headers: { 'User-Agent': userAgent },
        timeout: 10000
      });
    }

    const html = response.data;
    const $ = load(html);

    const title = $('h1#firstHeading').text().trim();

    const paragraphs = [];
    $('#mw-content-text p').each((_, el) => {
      const text = $(el).text().trim();
      if (text) {
        paragraphs.push(text);
      }
    });

    const content = paragraphs.join('\n\n');

    return {
      data: {
        url: normalizedTargetUrl,
        title,
        content,
        timestamp: new Date().toISOString()
      },
      newLinks: []
    };
  } catch (error) {
    console.error(`\x1b[41;97m[Error] ${url}]\x1b[0m`);
    console.error(`\x1b[41;97m[Error] ${error.message}\x1b[0m`);
    return null;
  }
};

export default scrapePage;
