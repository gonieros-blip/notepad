import { createClient } from "@libsql/client";
import dotenv from "dotenv";
dotenv.config();

export const db = createClient({
  url: process.env.TURSO_URL,
  authToken: process.env.TURSO_TOKEN,
});

export async function initDb() {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS notebooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      notebook_id INTEGER REFERENCES notebooks(id) ON DELETE SET NULL,
      title TEXT NOT NULL DEFAULT '제목 없음',
      content TEXT DEFAULT '',
      tags TEXT DEFAULT '[]',
      pinned INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );
  `);

  const { rows } = await db.execute("SELECT COUNT(*) as cnt FROM notebooks");
  if (rows[0].cnt === 0) {
    await db.execute("INSERT INTO notebooks (name) VALUES ('내 노트북')");
  }
}
