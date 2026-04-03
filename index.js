import createStateManager from './src/state/index.js';
import createWriter from './src/writer/index.js';
import createCrawler from './src/crawler/index.js';
import loadSitemapUrlsFromCsv from './src/bootstrap/sitemapCsvLoader.js';
import workers from './workers.js';

const MinContentLength = 100;

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const main = async () => {
  console.log('[Init] Initializing Bengali Wikipedia Scraper...');
  
  const state = createStateManager();
  const writer = createWriter();
  const crawler = createCrawler();

  // Load state from url.csv if it exists
  await state.load();
  await crawler.initRobots();

  if (!state.hasUrls()) {
    console.log('[Init] No existing state found. Loading URLs from local sitemap CSV files...');
    const sitemapLinks = await loadSitemapUrlsFromCsv({ directoryPath: 'sitemaps' });
    state.addUrls(sitemapLinks);
    await state.save();
    console.log(`[Init] Added ${sitemapLinks.length} URLs from local sitemap CSV files.`);
  } else {
    console.log(`[Init] Loaded ${state.urls.size} URLs from state. ${state.getPendingCount()} pending.`);
  }

  // Graceful shutdown handling
  let isRunning = true;
  let shutdownRequested = false;

  const requestShutdown = (signalName) => {
    if (shutdownRequested) return;
    shutdownRequested = true;
    console.log(`\x1b[31m\n[Terminate] Caught ${signalName}. Flushing remaining data and stopping...\x1b[0m`);
    isRunning = false;
  };

  process.on('SIGINT', () => {
    requestShutdown('SIGINT');
  });

  process.on('SIGTERM', () => {
    requestShutdown('SIGTERM');
  });

  process.on('uncaughtException', (error) => {
    console.error('\x1b[41;97m[Fatal] Uncaught exception. Flushing remaining data before exit...\x1b[0m');
    console.error(error);
    try {
      writer.flushRemaining();
      state.save();
      writer.close();
    } catch (flushError) {
      console.error(flushError);
    } finally {
      process.exit(1);
    }
  });

  process.on('unhandledRejection', (reason) => {
    console.error('\x1b[41;97m[Fatal] Unhandled rejection. Flushing remaining data before exit...\x1b[0m');
    console.error(reason);
    try {
      writer.flushRemaining();
      state.save();
      writer.close();
    } catch (flushError) {
      console.error(flushError);
    } finally {
      process.exit(1);
    }
  });

  // Main Crawl Loop (concurrent workers)
  let scrapedInSession = 0;
  let saveInFlight = false;
  const initialPendingUrls = state.getPendingCount();
  const crawlStartedAt = Date.now();

  const saveProgress = async () => {
    if (saveInFlight) return;
    saveInFlight = true;
    try {
      await state.save();
      const totalUrls = state.urls.size;
      const pendingUrls = state.getPendingCount();
      const crawledUrls = Math.max(0, initialPendingUrls - pendingUrls);
      const elapsedHours = (Date.now() - crawlStartedAt) / (1000 * 60 * 60);
      const ratePerHour = elapsedHours > 0 ? (crawledUrls / elapsedHours) : 0;
      console.log(`\x1b[32m\n[Status] Crawled: ${crawledUrls} Pending: ${pendingUrls}\x1b[0m`);
      console.log(`\x1b[32m[Status] Total URLs: ${totalUrls}/${totalUrls - pendingUrls} ${totalUrls > 0 ? (((totalUrls - pendingUrls) / totalUrls) * 100).toFixed(1) : 0}%\x1b[0m`);
      console.log(`\x1b[32m[Rate] ${ratePerHour.toFixed(1)} pages/hour\n\x1b[0m`);
    } finally {
      saveInFlight = false;
    }
  };

  const runWorker = async (worker, workerId) => {
    while (isRunning) {
      const targetUrl = state.getNextUrl();
      if (!targetUrl) {
        return;
      }

      const result = await crawler.scrapePage(targetUrl, {
        proxy: worker.proxy,
        agent: worker.agent,
        workerName: worker.name
      });

      if (result) {
        const contentLength = (result.data.content || '').trim().length;

        if (contentLength >= MinContentLength) {
          writer.write(result.data);
          scrapedInSession++;
        } else {
          console.log(`\x1b[33m[Worker ${workerId}] [Skipping] Short content: (${contentLength}): ${result.data.url}\x1b[0m`);
        }

        // Link discovery is disabled: do not enqueue links found on crawled pages.
      }

      // Always mark as crawled so we don't end up in an infinite retry loop on failures
      state.markCrawled(targetUrl);

      // Save state every 10 successful writes to minimize I/O overhead
      if (scrapedInSession > 0 && scrapedInSession % 10 === 0) {
        await saveProgress();
      }

      // Delay between requests for this worker (0 means no delay)
      if (worker.delay > 0) {
        await delay(worker.delay);
      }
    }
  };

  console.log(`[Crawler] Starting ${workers.length} workers from config`);
  await Promise.all(workers.map((worker, idx) => runWorker(worker, idx + 1)));
  console.log('[Crawler] Finished all pending URLs.');

  // Final save on exit
  await saveProgress();
  writer.close();
  console.log('\x1b[31m[Terminate] Exited gracefully.\n[Status] Final state saved.\x1b[0m');
};

main().catch(console.error);
