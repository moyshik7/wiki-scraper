import axios from 'axios';

import createRobotsManager from './robots.js';
import createSitemapFetcher from './sitemap.js';
import scrapePage from './pageScraper.js';
import { normalizeUrl, isArticleUrl } from '../utils/url.js';
import {
  BASE_URL,
  BOT_USER_AGENT,
  SITEMAP_BROWSER_UA,
  EXCLUDED_NAMESPACES
} from '../config/crawlerConfig.js';

const createCrawler = () => {
  const client = axios.create({
    baseURL: BASE_URL,
    headers: {
      'User-Agent': BOT_USER_AGENT
    },
    timeout: 10000
  });

  const normalize = (rawUrl) => normalizeUrl(rawUrl, BASE_URL);
  const isArticle = (url) => isArticleUrl(url, normalize, EXCLUDED_NAMESPACES);

  const robotsManager = createRobotsManager({
    client,
    baseUrl: BASE_URL,
    userAgent: BOT_USER_AGENT
  });

  const sitemapFetcher = createSitemapFetcher({
    client,
    baseUrl: BASE_URL,
    sitemapUserAgent: SITEMAP_BROWSER_UA,
    getSitemapsFromRobots: robotsManager.getSitemapsFromRobots,
    normalizeUrl: normalize,
    isArticleUrl: isArticle,
    isAllowed: robotsManager.isAllowed
  });

  return {
    userAgent: BOT_USER_AGENT,
    initRobots: robotsManager.initRobots,
    isAllowed: robotsManager.isAllowed,
    normalizeUrl: normalize,
    isArticleUrl: isArticle,
    fetchSitemapXml: sitemapFetcher.fetchSitemapXml,
    getSitemapLinks: sitemapFetcher.getSitemapLinks,
    scrapePage: (url, options = {}) => scrapePage({
      url,
      userAgent: options.agent || BOT_USER_AGENT,
      proxy: options.proxy,
      workerName: options.workerName,
      normalizeUrl: normalize,
      isAllowed: robotsManager.isAllowed,
      isArticleUrl: isArticle
    }),
    close: sitemapFetcher.closeSitemapBrowser
  };
};

export default createCrawler;
