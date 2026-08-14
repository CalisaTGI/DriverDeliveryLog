import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function initDb() {
  const db = await open({
    filename: path.join(__dirname, 'delivery_log.db'),
    driver: sqlite3.Database
  });

  // 1. Driver Roster table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS drivers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    )
  `);

  // 2. Location Quick-Pick table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    )
  `);

  // 3. Complete Delivery logs table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS delivery_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_tx_id TEXT,
      log_date TEXT,
      driver_name TEXT,
      job_number TEXT,
      task_letter TEXT,
      paperwork INTEGER DEFAULT 0,
      location TEXT,
      start_time TEXT,
      stop_time TEXT,
      total_time TEXT,
      arrival_back_time TEXT,
      signature TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migration helper: Add client_tx_id if schema was created earlier without it
  try {
    const columns = await db.all(`PRAGMA table_info(delivery_logs)`);
    const hasTxId = columns.some((col) => col.name === 'client_tx_id');
    if (!hasTxId) {
      await db.exec(`ALTER TABLE delivery_logs ADD COLUMN client_tx_id TEXT`);
    }
  } catch (err) {
    console.error('Migration warning (client_tx_id):', err.message);
  }

  // Seed baseline personnel
  const defaultCrew = ["Dion Lewis", "Carlos Nunez"];
  for (const driver of defaultCrew) {
    await db.run('INSERT OR IGNORE INTO drivers (name) VALUES (?)', [driver]);
  }

  // Seed baseline common locations
  const defaultPlaces = ["Flint PO", "Metroplex"];
  for (const place of defaultPlaces) {
    await db.run('INSERT OR IGNORE INTO locations (name) VALUES (?)', [place]);
  }

  return db;
}
