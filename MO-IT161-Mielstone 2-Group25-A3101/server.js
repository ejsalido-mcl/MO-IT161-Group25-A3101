const { createApp } = require('./src/app');

const PORT = process.env.PORT || 3000;

createApp().listen(PORT, () => {
  console.log(`NetGuard running at http://localhost:${PORT}`);
});
