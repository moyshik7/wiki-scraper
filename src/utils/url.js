const normalizeUrl = (rawUrl, baseUrl, allowedHostname = 'bn.wikipedia.org') => {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  try {
    const parsed = new URL(rawUrl, baseUrl);
    parsed.search = '';
    parsed.hash = '';

    if (parsed.hostname !== allowedHostname) {
      return null;
    }

    return `${parsed.origin}${parsed.pathname}`;
  } catch (error) {
    return rawUrl.split('#')[0].split('?')[0].trim() || null;
  }
};

const isArticleUrl = (url, normalizeUrlFn, excludedNamespaces) => {
  if (!url) return false;
  const normalized = normalizeUrlFn(url);
  if (!normalized) return false;

  try {
    const parsed = new URL(normalized);
    if (!parsed.pathname.startsWith('/wiki/')) return false;

    const rawTitle = parsed.pathname.slice('/wiki/'.length);
    if (!rawTitle) return false;

    let decodedTitle = rawTitle;
    try {
      decodedTitle = decodeURIComponent(rawTitle);
    } catch (error) {
      // Keep raw title if decode fails.
    }

    const colonIndex = decodedTitle.indexOf(':');
    if (colonIndex !== -1) {
      const namespace = decodedTitle
        .slice(0, colonIndex)
        .trim()
        .replace(/\s+/g, '_')
        .toLowerCase();

      if (excludedNamespaces.has(namespace)) {
        return false;
      }
    }

    return true;
  } catch (error) {
    return false;
  }
};

export {
  normalizeUrl,
  isArticleUrl
};
