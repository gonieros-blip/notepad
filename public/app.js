const api = {
  async get(url) { return (await fetch(url)).json(); },
  async post(url, data) { return (await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })).json(); },
  async put(url, data) { return (await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })).json(); },
  async del(url) { return (await fetch(url, { method: "DELETE" })).json(); },
};

const state = {
  notebooks: [],
  notes: [],
  tags: [],
  currentNote: null,
  currentView: "all",
  currentNotebook: null,
  currentTag: null,
  saveTimer: null,
  noteTags: [],
};

// ── DOM refs ──
const $ = id => document.getElementById(id);
const notebookList = $("notebook-list");
const tagList = $("tag-list");
const noteList = $("note-list");
const panelTitle = $("panel-title");
const editorEmpty = $("editor-empty");
const editorContent = $("editor-content");
const noteTitle = $("note-title");
const noteBody = $("note-body");
const noteDate = $("note-date");
const saveStatus = $("save-status");
const btnPin = $("btn-pin");
const tagsDisplay = $("tags-display");
const tagInput = $("tag-input");
const notebookSelect = $("note-notebook-select");
const headingSelect = $("heading-select");

noteBody.setAttribute("data-placeholder", "내용을 입력하세요...");

// ── Render ──
function renderNotebooks() {
  notebookList.innerHTML = "";
  state.notebooks.forEach(nb => {
    const el = document.createElement("div");
    el.className = "notebook-item" + (state.currentNotebook === nb.id ? " active" : "");
    el.innerHTML = `
      <span class="nb-name">${esc(nb.name)}</span>
      <span class="nb-count">${nb.note_count}</span>
      <span class="nb-actions">
        <button class="edit-nb" data-id="${nb.id}" title="이름 변경">✏️</button>
        <button class="del-nb" data-id="${nb.id}" title="삭제">🗑️</button>
      </span>`;
    el.querySelector(".nb-name").addEventListener("click", () => selectNotebook(nb.id));
    el.querySelector(".nb-count").addEventListener("click", () => selectNotebook(nb.id));
    el.querySelector(".edit-nb").addEventListener("click", e => { e.stopPropagation(); openModal("노트북 이름 변경", nb.name, val => renameNotebook(nb.id, val)); });
    el.querySelector(".del-nb").addEventListener("click", e => { e.stopPropagation(); if (confirm(`"${nb.name}" 노트북을 삭제하시겠습니까?`)) deleteNotebook(nb.id); });
    notebookList.appendChild(el);
  });
}

function renderTags() {
  tagList.innerHTML = "";
  state.tags.forEach(tag => {
    const el = document.createElement("div");
    el.className = "tag-item" + (state.currentTag === tag ? " active" : "");
    el.textContent = tag;
    el.addEventListener("click", () => selectTag(tag));
    tagList.appendChild(el);
  });
}

function renderNoteList() {
  noteList.innerHTML = "";
  if (!state.notes.length) {
    noteList.innerHTML = "<div style='padding:24px;text-align:center;color:#bbb;font-size:13px'>노트가 없습니다</div>";
    return;
  }
  state.notes.forEach(note => {
    const el = document.createElement("div");
    el.className = "note-card" + (state.currentNote?.id === note.id ? " active" : "");
    const tags = JSON.parse(note.tags || "[]");
    const preview = note.content ? note.content.replace(/<[^>]+>/g, "").slice(0, 80) : "";
    el.innerHTML = `
      <div class="note-card-title">${note.pinned ? '<span class="note-card-pin">★ </span>' : ""}${esc(note.title)}</div>
      <div class="note-card-preview">${esc(preview) || "내용 없음"}</div>
      <div class="note-card-meta"><span>${formatDate(note.updated_at)}</span></div>
      ${tags.length ? `<div class="note-card-tags">${tags.map(t => `<span class="note-tag-badge">#${esc(t)}</span>`).join("")}</div>` : ""}`;
    el.addEventListener("click", () => selectNote(note));
    noteList.appendChild(el);
  });
}

function renderEditor(note) {
  editorEmpty.classList.add("hidden");
  editorContent.classList.remove("hidden");

  state.noteTags = JSON.parse(note.tags || "[]");
  noteTitle.value = note.title === "제목 없음" ? "" : note.title;
  noteBody.innerHTML = note.content || "";
  noteDate.textContent = "마지막 수정: " + formatDate(note.updated_at);
  btnPin.classList.toggle("pinned", !!note.pinned);
  btnPin.title = note.pinned ? "즐겨찾기 해제" : "즐겨찾기";

  renderEditorTags();
  refreshNotebookSelect(note.notebook_id);
  saveStatus.textContent = "";
}

