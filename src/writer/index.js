import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const createWriter = (outputFilePath = path.join(process.cwd(), 'scraped_data.jsonl'), batchSize = 1000) => {
  const database = new Database(':memory:');
  let flushInProgress = false;
  let isClosed = false;

  fs.mkdirSync(path.dirname(outputFilePath), { recursive: true });

  database.pragma('journal_mode = MEMORY');
  database.pragma('synchronous = OFF');
  database.exec(`
    CREATE TABLE IF NOT EXISTS scraped_articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payload TEXT NOT NULL
    )
  `);

  const countRows = () => {
    const row = database.prepare('SELECT COUNT(*) AS count FROM scraped_articles').get();
    return row.count;
  };

  const flushRows = () => {
    if (flushInProgress) return;

    const rowCount = countRows();
    if (rowCount === 0) return;

    flushInProgress = true;

    try {
      const rows = database.prepare('SELECT id, payload FROM scraped_articles ORDER BY id ASC').all();
      const jsonl = rows.map((row) => row.payload).join('\n');
      fs.appendFileSync(outputFilePath, `${jsonl}\n`, 'utf8');
      database.exec('DELETE FROM scraped_articles');
    } finally {
      flushInProgress = false;
    }
  };

  const write = (data) => {
    const payload = JSON.stringify(data);
    database.prepare('INSERT INTO scraped_articles (payload) VALUES (?)').run(payload);

    if (countRows() === batchSize) {
      flushRows();
    }
  };

  const flushRemaining = () => {
    flushRows();
  };

  const close = () => {
    if (isClosed) return;
    flushRows();
    database.close();
    isClosed = true;
  };

  return {
    write,
    flushRemaining,
    close
  };
};

export default createWriter;
