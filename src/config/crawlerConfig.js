const BASE_URL = 'https://bn.wikipedia.org';
const BOT_USER_AGENT = 'RokomariSearchIndexBot/1.0';
const SITEMAP_BROWSER_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const EXCLUDED_NAMESPACES = new Set([
  'special',
  'talk',
  'user',
  'user_talk',
  'wikipedia',
  'wikipedia_talk',
  'file',
  'file_talk',
  'mediawiki',
  'mediawiki_talk',
  'template',
  'template_talk',
  'help',
  'help_talk',
  'category',
  'category_talk',
  'portal',
  'portal_talk',
  'draft',
  'draft_talk',
  'module',
  'module_talk',
  'media',
  'timedtext',
  'topic',
  'gadget',
  'gadget_definition'
]);

export {
  BASE_URL,
  BOT_USER_AGENT,
  SITEMAP_BROWSER_UA,
  EXCLUDED_NAMESPACES
};
