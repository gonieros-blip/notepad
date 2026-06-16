import express from "express";
import dotenv from "dotenv";
import { initDb } from "./db.js";
import notebooksRouter from "./routes/notebooks.js";
import notesRouter from "./routes/notes.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.static("public"));

app.use("/api/notebooks", notebooksRouter);
app.use("/api/notes", notesRouter);

app.get("/api/tags", async (req, res) => {
  const { db } = await import("./db.js");
  const { rows } = await db.execute(`
    SELECT DISTINCT json_each.value as tag
    FROM notes, json_each(notes.tags)
    WHERE notes.tags != '[]'
    ORDER BY tag
  `);
  res.json(rows.map(r => r.tag));
});

const PORT = process.env.PORT || 3000;

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error("DB init failed:", err);
    process.exit(1);
  });
