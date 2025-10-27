const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');
const path = require('path');

const { initNotesManager } = require('./lib/notesManager.js');
const { initUserManager } = require('./lib/userManager.js');
const { setupFileUpload } = require('./lib/fileManager.js');

const PORT = 10101;
const SHARED_PW = process.env.SHARED_PW || 'letmein';
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(cookieParser());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname,'uploads')));
app.use(express.static(path.join(__dirname,'public')));

setupFileUpload(app);

const notesManager = initNotesManager(io);
const userManager = initUserManager(io);

app.get('/api/notes', async (req, res)=> {
    res.json(notesManager.getNotes())
});

app.get('/api/history', async (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    res.json(notesManager.getHistory().slice(-limit));
});

io.on('connection', socket => {
    console.log('Client connected', socket.id);

    socket.on('registerName', async (name, callback) => {
        const result = await userManager.register(socket.id, name);
        callback(result);
    });

    socket.on('createNote', async payload => {
        const note = await notesManager.createNote(payload);
        io.emit('noteCreated', note);
    });

    socket.on('updateNote', async payload => {
        const note = await notesManager.updateNote(payload);
        if(note) io.emit('noteUpdated', note);
    });

    socket.on('deleteNote', async payload => {
        const note = await notesManager.deleteNote(payload);
        if(note) io.emit('noteDeleted', { id: payload.id });
    });

    socket.on('openRemoteBrowser', url => {
        console.log(url);
    });

    socket.on('disconnect', () => {
        userManager.remove(socket.id);
    });
});

server.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));