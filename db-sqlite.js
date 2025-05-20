import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

// Open a database connection
const db = await open({
  filename: process.env.DATABASE_FILE || './database.sqlite',
  driver: sqlite3.Database,
});

// Create the tweets table if it doesn't exist
await db.exec(`
  CREATE TABLE IF NOT EXISTS tweets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author_id INTEGER,
    message VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
// Create the users table if it doesn't exist
await db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255),
    password VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
// Create the threads table if it doesn't exist
await db.exec(`
  CREATE TABLE IF NOT EXISTS threads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    origin_id INTEGER,
    reply_id INTEGER
    );
`);

// Insert a default user if the table is empty
const userCount = await db.get('SELECT COUNT(*) AS count FROM users');
if (userCount.count === 0) {
  await db.run(`
    INSERT INTO users (name, password)
    VALUES (?, ?)`
    , 'Anonymous', `$2b$10$6VuuksTM45Q03pt09CFYaOknBYKavE9fsVmRB9OtYRkdpfR5818oe`);
}

// Export the database connection
export default db;