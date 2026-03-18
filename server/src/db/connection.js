import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { config } from '../config/env.js';
import { bootstrap } from './bootstrap.js';

let db = null;

/**
 * Get or create the SQLite database connection.
 * @returns {import('better-sqlite3').Database}
 */
export function getDb() {
  if (!db) {
    const dbPath = resolve(config.databasePath);
    if (dbPath !== ':memory:') {
      const dir = dirname(dbPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
  }
  return db;
}

/**
 * Initialize database: connect and run bootstrap.
 */
export function initDb() {
  const database = getDb();
  bootstrap(database);
  return database;
}

/**
 * Close the database connection (for graceful shutdown).
 */
export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