function renderEditorTags() {
  tagsDisplay.innerHTML = "";
  state.noteTags.forEach(tag => {
    const span = document.createElement("span");
    span.className = "editor-tag";
    span.innerHTML = `#${esc(tag)} <span class="remove-tag" data-tag="${esc(tag)}">×</span>`;
    span.querySelector(".remove-tag").addEventListener("click", () => removeTag(tag));
    tagsDisplay.appendChild(span);
  });
}

function refreshNotebookSelect(currentId) {
  notebookSelect.innerHTML = '<option value="">노트북 없음</option>';
  state.notebooks.forEach(nb => {
    const opt = document.createElement("option");
    opt.value = nb.id;
    opt.textContent = nb.name;
    if (nb.id === currentId) opt.selected = true;
    notebookSelect.appendChild(opt);
  });
}

// ── Data loading ──
async function loadAll() {
  const [notebooks, tags] = await Promise.all([
    api.get("/api/notebooks"),
    api.get("/api/tags"),
  ]);
  state.notebooks = notebooks;
  state.tags = tags;
  renderNotebooks();
  renderTags();
  await loadNotes();
}

async function loadNotes() {
  const params = new URLSearchParams();
  if (state.currentView === "pinned") params.set("pinned", "1");
  if (state.currentNotebook) params.set("notebook_id", state.currentNotebook);
  if (state.currentTag) params.set("tag", state.currentTag);

  state.notes = await api.get("/api/notes?" + params);
  renderNoteList();

  if (state.currentNote) {
    const still = state.notes.find(n => n.id === state.currentNote.id);
    if (!still && state.notes.length) selectNote(state.notes[0]);
  }
}

// ── Actions ──
async function selectNote(note) {
  state.currentNote = note;
  renderNoteList();
  renderEditor(note);
}

function selectNotebook(id) {
  state.currentNotebook = id === state.currentNotebook ? null : id;
  state.currentTag = null;
  state.currentView = "all";
  updateNavActive(null);
  document.querySelectorAll(".notebook-item").forEach(el => el.classList.remove("active"));
  if (state.currentNotebook) {
    const nb = state.notebooks.find(n => n.id === id);
    panelTitle.textContent = nb ? nb.name : "노트";
  } else {
    panelTitle.textContent = "모든 노트";
  }
  renderNotebooks();
  renderTags();
  loadNotes();
}

function selectTag(tag) {
  state.currentTag = tag === state.currentTag ? null : tag;
  state.currentNotebook = null;
  state.currentView = "all";
  updateNavActive(null);
  panelTitle.textContent = state.currentTag ? `#${state.currentTag}` : "모든 노트";
  renderTags();
  renderNotebooks();
  loadNotes();
}

function updateNavActive(view) {
  document.querySelectorAll(".nav-item").forEach(el => {
    el.classList.toggle("active", el.dataset.view === view);
  });
}

async function createNote() {
  const notebook_id = state.currentNotebook || (state.notebooks[0]?.id ?? null);
  const note = await api.post("/api/notes", { title: "제목 없음", notebook_id });
  state.notes.unshift(note);
  renderNoteList();
  selectNote(note);
}

async function deleteNote() {
  if (!state.currentNote) return;
  if (!confirm("이 노트를 삭제하시겠습니까?")) return;
  await api.del(`/api/notes/${state.currentNote.id}`);
  state.notes = state.notes.filter(n => n.id !== state.currentNote.id);
  state.currentNote = null;
  editorEmpty.classList.remove("hidden");
  editorContent.classList.add("hidden");
  renderNoteList();
  loadAll();
}

async function saveNote(fields) {
  if (!state.currentNote) return;
  saveStatus.textContent = "저장 중...";
  saveStatus.className = "saving";
  const updated = await api.put(`/api/notes/${state.currentNote.id}`, fields);
  state.currentNote = updated;
  state.notes = state.notes.map(n => n.id === updated.id ? updated : n);
  noteDate.textContent = "마지막 수정: " + formatDate(updated.updated_at);
  saveStatus.textContent = "저장됨";
  saveStatus.className = "";
  renderNoteList();
  setTimeout(() => { if (saveStatus.textContent === "저장됨") saveStatus.textContent = ""; }, 2000);
}

function scheduleSave() {
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => {
    saveNote({
      title: noteTitle.value.trim() || "제목 없음",
      content: noteBody.innerHTML,
      tags: JSON.stringify(state.noteTags),
    });
  }, 800);
}

