import path from 'node:path';
import { readdir } from 'node:fs/promises';
import { parseFile } from 'fast-csv';

const extractUrlFromRow = (row) => {
  if (!row || typeof row !== 'object') return null;

  const candidateKeys = ['url', 'URL', 'loc', 'Loc', 'link', 'Link'];

  for (const key of candidateKeys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  const firstUrlLikeValue = Object.values(row).find((value) => (
    typeof value === 'string' && /^https?:\/\//i.test(value.trim())
  ));

  return firstUrlLikeValue ? firstUrlLikeValue.trim() : null;
};

const parseCsvFile = async (filePath) => new Promise((resolve, reject) => {
  const fileUrls = [];

  parseFile(filePath, {
    headers: true,
    delimiter: ';',
    quote: '"',
    trim: true,
    ignoreEmpty: true
  })
    .on('error', reject)
    .on('data', (row) => {
      const url = extractUrlFromRow(row);
      if (url) {
        fileUrls.push(url);
      }
    })
    .on('end', () => resolve(fileUrls));
});

const loadSitemapUrlsFromCsv = async ({ directoryPath = 'sitemaps' } = {}) => {
  const absoluteDirectoryPath = path.resolve(process.cwd(), directoryPath);

  let files;
  try {
    files = await readdir(absoluteDirectoryPath);
  } catch (error) {
    console.warn(`Sitemap CSV directory not found: ${absoluteDirectoryPath}`);
    return [];
  }

  const csvFiles = files
    .filter((file) => file.toLowerCase().endsWith('.csv'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const urls = [];

  for (const file of csvFiles) {
    const filePath = path.join(absoluteDirectoryPath, file);
    const fileUrls = await parseCsvFile(filePath);
    urls.push(...fileUrls);
  }

  return [...new Set(urls)];
};

export default loadSitemapUrlsFromCsv;
