const crypto = require('crypto');
const repo = require('../repositories/messageRepository');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const str = (v) => (typeof v === 'string' ? v.trim() : '');

function validate(raw = {}) {
  const data = { name: str(raw.name), email: str(raw.email), subject: str(raw.subject), message: str(raw.message) };
  const errors = [];
  if (data.name.length < 2 || data.name.length > 100) errors.push({ field: 'name', message: 'Please enter your name (2-100 characters).' });
  if (!EMAIL_RE.test(data.email) || data.email.length > 254) errors.push({ field: 'email', message: 'Please enter a valid email address.' });
  if (data.subject.length < 3 || data.subject.length > 150) errors.push({ field: 'subject', message: 'Please enter a subject (3-150 characters).' });
  if (data.message.length < 10 || data.message.length > 2000) errors.push({ field: 'message', message: 'Your message must be 10-2000 characters.' });
  return { data, errors };
}

async function submit(raw) {
  const { data, errors } = validate(raw);
  if (errors.length) return { errors, data };
  const record = await repo.create({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...data });
  return { record, data };
}

module.exports = { validate, submit };
