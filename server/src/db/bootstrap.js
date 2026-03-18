import { migrate } from './migrate.js';

/**
 * Bootstrap database schema by running all migrations.
 * @param {import('better-sqlite3').Database} db
 */
export function bootstrap(db) {
  migrate(db);
}
