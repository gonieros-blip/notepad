import { Router } from "express";
import { db } from "../db.js";

const router = Router();

router.get("/", async (req, res) => {
  const { notebook_id, tag, search, pinned } = req.query;
  let sql = "SELECT * FROM notes WHERE 1=1";
  const args = [];

  if (notebook_id) { sql += " AND notebook_id=?"; args.push(notebook_id); }
  if (pinned === "1") { sql += " AND pinned=1"; }
  if (tag) { sql += " AND tags LIKE ?"; args.push(`%"${tag}"%`); }
  if (search) { sql += " AND (title LIKE ? OR content LIKE ?)"; args.push(`%${search}%`, `%${search}%`); }

  sql += " ORDER BY pinned DESC, updated_at DESC";
  const { rows } = await db.execute({ sql, args });
  res.json(rows);
});

router.post("/", async (req, res) => {
  const { title = "제목 없음", content = "", notebook_id = null, tags = "[]" } = req.body;
  const result = await db.execute({
    sql: "INSERT INTO notes (title, content, notebook_id, tags) VALUES (?, ?, ?, ?) RETURNING *",
    args: [title, content, notebook_id, typeof tags === "string" ? tags : JSON.stringify(tags)],
  });
  res.json(result.rows[0]);
});

router.put("/:id", async (req, res) => {
  const { title, content, notebook_id, tags, pinned } = req.body;
  const note = (await db.execute({ sql: "SELECT * FROM notes WHERE id=?", args: [req.params.id] })).rows[0];
  if (!note) return res.status(404).json({ error: "노트를 찾을 수 없습니다" });

  const updated = {
    title: title ?? note.title,
    content: content ?? note.content,
    notebook_id: notebook_id !== undefined ? notebook_id : note.notebook_id,
    tags: tags !== undefined ? (typeof tags === "string" ? tags : JSON.stringify(tags)) : note.tags,
    pinned: pinned !== undefined ? (pinned ? 1 : 0) : note.pinned,
  };

  const result = await db.execute({
    sql: "UPDATE notes SET title=?, content=?, notebook_id=?, tags=?, pinned=?, updated_at=datetime('now') WHERE id=? RETURNING *",
    args: [updated.title, updated.content, updated.notebook_id, updated.tags, updated.pinned, req.params.id],
  });
  res.json(result.rows[0]);
});

router.delete("/:id", async (req, res) => {
  await db.execute({ sql: "DELETE FROM notes WHERE id=?", args: [req.params.id] });
  res.json({ ok: true });
});

export default router;
