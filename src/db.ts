import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../../job_tracker.db');

// Ensure the directory exists (though root usually does)
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

export function initDb() {
  console.log('Initializing database...');
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      company TEXT NOT NULL,
      role TEXT NOT NULL,
      location TEXT,
      type TEXT, -- 'Full-time', 'Contract', 'Internship', 'Remote'
      status TEXT NOT NULL, -- 'Applied', 'Interview', 'Offer', 'Rejected'
      applied_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      resume_version TEXT,
      recruiter_name TEXT,
      recruiter_email TEXT,
      recruiter_phone TEXT,
      link TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
    CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
  `);

  console.log('Database initialized.');
}

export default db;
