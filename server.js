const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');

const PORT = 10101;
const NOTES_FILE = path.join(__dirname,'notes.json');
const HISTORY_FILE = path.join(__dirname,'history.json');
const UPLOADS_DIR = path.join(__dirname,'uploads');

fs.ensureDirSync(UPLOADS_DIR);

let notesCache = [];
let historyCache = [];

const connectedUsers = {};

function broadcastOnlineUsers(io) {
    const users = Object.values(connectedUsers);
    io.emit('onlineUsers', users);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});
const upload = multer({ storage });

async function ensureFile(file, initial=[]) {
    await fs.ensureFile(file);
    const stat = await fs.stat(file);
    if(stat.size===0) await fs.writeJson(file, initial);
}

async function readJSON(file) { 
    try { 
        return await fs.readJson(file); 
    } catch(e) { 
        return []; 
    } 
}

async function writeJSON(file,data) { 
    await fs.writeJson(file, data, {spaces:2}); 
}

(async()=>{
    await ensureFile(NOTES_FILE);
    await ensureFile(HISTORY_FILE);

    notesCache = await readJSON(NOTES_FILE);
    historyCache = await readJSON(HISTORY_FILE);

    const app = express();
    const server = http.createServer(app);
    const io = new Server(server);

    app.use(cookieParser());
    app.use(express.json());
    app.use('/uploads', express.static(UPLOADS_DIR));
    app.use(express.static(path.join(__dirname,'public')));

    // Upload endpoint
    app.post('/upload', upload.single('file'), (req,res)=>{
        if(!req.file) return res.status(400).json({error:'No file uploaded'});
        res.json({
            filename: req.file.filename,
            originalName: req.file.originalname,
            url: `/uploads/${req.file.filename}`
        });
    });

    app.get('/api/notes', async (req,res)=> res.json(notesCache));
    app.get('/api/history', async (req,res)=>{
        const limit = parseInt(req.query.limit) || 50;
        res.json(historyCache.slice(-limit));
    });

    async function addHistory(action, note, extra='', authorOverride=null){
        const entry = {
            action,
            noteId: note.id,
            author: authorOverride || note.author,
            text: note.text || '',
            attachments: note.attachments || [],
            extra,
            timestamp: new Date().toISOString()
        };
        historyCache.push(entry);
        await writeJSON(HISTORY_FILE, historyCache);
        io.emit('historyUpdated', historyCache.slice(-100));
    }

    io.on('connection', socket=>{
        console.log('Client connected', socket.id);

        socket.on('registerName', (name, callback) => {
            name = name.trim();
            if(!name) return callback({ success: false, error: 'Name cannot be empty' });

            const taken = Object.values(connectedUsers)
            .some(u => u.toLowerCase() === name.toLowerCase());
            if(taken) return callback({ success: false, error: 'Name already taken' });

            connectedUsers[socket.id] = name;
            console.log(`User registered: ${name} (${socket.id})`);
            broadcastOnlineUsers(io);
            callback({ success: true });
        });

        socket.on('createNote', async payload=>{
            const note = {
                id: uuidv4(),
                text: payload.text||'',
                author: payload.author||'Anonymous',
                attachments: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                order: notesCache.length,
                creatorId: payload.creatorId
            };
            notesCache.push(note);
            await writeJSON(NOTES_FILE, notesCache);
            io.emit('noteCreated', note);
            await addHistory('created', note);
        });

        socket.on('updateNote', async payload=>{
            const idx = notesCache.findIndex(n=>n.id===payload.id);
            if(idx===-1) return;

            const note = notesCache[idx];
            const origAuthor = note.author;
            let changed = false;
            let actionToLog = null;

            if(payload.text !== undefined && payload.text !== note.text){
                note.text = payload.text;
                changed = true;
                actionToLog = 'updated';
            }
            if(payload.width !== undefined && payload.width !== note.width){
                note.width = payload.width;
                changed = true;
                actionToLog = 'resized';
            }
            if(payload.height !== undefined && payload.height !== note.height){
                note.height = payload.height;
                changed = true;
                actionToLog = 'resized';
            }

            if(payload.attachments !== undefined){
                const removedFiles = note.attachments.filter(old => !payload.attachments.find(n=>n.filename===old.filename));
                removedFiles.forEach(att=>{
                    const filePath = path.join(UPLOADS_DIR, att.filename);
                    fs.unlink(filePath).catch(()=>{});
                    addHistory('file-deleted', note, `Deleted file: ${att.originalName}`, payload.author || 'Anonymous');
                });

                const addedFiles = payload.attachments.filter(newF => !note.attachments.find(old => old.filename===newF.filename));
                addedFiles.forEach(att => addHistory('file-uploaded', note, `Uploaded file: ${att.originalName}`, payload.author || 'Anonymous'));

                note.attachments = payload.attachments;
                changed = true;
                actionToLog = null;
            }

            if(!changed) return;

            note.updatedAt = new Date().toISOString();
            notesCache[idx] = note;
            await writeJSON(NOTES_FILE, notesCache);
            io.emit('noteUpdated', note);

            if(actionToLog) await addHistory(actionToLog, {...note, author: payload.author||origAuthor});
        });

        socket.on('deleteNote', async payload => {
            const idx = notesCache.findIndex(n => n.id === payload.id);
            if(idx === -1) return;
            const note = notesCache[idx];

            (note.attachments || []).forEach(att => {
                const filePath = path.join(UPLOADS_DIR, att.filename);
                fs.unlink(filePath).catch(() => {});
                addHistory('file-deleted', note, `Deleted file: ${att.originalName}`, payload.author || 'Anonymous');
            });

            notesCache.splice(idx, 1);
            await writeJSON(NOTES_FILE, notesCache);
            io.emit('noteDeleted', { id: payload.id });

            await addHistory('deleted', note, '', payload.author || 'Anonymous');
        });

        socket.on('disconnect', () => {
            const name = connectedUsers[socket.id];
            if(name) console.log(`User disconnected: ${name}`);
            delete connectedUsers[socket.id];
            broadcastOnlineUsers(io);
        });
    });

    server.listen(PORT, ()=>{
        console.log(`Server running on http://localhost:${PORT}`);
    });

})();

