import { setCookie, getCookie, escapeHtml, getTruncatedName, askNameIfNeeded, askPasswordIfNeeded } from './utils.js';
import { createNoteElement, renderNotes } from './notes.js';
import { renderHistory } from './history.js';

const socket = io();
const appBody = document.getElementById('app');
const board = document.getElementById('board');
const newNoteBtn = document.getElementById('newNoteBtn');
const openRemoteBtn = document.getElementById('openRemoteBtn');
const userArea = document.getElementById('userArea');
const userListEl = document.getElementById('userList');
const historyList = document.getElementById('historyList');
const rightPanel = document.querySelector('.right-panel');
const toggleBtn = document.getElementById('toggleHistoryBtn');

(async() => {
    await askPasswordIfNeeded();
    appBody.style.display = 'block';

    await askNameIfNeeded(socket);

    const notes = await (await fetch('/api/notes')).json();
    renderNotes(notes, board, socket);

    const history = await (await fetch('/api/history?limit=100')).json();
    renderHistory(history, historyList);
})();

socket.on('onlineUsers', users => {
    userListEl.textContent = users.join(', ') || 'No one';
});

socket.on('noteCreated', note => {
    const el = createNoteElement(note, socket);
    board.appendChild(el);

    if (note.creatorId === socket.id) {
        el.scrollIntoView({
            behavior: 'smooth',
            block:'center'
        });
        el.querySelector('textarea').focus();
    }
});

socket.on('noteUpdated', note => {
    const el = board.querySelector(`.note[data-id="${note.id}"]`);

    if (el) {
        el.querySelector('textarea').value = note.text;

        const attachmentsDiv = el.querySelector('.attachments');
        const noteObj = { ...note };

        function renderAttachmentsForUpdatedNote() {
            attachmentsDiv.innerHTML = '';
            (noteObj.attachments || []).forEach((att, idx) => {
                const div = document.createElement('div');
                div.className = 'attachment-item';
                const a = document.createElement('a');
                a.href = att.url;
                a.target = '_blank';
                a.textContent = getTruncatedName(att.originalName);

                const rm = document.createElement('button');
                rm.textContent = '❌';
                rm.className = 'btn';
                rm.addEventListener('click', async () => {
                    if (!confirm('Remove this file?')) return;

                    const author = await askNameIfNeeded(socket);

                    noteObj.attachments.splice(idx, 1);
                    socket.emit('updateNote', {
                        id: noteObj.id,
                        attachments: noteObj.attachments,
                        author
                    });
                });

                div.appendChild(a);
                div.appendChild(rm);
                attachmentsDiv.appendChild(div);
            });
        }

        renderAttachmentsForUpdatedNote();

        const meta = el.querySelector('.meta');
        const spans = meta.querySelectorAll('span');
        spans[0].textContent = note.author || 'Unknown';
        spans[1].textContent = new Date(note.updatedAt || note.createdAt).toLocaleString();
    } else {
        board.appendChild(createNoteElement(note, socket));
    }
});

socket.on('noteDeleted', payload => {
    const el = board.querySelector(`.note[data-id="${payload.id}"]`);
    if (el) el.remove();
});

socket.on('historyUpdated', history => renderHistory(history, historyList));

newNoteBtn.addEventListener('click', async () => {
    const author = await askNameIfNeeded(socket);

    const newNote = {
        id: crypto.randomUUID(),
        text: '',
        author,
        creatorId: socket.id
    };

    socket.emit('createNote', JSON.parse(JSON.stringify(newNote)))
});

openRemoteBtn.addEventListener('click', async () => {
    const author = await askNameIfNeeded(socket);
    const remoteUrl = `/remote/index.html?author=${encodeURIComponent(author)}`;
    const remoteWin = window.open(remoteUrl, '_blank', 'width=1200,height=800');

    if (!remoteWin) return;

    const idleTimeout = 5 * 60 * 1000; // 5 minutes
    let idleTimer;

    const resetTimer = () => {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
            remoteWin.close();
            console.log("Remote window closed due to inactivity");
        }, idleTimeout);
    };

    const events = ['mousemove', 'keydown', 'scroll', 'click'];
    events.forEach(ev => {
        remoteWin.addEventListener(ev, resetTimer);
    });

    resetTimer();
});


toggleBtn.addEventListener('click', async () => {
    await askNameIfNeeded(socket);

    if (rightPanel.style.display === 'none') {
        rightPanel.style.display = 'block';
        toggleBtn.textContent = 'Hide History';
    } else {
        rightPanel.style.display = 'none';
        toggleBtn.textContent = 'Show History';
    }
});
