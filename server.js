import express from 'express';
import { createServer } from 'http';
import { Server as IOServer } from 'socket.io';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

import { initNotesManager } from './lib/NotesManager.js';
import { initUserManager } from './lib/UserManager.js';
import { setupFileUpload } from './lib/FileManager.js';
import BrowserController from './lib/BrowserController.js';
import ControlQueue from './lib/ControlQueue.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 10101;

const app = express();
const server = createServer(app);
const io = new IOServer(server);
const ioRemote = new IOServer(server, { path: '/socket.io-remote' });

app.use(cookieParser());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, './data/uploads')));
const notesPath = path.join(__dirname, './public/sticky-notes');
app.use(express.static(notesPath));
setupFileUpload(app);

const remotePath = path.join(__dirname, './public/remote-browser');
app.use('/remote', express.static(remotePath));

const notesManager = initNotesManager(io);
const userManager = initUserManager(io);

const browser = new BrowserController(ioRemote);
const queue = new ControlQueue(ioRemote);

app.get('/api/notes', async (req, res)=> {
    res.json(notesManager.getNotes())
});

app.get('/api/history', async (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    res.json(notesManager.getHistory().slice(-limit));
});

io.on('connection', socket => {
    console.log('Sticky notes client connected:', socket.id);

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

    socket.on('disconnect', () => {
        console.log('Sticky notes client disconnected:', socket.id);
        userManager.remove(socket.id);
    });
});

// Remote Browser Socket
ioRemote.on('connection', async socket => {
    const { author } = socket.handshake.query;
    console.log('Remote browser client connected:', socket.id, author);

    const existingSession = queue.clients.find(c => c.author === author);
    if (existingSession) {
        console.log(`Author "${author}" already has an active session. Rejecting new connection.`);
        socket.emit('session-rejected', { reason: 'You already have an active session.' });
        socket.disconnect(true);
        return;
    }

    queue.add(socket.id, author);

    socket.emit('queue-update', {
        queue: queue.list(),
        current: queue.current()?.id
    });

    socket.on('disconnect', () => {
        console.log('Remote browser client disconnected:', socket.id, author);
        queue.remove(socket.id);
    });

    const hasControl = () => queue.current()?.id === socket.id;

    socket.on('control-event', event => {
        if (!hasControl()) return;
        browser.handleInput(event);
    });

    socket.on('navigate', url => {
        if (!hasControl()) return;
        browser.navigate(url);
    });

    socket.on('nav-back', () => {
        if (!hasControl()) return;
        browser.handleButton('back');
    });

    socket.on('nav-forward', () => {
        if (!hasControl()) return;
        browser.handleButton('forward');
    });

    socket.on('nav-refresh', () => {
        if (!hasControl()) return;
        browser.handleButton('refresh');
    });

    socket.on("screen-size", size => {
        browser.setClientRes(size.w, size.h);
    });

    socket.on('release-control', () => {
        queue.next();
    });
});

server.listen(PORT, async () => {
    await browser.launch();
    console.log(`Sticky Notes + Remote Browser running at http://localhost:${PORT}`);
});