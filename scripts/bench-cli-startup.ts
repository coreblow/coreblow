const start = Date.now(); import('../dist/index.js').then(() => console.log(`Startup: ${Date.now() - start}ms`));
