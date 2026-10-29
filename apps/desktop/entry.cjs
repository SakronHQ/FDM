import('./dist/main/index.js').catch((err) => {
  console.error('[Electron Bootstrap Error]:', err);
  process.exit(1);
});
