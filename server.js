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

async function ensureFile(file, initial=[]){
    await fs.ensureFile(file);
    const stat=await fs.stat(file);
    if(stat.size===0) await fs.writeJson(file, initial);
}

async function readJSON(file){
    try{ return await fs.readJson(file);} catch(e){ return [];}
}

async function writeJSON(file,data){
    await fs.writeJson(file, data, {spaces:2});
}

(async()=>{
    await ensureFile(NOTES_FILE);
    await ensureFile(HISTORY_FILE);

    const app = express();
    const server = http.createServer(app);
    const io = new Server(server);

    app.use(cookieParser());
    app.use(express.json());
    app.use(express.static(path.join(__dirname,'public')));

    app.get('/api/notes', async (req,res)=> {
        res.json(await readJSON(NOTES_FILE))
    });

    app.get('/api/history', async (req, res) => {
        const history = await readJSON(HISTORY_FILE);
        const limit = parseInt(req.query.limit) || 50;
        res.json(history.slice(-limit));
    });

    async function addHistory(action,note){
        const history = await readJSON(HISTORY_FILE);
        history.push({
            action,
            noteId: note.id,
            author: note.author,
            text: note.text || '',
            timestamp: new Date().toISOString()
        });
        await writeJSON(HISTORY_FILE, history);
        io.emit('historyUpdated', history);
    }

    io.on('connection', (socket) => {
        console.log('Client connected', socket.id);

        socket.on('createNote', async (payload) => {
            const notes = await readJSON(NOTES_FILE);
            const note = {
                id: uuidv4(),
                text: payload.text || '',
                author: payload.author || 'Anonymous',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            notes.push(note);
            await writeJSON(NOTES_FILE, notes);
            io.emit('noteCreated', note);
            await addHistory('created', note);
        });

        socket.on('updateNote', async (payload) => {
            const notes = await readJSON(NOTES_FILE);
            const idx = notes.findIndex(n => n.id === payload.id);
            if (idx === -1) return;

            // Update note properties
            notes[idx].text = payload.text ?? notes[idx].text;
            notes[idx].updatedAt = new Date().toISOString();
            if (payload.author) notes[idx].author = payload.author;
            if (payload.width) notes[idx].width = payload.width;
            if (payload.height) notes[idx].height = payload.height;

            await writeJSON(NOTES_FILE, notes);
            io.emit('noteUpdated', notes[idx]);

            // Determine history action: resized or updated
            const action = payload.actionType || 'updated';
            await addHistory(action, notes[idx]);
        });

        socket.on('deleteNote', async (payload) => {
            let notes = await readJSON(NOTES_FILE);
            const note = notes.find(n => n.id === payload.id);
            notes = notes.filter(n => n.id !== payload.id);

            await writeJSON(NOTES_FILE, notes);
            io.emit('noteDeleted', { id: payload.id });

            if (note) await addHistory('deleted', note);
        });

        socket.on('disconnect', () => console.log('Client disconnected', socket.id));
    });

    server.listen(PORT, async () => {
        console.log(`Server running on http://localhost:${PORT}`);
        try {
            const url = await ngrok.connect({ addr: PORT, authtoken_from_env: true, region: 'ap' });
            console.log(`Public URL: ${url}`);
        } catch (err) {
            console.error('Ngrok failed', err);
        }
    });

})();


