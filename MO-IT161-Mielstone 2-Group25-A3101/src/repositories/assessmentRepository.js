const store = require('./jsonStore');

const COLLECTION = 'assessments';

const create = (record) => store.mutate(COLLECTION, (items) => { items.push(record); return record; });

async function listBySession(sessionId) {
  const items = await store.read(COLLECTION);
  return items.filter((r) => r.sessionId === sessionId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function findOwned(id, sessionId) {
  const items = await store.read(COLLECTION);
  return items.find((r) => r.id === id && r.sessionId === sessionId) || null;
}

const removeOwned = (id, sessionId) =>
  store.mutate(COLLECTION, (items) => {
    const idx = items.findIndex((r) => r.id === id && r.sessionId === sessionId);
    if (idx === -1) return false;
    items.splice(idx, 1);
    return true;
  });

module.exports = { create, listBySession, findOwned, removeOwned };
