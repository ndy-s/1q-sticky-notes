const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');
const path = require('path');

const { initNotesManager } = require('./lib/notesManager.js');
const { initUserManager } = require('./lib/userManager.js');
const { setupFileUpload } = require('./lib/fileManager.js');

const PORT = 10101;
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

app.get('/proxy', async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).send('No URL provided');

    try {
        const response = await fetch(url);
        const html = await response.text();

        // Replace all links to route through /proxy
        const proxiedHtml = html.replace(/href="(.*?)"/g, (match, href) => {
            // Skip anchors
            if (href.startsWith('#')) return match;

            // Make absolute if needed
            let absoluteHref = href;
            if (href.startsWith('/')) {
                const baseUrl = new URL(url);
                absoluteHref = baseUrl.origin + href;
            } else if (!href.startsWith('http')) {
                absoluteHref = new URL(href, url).href;
            }

            return `href="/proxy?url=${encodeURIComponent(absoluteHref)}"`;
        });

        res.send(proxiedHtml);
    } catch (err) {
        res.status(500).send('Failed to fetch URL');
    }
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

    socket.on('disconnect', () => {
        userManager.remove(socket.id);
    });
});

server.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));