function addTag(tag) {
  tag = tag.trim().replace(/^#/, "");
  if (!tag || state.noteTags.includes(tag)) return;
  state.noteTags.push(tag);
  renderEditorTags();
  scheduleSave();
  loadTags();
}

function removeTag(tag) {
  state.noteTags = state.noteTags.filter(t => t !== tag);
  renderEditorTags();
  scheduleSave();
}

async function loadTags() {
  state.tags = await api.get("/api/tags");
  renderTags();
}

// Notebooks
async function addNotebook(name) {
  const nb = await api.post("/api/notebooks", { name });
  state.notebooks.push(nb);
  renderNotebooks();
  refreshNotebookSelect(state.currentNote?.notebook_id);
}

async function renameNotebook(id, name) {
  const updated = await api.put(`/api/notebooks/${id}`, { name });
  state.notebooks = state.notebooks.map(n => n.id === id ? { ...n, ...updated } : n);
  renderNotebooks();
  refreshNotebookSelect(state.currentNote?.notebook_id);
}

async function deleteNotebook(id) {
  await api.del(`/api/notebooks/${id}`);
  state.notebooks = state.notebooks.filter(n => n.id !== id);
  if (state.currentNotebook === id) { state.currentNotebook = null; panelTitle.textContent = "모든 노트"; }
  renderNotebooks();
  loadNotes();
}

// ── Modal ──
let modalCallback = null;
function openModal(title, defaultVal = "", cb) {
  $("modal-title").textContent = title;
  $("modal-input").value = defaultVal;
  $("modal-overlay").classList.remove("hidden");
  $("modal-input").focus();
  modalCallback = cb;
}
function closeModal() { $("modal-overlay").classList.add("hidden"); modalCallback = null; }

// ── Helpers ──
function esc(str) {
  return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso.endsWith("Z") ? iso : iso + "Z");
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return "방금 전";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
  return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

// ── Event listeners ──
document.querySelectorAll(".nav-item").forEach(el => {
  el.addEventListener("click", () => {
    state.currentView = el.dataset.view;
    state.currentNotebook = null;
    state.currentTag = null;
    updateNavActive(state.currentView);
    panelTitle.textContent = state.currentView === "pinned" ? "즐겨찾기" : "모든 노트";
    renderNotebooks();
    renderTags();
    loadNotes();
  });
});

$("btn-add-notebook").addEventListener("click", () => {
  openModal("노트북 추가", "", name => { if (name) addNotebook(name); });
});

$("btn-new-note").addEventListener("click", createNote);

$("btn-delete-note").addEventListener("click", deleteNote);

btnPin.addEventListener("click", async () => {
  if (!state.currentNote) return;
  const pinned = !state.currentNote.pinned;
  await saveNote({ pinned });
  btnPin.classList.toggle("pinned", pinned);
  btnPin.title = pinned ? "즐겨찾기 해제" : "즐겨찾기";
});

noteTitle.addEventListener("input", scheduleSave);
noteBody.addEventListener("input", scheduleSave);

tagInput.addEventListener("keydown", e => {
  if (e.key === "Enter") { e.preventDefault(); addTag(tagInput.value); tagInput.value = ""; }
  if (e.key === "Backspace" && !tagInput.value && state.noteTags.length) {
    removeTag(state.noteTags[state.noteTags.length - 1]);
  }
});

notebookSelect.addEventListener("change", () => {
  if (!state.currentNote) return;
  const val = notebookSelect.value;
  saveNote({ notebook_id: val ? parseInt(val) : null });
  loadAll();
});

let searchTimer;
$("search-input").addEventListener("input", e => {
  clearTimeout(searchTimer);
  const q = e.target.value.trim();
  searchTimer = setTimeout(async () => {
    const params = new URLSearchParams();
    if (q) params.set("search", q);
    if (state.currentNotebook) params.set("notebook_id", state.currentNotebook);
    state.notes = await api.get("/api/notes?" + params);
    renderNoteList();
  }, 300);
});

// Format toolbar
document.querySelectorAll(".format-buttons [data-cmd]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.execCommand(btn.dataset.cmd, false, null);
    noteBody.focus();
    scheduleSave();
  });
});

headingSelect.addEventListener("change", () => {
  const val = headingSelect.value;
  if (val) document.execCommand("formatBlock", false, val);
  else document.execCommand("formatBlock", false, "p");
  noteBody.focus();
  scheduleSave();
  headingSelect.value = "";
});

// Modal
$("modal-confirm").addEventListener("click", () => {
  const val = $("modal-input").value.trim();
  if (val && modalCallback) modalCallback(val);
  closeModal();
});
$("modal-cancel").addEventListener("click", closeModal);
$("modal-overlay").addEventListener("click", e => { if (e.target === $("modal-overlay")) closeModal(); });
$("modal-input").addEventListener("keydown", e => { if (e.key === "Enter") $("modal-confirm").click(); });

// Keyboard shortcut
document.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key === "n") { e.preventDefault(); createNote(); }
});

// ── Init ──
loadAll();
