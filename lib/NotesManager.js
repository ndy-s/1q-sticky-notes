import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NOTES_FILE = path.join(__dirname, '../data/notes.json');
const HISTORY_FILE = path.join(__dirname, '../data/history.json');
const UPLOADS_DIR = path.join(__dirname, '../data/uploads');

let notesCache = [];
let historyCache = [];

async function ensureFile(file, initial = []) {
    await fs.ensureFile(file);
    if ((await fs.stat(file)).size === 0) await fs.writeJson(file, initial);
}

async function loadData() {
    await ensureFile(NOTES_FILE);
    await ensureFile(HISTORY_FILE);
    notesCache = await fs.readJson(NOTES_FILE);
    historyCache = await fs.readJson(HISTORY_FILE);
}

async function saveNotes() {
    await fs.writeJson(NOTES_FILE, notesCache, { spaces: 2 });
}

async function saveHistory() {
    await fs.writeJson(HISTORY_FILE, historyCache, { spaces: 2 });
}

async function addHistory(action, note, extra = '', io = null) {
    const entry = {
        action,
        noteId: note.id,
        author: note.author,
        text: note.text || '',
        attachments: note.attachments || [],
        extra,
        timestamp: new Date().toISOString()
    };
    historyCache.push(entry);
    await saveHistory();
    if (io) io.emit('historyUpdated', historyCache.slice(-100));
}

export function initNotesManager(io) {
    loadData();

    return {
        createNote: async (payload) => {
            const note = {
                id: uuidv4(),
                text: payload.text || '',
                author: payload.author,
                attachments: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                order: notesCache.length,
                creatorId: payload.creatorId
            };
            notesCache.push(note);
            await saveNotes();
            await addHistory('created', note, '', io);
            return note;
        },

        updateNote: async (payload) => {
            const idx = notesCache.findIndex(n => n.id === payload.id);
            if (idx === -1) return null;

            const note = notesCache[idx];
            const author = payload.author;

            const changes = [];

            if (payload.text !== undefined && payload.text !== note.text) {
                note.text = payload.text;
                changes.push({ type: 'updated', message: 'Note text updated' });
            }

            const widthChanged = payload.width !== undefined && payload.width !== note.width;
            const heightChanged = payload.height !== undefined && payload.height !== note.height;

            if (widthChanged || heightChanged) {
                if (widthChanged) note.width = payload.width;
                if (heightChanged) note.height = payload.height;
                changes.push({ type: 'resized', message: 'Note resized' });
            }

            if (payload.attachments !== undefined) {
                const removedFiles = note.attachments.filter(old =>
                    !payload.attachments.some(n => n.filename === old.filename)
                );

                removedFiles.forEach(att => {
                    const filePath = path.join(UPLOADS_DIR, att.filename);
                    fs.unlink(filePath).catch(() => {});
                    changes.push({ type: 'file-deleted', message: `Deleted file: ${att.originalName}` });
                });

                const addedFiles = payload.attachments.filter(newF =>
                    !note.attachments.some(old => old.filename === newF.filename)
                );

                addedFiles.forEach(att => {
                    changes.push({ type: 'file-uploaded', message: `Uploaded file: ${att.originalName}` });
                });

                if (removedFiles.length || addedFiles.length) {
                    note.attachments = payload.attachments;
                }
            }

            if (changes.length === 0) return null;

            note.updatedAt = new Date().toISOString();
            notesCache[idx] = note;
            await saveNotes();

            for (const change of changes) {
                await addHistory(change.type, { ...note, author }, change.message, io);
            }

            return note;
        },

        deleteNote: async (payload) => {
            const idx = notesCache.findIndex(n => n.id === payload.id);
            if (idx === -1) return null;

            const note = { ...notesCache[idx] };

            if (payload.author) {
                note.author = payload.author;
            }

            (note.attachments || []).forEach(att => {
                const filePath = path.join(UPLOADS_DIR, att.filename);
                fs.unlink(filePath).catch(() => {});
                addHistory('file-deleted', note, `Deleted file: ${att.originalName}`, io);
            });

            notesCache.splice(idx, 1);
            await saveNotes();

            await addHistory('deleted', note, '', io);

            return note;
        },

        getNotes: () => notesCache,
        getHistory: (limit = 50) => historyCache.slice(-limit),
    };
}

