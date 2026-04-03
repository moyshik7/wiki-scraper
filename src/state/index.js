import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const createStateManager = (filename = 'url.csv') => {
  const filePath = path.join(process.cwd(), filename);
  const urls = new Map();
  const pendingUrls = [];
  const pendingSet = new Set();

  const normalizeUrl = (rawUrl) => {
    if (!rawUrl || typeof rawUrl !== 'string') return null;

    try {
      const parsed = new URL(rawUrl.trim());
      parsed.search = '';
      parsed.hash = '';
      return `${parsed.origin}${parsed.pathname}`;
    } catch (error) {
      const cleaned = rawUrl.trim().split('#')[0].split('?')[0].trim();
      return cleaned || null;
    }
  };

  const load = async () => {
    if (!fs.existsSync(filePath)) {
      return;
    }

    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      if (!line || line.trim() === '') continue;
      const [url, crawledStr] = line.split(',');
      const normalized = normalizeUrl(url);
      if (normalized) {
        const isCrawled = Boolean(crawledStr && crawledStr.trim() === 'true');
        const current = urls.get(normalized);
        const nextValue = current === true ? true : isCrawled;
        urls.set(normalized, nextValue);

        if (!nextValue && !pendingSet.has(normalized)) {
          pendingUrls.push(normalized);
          pendingSet.add(normalized);
        }
      }
    }
  };

  const save = async () => {
    const lines = [];
    for (const [url, crawled] of urls.entries()) {
      lines.push(`${url},${crawled}`);
    }
    fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
  };

  const addUrls = (newUrls) => {
    let added = false;

    for (const url of newUrls) {
      const normalized = normalizeUrl(url);
      if (!normalized) continue;

      if (!urls.has(normalized)) {
        urls.set(normalized, false);
        if (!pendingSet.has(normalized)) {
          pendingUrls.push(normalized);
          pendingSet.add(normalized);
        }
        added = true;
      }
    }

    return added;
  };

  const getNextUrl = () => {
    while (pendingUrls.length > 0) {
      const url = pendingUrls.shift();
      pendingSet.delete(url);
      if (urls.get(url) === false) {
        return url;
      }
    }
    return null;
  };

  const markCrawled = (url) => {
    const normalized = normalizeUrl(url);
    if (normalized && urls.has(normalized)) {
      urls.set(normalized, true);
    }
  };

  const hasUrls = () => urls.size > 0;
  const getPendingCount = () => pendingUrls.length;

  return {
    urls,
    load,
    save,
    addUrls,
    getNextUrl,
    markCrawled,
    hasUrls,
    getPendingCount
  };
};

export default createStateManager;
