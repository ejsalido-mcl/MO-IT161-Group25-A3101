const crypto = require('crypto');
const scoring = require('./scoringService');
const repo = require('../repositories/assessmentRepository');

const toPublic = ({ sessionId, ...rest }) => rest; // never expose the owner's session id

async function submit(sessionId, rawAnswers) {
  const { answers, errors } = scoring.validate(rawAnswers);
  if (errors.length) return { errors };

  const record = {
    id: crypto.randomUUID(),
    sessionId,
    createdAt: new Date().toISOString(),
    answers,
    ...scoring.calculate(answers),
  };
  await repo.create(record);
  return { record };
}

module.exports = {
  submit,
  toPublic,
  list: (sessionId) => repo.listBySession(sessionId),
  get: (id, sessionId) => repo.findOwned(id, sessionId),
  remove: (id, sessionId) => repo.removeOwned(id, sessionId),
};
