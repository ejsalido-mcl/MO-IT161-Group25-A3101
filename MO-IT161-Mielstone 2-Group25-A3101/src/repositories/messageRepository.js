const store = require('./jsonStore');

const create = (message) => store.mutate('messages', (items) => { items.push(message); return message; });

module.exports = { create };
