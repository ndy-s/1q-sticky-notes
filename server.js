const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const ngrok = require('ngrok');

const PORT = 10101;
const NOTES_FILE = path.join(__dirname,'notes.json');
const HISTORY_FILE = path.join(__dirname,'history.json');

let notesCache = [];
let historyCache = [];

async function ensureFile(file, initial=[]){
    await fs.ensureFile(file);
    const stat = await fs.stat(file);
    if(stat.size===0) await fs.writeJson(file, initial);
}

async function readJSON(file){
    try{ return await fs.readJson(file); } catch(e){ return []; }
}

async function writeJSON(file,data){ await fs.writeJson(file, data, {spaces:2}); }

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
    app.use(express.static(path.join(__dirname,'public')));

    app.get('/api/notes', async (req,res)=> res.json(notesCache));
    app.get('/api/history', async (req,res)=>{
        const limit = parseInt(req.query.limit) || 50;
        res.json(historyCache.slice(-limit));
    });

    async function addHistory(action, note){
        const entry = {
            action,
            noteId: note.id,
            author: note.author,
            text: note.text || '',
            timestamp: new Date().toISOString()
        };
        historyCache.push(entry);
        await writeJSON(HISTORY_FILE, historyCache);
        io.emit('historyUpdated', historyCache.slice(-100));
    }

    io.on('connection', socket=>{
        console.log('Client connected', socket.id);

        socket.on('createNote', async payload=>{
            const note = {
                id: uuidv4(),
                text: payload.text||'',
                author: payload.author||'Anonymous',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                order: notesCache.length
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

            if(payload.text !== undefined && payload.text !== note.text){ note.text = payload.text; changed=true; }
            if(payload.width !== undefined && payload.width !== note.width){ note.width = payload.width; changed=true; }
            if(payload.height !== undefined && payload.height !== note.height){ note.height = payload.height; changed=true; }

            if(!changed) return; // ignore phantom updates

            note.updatedAt = new Date().toISOString();
            notesCache[idx] = note;
            await writeJSON(NOTES_FILE, notesCache);
            io.emit('noteUpdated', note);

            const action = payload.actionType || 'updated';
            await addHistory(action, {...note, author: payload.author||origAuthor});
        });

        socket.on('deleteNote', async payload=>{
            const idx = notesCache.findIndex(n=>n.id===payload.id);
            if(idx===-1) return;
            const note = notesCache[idx];
            notesCache.splice(idx,1);
            await writeJSON(NOTES_FILE, notesCache);
            io.emit('noteDeleted',{id:payload.id});
            await addHistory('deleted',{...note, author: payload.author||'Anonymous'});
        });

        socket.on('disconnect', ()=>console.log('Client disconnected', socket.id));
    });

    server.listen(PORT, async ()=>{
        console.log(`Server running on http://localhost:${PORT}`);
        try {
            const url = await ngrok.connect({addr: PORT, authtoken_from_env: true, region: 'ap'});
            console.log(`Public URL: ${url}`);
        } catch(e){ console.error('Ngrok failed', e); }
    });

})();

