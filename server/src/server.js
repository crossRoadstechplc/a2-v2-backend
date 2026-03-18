import app from './app.js';
import { config } from './config/env.js';
import { initDb, closeDb } from './db/connection.js';

let server = null;

function start() {
  initDb();
  server = app.listen(config.port, () => {
    console.log(`A2 Simulator Gateway running on port ${config.port}`);
  });
}

function shutdown() {
  if (server) {
    server.close(() => {
      closeDb();
      process.exit(0);
    });
  } else {
    closeDb();
    process.exit(0);
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
