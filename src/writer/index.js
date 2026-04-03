import fs from 'node:fs';
import path from 'node:path';

const createWriter = (outputFilePath = path.join(process.cwd(), 'scraped_data.jsonl'), batchSize = 1000) => {
  let articleBuffer = [];
  let flushInProgress = false;
  let isClosed = false;

  fs.mkdirSync(path.dirname(outputFilePath), { recursive: true });

  const flushRows = () => {
    if (flushInProgress) return;

    const rowCount = articleBuffer.length;
    if (rowCount === 0) return;

    flushInProgress = true;

    try {
      const jsonl = articleBuffer.map((article) => JSON.stringify(article)).join('\n');
      fs.appendFileSync(outputFilePath, `${jsonl}\n`, 'utf8');
      articleBuffer = [];
    } finally {
      flushInProgress = false;
    }
  };

  const write = (data) => {
    articleBuffer.push(data);

    if (articleBuffer.length === batchSize) {
      flushRows();
    }
  };

  const flushRemaining = () => {
    flushRows();
  };

  const close = () => {
    if (isClosed) return;
    flushRows();
    articleBuffer = [];
    isClosed = true;
  };

  return {
    write,
    flushRemaining,
    close
  };
};

export default createWriter;
