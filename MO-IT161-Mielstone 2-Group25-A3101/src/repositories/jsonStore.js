// Minimal JSON-file persistence. Writes are serialized and atomic (temp file + rename),
// so data survives server restarts and a crash can't leave a half-written file.
const fs = require('fs');
const path = require('path');

let queue = Promise.resolve();

const dataDir = () => process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const filePath = (name) => path.join(dataDir(), `${name}.json`);

async function read(name) {
  try {
    return JSON.parse(await fs.promises.readFile(filePath(name), 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

// Read-modify-write one collection. fn(items) may mutate and return a result.
function mutate(name, fn) {
  const run = queue.then(async () => {
    const items = await read(name);
    const result = await fn(items);
    await fs.promises.mkdir(dataDir(), { recursive: true });
    const tmp = `${filePath(name)}.tmp`;
    await fs.promises.writeFile(tmp, JSON.stringify(items, null, 2));
    await fs.promises.rename(tmp, filePath(name));
    return result;
  });
  queue = run.catch(() => {});
  return run;
}

module.exports = { read, mutate };
