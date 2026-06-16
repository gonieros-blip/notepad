import { Router } from "express";
import { db } from "../db.js";

const router = Router();

router.get("/", async (req, res) => {
  const { rows } = await db.execute(
    "SELECT n.*, COUNT(notes.id) as note_count FROM notebooks n LEFT JOIN notes ON notes.notebook_id = n.id GROUP BY n.id ORDER BY n.name"
  );
  res.json(rows);
});

router.post("/", async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "이름이 필요합니다" });
  const result = await db.execute({
    sql: "INSERT INTO notebooks (name) VALUES (?) RETURNING *",
    args: [name.trim()],
  });
  res.json(result.rows[0]);
});

router.put("/:id", async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "이름이 필요합니다" });
  await db.execute({
    sql: "UPDATE notebooks SET name=?, updated_at=datetime('now') WHERE id=?",
    args: [name.trim(), req.params.id],
  });
  const { rows } = await db.execute({ sql: "SELECT * FROM notebooks WHERE id=?", args: [req.params.id] });
  res.json(rows[0]);
});

router.delete("/:id", async (req, res) => {
  await db.execute({ sql: "UPDATE notes SET notebook_id=NULL WHERE notebook_id=?", args: [req.params.id] });
  await db.execute({ sql: "DELETE FROM notebooks WHERE id=?", args: [req.params.id] });
  res.json({ ok: true });
});

export default router;
