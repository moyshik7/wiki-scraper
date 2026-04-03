import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const inputPath = path.join(process.cwd(), 'url.csv');
const tempPath = path.join(process.cwd(), 'url.csv.tmp');

const parseLine = (line) => {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const idx = trimmed.lastIndexOf(',');
  if (idx === -1) {
    return {
      url: trimmed,
      crawled: null
    };
  }

  const url = trimmed.slice(0, idx).trim();
  const crawledRaw = trimmed.slice(idx + 1).trim().toLowerCase();
  const crawled = crawledRaw === 'true' ? true : (crawledRaw === 'false' ? false : null);

  return {
    url,
    crawled
  };
};

const run = async () => {
  if (!fs.existsSync(inputPath)) {
    console.error(`[cleanup] File not found: ${inputPath}`);
    process.exit(1);
  }

  const input = fs.createReadStream(inputPath, { encoding: 'utf8' });
  const output = fs.createWriteStream(tempPath, { encoding: 'utf8' });

  const rl = readline.createInterface({
    input,
    crlfDelay: Infinity
  });

  let total = 0;
  let removed = 0;
  let kept = 0;

  for await (const line of rl) {
    total += 1;

    if (!line || line.trim() === '') {
      continue;
    }

    const parsed = parseLine(line);

    if (!parsed) {
      continue;
    }

    if (parsed.crawled === true) {
      removed += 1;
      continue;
    }

    output.write(`${parsed.url},false\n`);
    kept += 1;
  }

  await new Promise((resolve, reject) => {
    output.end((error) => {
      if (error) reject(error);
      else resolve();
    });
  });

  fs.renameSync(tempPath, inputPath);

  console.log(`[cleanup] Done. total=${total} removed=${removed} kept=${kept}`);
};

run().catch((error) => {
  console.error('[cleanup] Failed:', error.message);

  try {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  } catch {
    // Ignore cleanup errors
  }

  process.exit(1);
});
