import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import createWriter from './src/writer/index.js';
import createCrawler from './src/crawler/index.js';
import workers from './workers.js';

const MinContentLength = 100;
const URL_FILE = process.env.URL_FILE || 'url.csv';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const parseUrlFromLine = (line) => {
  if (!line || typeof line !== 'string') return null;

  const trimmed = line.trim();
  if (!trimmed) return null;

  const lastComma = trimmed.lastIndexOf(',');
  if (lastComma === -1) {
    return trimmed;
  }

  const urlPart = trimmed.slice(0, lastComma).trim();
  const statusPart = trimmed.slice(lastComma + 1).trim().toLowerCase();

  if (statusPart === 'true') {
    return null;
  }

  return urlPart || null;
};

const main = async () => {
  console.log('[Init] Initializing Bengali Wikipedia Scraper...');

  const urlFilePath = path.join(process.cwd(), URL_FILE);
  if (!fs.existsSync(urlFilePath)) {
    throw new Error(`URL file not found: ${urlFilePath}`);
  }

  const writer = createWriter();
  const crawler = createCrawler();
  await crawler.initRobots();
  console.log(`[Init] Streaming URLs from ${URL_FILE}`);

  // Graceful shutdown handling
  let isRunning = true;
  let shutdownRequested = false;
  let reader = null;
  let urlStream = null;

  const requestShutdown = (signalName) => {
    if (shutdownRequested) return;
    shutdownRequested = true;
    console.log(`\x1b[31m\n[Terminate] Caught ${signalName}. Flushing remaining data and stopping...\x1b[0m`);
    isRunning = false;

    if (reader) {
      reader.close();
    }
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
      writer.close();
    } catch (flushError) {
      console.error(flushError);
    } finally {
      process.exit(1);
    }
  });

  // Main crawl loop (streaming one URL at a time)
  let scrapedInSession = 0;
  let processedInSession = 0;
  let skippedInSession = 0;
  let workerIndex = 0;
  const crawlStartedAt = Date.now();

  const printProgress = () => {
    const elapsedHours = (Date.now() - crawlStartedAt) / (1000 * 60 * 60);
    const ratePerHour = elapsedHours > 0 ? (scrapedInSession / elapsedHours) : 0;
    console.log(`\x1b[32m\n[Status] Processed: ${processedInSession} Scraped: ${scrapedInSession} Skipped: ${skippedInSession}\x1b[0m`);
    console.log(`\x1b[32m[Rate] ${ratePerHour.toFixed(1)} pages/hour\n\x1b[0m`);
  };

  try {
    urlStream = fs.createReadStream(urlFilePath, { encoding: 'utf8' });
    reader = readline.createInterface({
      input: urlStream,
      crlfDelay: Infinity
    });

    for await (const line of reader) {
      if (!isRunning) break;

      const targetUrl = parseUrlFromLine(line);
      if (!targetUrl) continue;

      const worker = workers[workerIndex % workers.length];
      workerIndex += 1;
      processedInSession += 1;

      const result = await crawler.scrapePage(targetUrl, {
        proxy: worker.proxy,
        agent: worker.agent,
        workerName: worker.name
      });

      if (result) {
        const contentLength = (result.data.content || '').trim().length;

        if (contentLength >= MinContentLength) {
          writer.write(result.data);
          scrapedInSession += 1;
        } else {
          skippedInSession += 1;
          console.log(`\x1b[33m[Skipping] Short content: (${contentLength}): ${result.data.url}\x1b[0m`);
        }
      } else {
        skippedInSession += 1;
      }

      if (processedInSession % 100 === 0) {
        printProgress();
      }

      if (worker.delay > 0) {
        await delay(worker.delay);
      }
    }
  } catch (error) {
    if (!shutdownRequested) {
      throw error;
    }
  } finally {
    writer.close();
    await crawler.close();
    printProgress();
    console.log('\x1b[31m[Terminate] Exited gracefully.\x1b[0m');
  }
};

main().catch(console.error);
