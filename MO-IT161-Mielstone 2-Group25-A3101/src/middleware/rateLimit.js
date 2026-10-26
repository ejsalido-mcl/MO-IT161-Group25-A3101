// Tiny in-memory limiter for write requests (POST/DELETE) to discourage spam.
const { httpError } = require('../utils/httpError');

module.exports = function rateLimit({ windowMs = 60 * 1000, max = Number(process.env.RATE_LIMIT_MAX) || 30 } = {}) {
  const hits = new Map();
  return (req, res, next) => {
    if (req.method !== 'POST' && req.method !== 'DELETE') return next();
    const now = Date.now();
    if (hits.size > 1000) for (const [ip, r] of hits) if (now > r.reset) hits.delete(ip);

    const rec = hits.get(req.ip);
    if (!rec || now > rec.reset) {
      hits.set(req.ip, { count: 1, reset: now + windowMs });
      return next();
    }
    rec.count += 1;
    if (rec.count > max) {
      res.set('Retry-After', String(Math.ceil((rec.reset - now) / 1000)));
      return next(httpError(429, 'Too many requests. Please wait a minute and try again.'));
    }
    next();
  };
};
