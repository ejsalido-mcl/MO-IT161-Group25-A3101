const { httpError } = require('../utils/httpError');

const notFound = (req, res, next) => next(httpError(404, 'Page not found.'));

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const message = status < 500 ? err.message : 'Something went wrong on our side. Please try again.';
  if (status >= 500) console.error(err);

  const wantsJson = req.originalUrl.startsWith('/api') || req.accepts(['html', 'json']) === 'json';
  if (wantsJson) return res.status(status).json({ error: message });
  res.status(status).render('error', { title: 'Error', status, message });
};

module.exports = { notFound, errorHandler };
