const path = require('path');
const express = require('express');
const session = require('./middleware/session');
const rateLimit = require('./middleware/rateLimit');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const pageRoutes = require('./routes/pages');
const apiRoutes = require('./routes/api');

function createApp() {
  const app = express();

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));
  app.disable('x-powered-by');

  app.locals.formatDate = (iso) =>
    new Date(iso).toLocaleString('en-PH', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Manila',
    });

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.locals.currentPath = req.path;
    next();
  });

  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use(express.urlencoded({ extended: false, limit: '10kb' }));
  app.use(express.json({ limit: '10kb' }));
  app.use(session);
  app.use(rateLimit());

  app.use('/api', apiRoutes);
  app.use('/', pageRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
