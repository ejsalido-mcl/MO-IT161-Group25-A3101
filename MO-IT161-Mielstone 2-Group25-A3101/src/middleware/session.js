// Lightweight anonymous "session": a random id stored in an HttpOnly cookie.
// It only lets a visitor see their own past assessments. No accounts, no personal data.
const crypto = require('crypto');

const COOKIE = 'ng_sid';
const ID_RE = /^[0-9a-f-]{36}$/;

module.exports = (req, res, next) => {
  let sid = null;
  for (const part of (req.headers.cookie || '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === COOKIE) sid = rest.join('=');
  }
  if (!sid || !ID_RE.test(sid)) {
    sid = crypto.randomUUID();
    res.cookie(COOKIE, sid, { httpOnly: true, sameSite: 'lax', maxAge: 365 * 24 * 60 * 60 * 1000 });
  }
  req.sessionId = sid;
  next();
};
