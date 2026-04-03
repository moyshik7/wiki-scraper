import robotsParser from 'robots-parser';

const createRobotsManager = ({ client, baseUrl, userAgent }) => {
  let robots = null;
  let robotsTxt = '';

  const initRobots = async () => {
    try {
      const response = await client.get('/robots.txt');
      robotsTxt = response.data || '';
      robots = robotsParser(`${baseUrl}/robots.txt`, response.data);
      console.log('Loaded robots.txt successfully.');
    } catch (error) {
      console.error('Failed to load robots.txt, defaulting to allow all.', error.message);
      robots = {
        isAllowed: () => true
      };
    }
  };

  const isAllowed = (url) => {
    if (!robots) return true;
    return robots.isAllowed(url, userAgent);
  };

  const getSitemapsFromRobots = () => {
    if (!robotsTxt) return [];
    const lines = robotsTxt.split(/\r?\n/);
    const sitemaps = [];

    for (const line of lines) {
      const match = line.match(/^\s*Sitemap:\s*(\S+)\s*$/i);
      if (match && match[1]) {
        sitemaps.push(match[1].trim());
      }
    }

    return [...new Set(sitemaps)];
  };

  return {
    initRobots,
    isAllowed,
    getSitemapsFromRobots
  };
};

export default createRobotsManager;
