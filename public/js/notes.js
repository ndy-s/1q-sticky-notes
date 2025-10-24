import { getCookie, escapeHtml, debounce, getTruncatedName, askNameIfNeeded } from './utils.js';

export const userColors = {};
export const availableColors = [
    '#FFD700', '#ADFF2F', '#FF69B4', '#87CEFA', '#FFA07A',
    '#DA70D6', '#40E0D0', '#FF8C00', '#8FBC8F', '#FF6347'
];

export function getUserColor(user) {
    if (!userColors[user]) {
        userColors[user] = availableColors.shift() || '#' + Math.floor(Math.random() * 16777215).toString(16);
    }

    return userColors[user];
}

export function createNoteElement(note, socket){
    const el = document.createElement('div');
    el.className = 'note';
    el.dataset.id = note.id;
    if (note.width) el.style.width = note.width + 'px';
    if (note.height) el.style.height = note.height + 'px';

    // Resize observer
    let lastWidth = el.offsetWidth;
    let lastHeight = el.offsetHeight;
    let ignoreFirst = true;

    const saveResize = debounce(async (id, width, height) => {
        const author = await askNameIfNeeded(socket);
        socket.emit('updateNote', {
            id,
            width: Math.round(width),
            height: Math.round(height),
            author,
            creatorId: socket.id,
        });
        lastWidth = width;
        lastHeight = height;
    }, 700);

    new ResizeObserver(entries => {
        for (let entry of entries) {
            const { width, height } = entry.contentRect;

            if (ignoreFirst) {
                ignoreFirst = false;
                lastWidth = width;
                lastHeight = height;
                return;
            }

            if (width !== lastWidth || height !== lastHeight) {
                saveResize(note.id, width, height);
            }
        }
    }).observe(el);

    // Textarea
    const textarea = document.createElement('textarea');
    textarea.value = note.text || '';
    textarea.rows = 6;
    textarea.addEventListener('input', debounce(async () => {
        const author = await askNameIfNeeded(socket);
        socket.emit('updateNote', {
            id: note.id,
            text: textarea.value,
            author,
            creatorId: socket.id,
        });
    }, 500));

    // Attachments
    const attachmentsDiv = document.createElement('div');
    attachmentsDiv.className = 'attachments';

    function renderAttachments(){
        attachmentsDiv.innerHTML = '';
        (note.attachments || []).forEach((att, idx) => {
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
                note.attachments.splice(idx, 1);

                const author = await askNameIfNeeded(socket);
                socket.emit('updateNote', {
                    id: note.id,
                    attachments: note.attachments,
                    author,
                    creatorId: socket.id,
                });
            });

            div.appendChild(a);
            div.appendChild(rm);
            attachmentsDiv.appendChild(div);
        });
    }
    renderAttachments();

    // File upload
    const fileLabel = document.createElement('label');
    fileLabel.style.cursor = 'pointer';
    fileLabel.style.display = 'inline-block';
    fileLabel.style.marginTop = '6px';
    fileLabel.title = 'Attach file';
    fileLabel.innerHTML = '📎';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.style.display = 'none';
    fileLabel.appendChild(fileInput);

    fileInput.addEventListener('change', async e => {
        const file = e.target.files[0];
        if (!file) return;

        note.attachments = note.attachments || [];
        if (note.attachments.length >= 1) {
            alert('You can only attach 1 file per note.');
            fileInput.value = '';
            return;
        }

        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.error) {
            alert('Upload failed');
            return;
        }

        note.attachments.push(data);

        renderAttachments();

        const author = await askNameIfNeeded(socket);
        socket.emit('updateNote', {
            id: note.id,
            attachments: note.attachments,
            author,
            creatorId: socket.id,
        });
    });

    // Actions
    const actions = document.createElement('div');
    actions.className='actions';

    const copyBtn = document.createElement('button');
    copyBtn.textContent = '📋';
    copyBtn.className = 'btn btn-copy';
    copyBtn.title = 'Copy text';
    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(textarea.value)
            .then(() => alert('Copied: ' + textarea.value))
            .catch(() => alert('Failed to copy'));
    });
    actions.appendChild(copyBtn);

    const delBtn = document.createElement('button');
    delBtn.textContent = '🗑';
    delBtn.className = 'btn btn-delete';
    delBtn.title = 'Delete note';
    delBtn.addEventListener('click', async () => {
        if (!confirm('Delete this note?')) return;

        const author = await askNameIfNeeded(socket);
        socket.emit('deleteNote', {
            id: note.id,
            author,
            creatorId: socket.id,
        });
    });
    actions.appendChild(delBtn);

    // Meta
    const meta = document.createElement('div');
    meta.className='meta';
    const shortId = note.id.slice(0,8)+'…';
    const idEl = document.createElement('code');
    idEl.textContent=shortId;
    idEl.title=note.id;
    idEl.style.cursor='pointer';
    idEl.addEventListener('click',() => {
        navigator.clipboard.writeText(note.id);
        alert('Note ID copied: ' + note.id);
    });
    meta.innerHTML = `<span>${escapeHtml(note.author||'Anonymous')}</span>
                      <span>${new Date(note.updatedAt||note.createdAt).toLocaleString()}</span>`;
    meta.prepend(idEl);

    // Append all
    el.appendChild(textarea);
    el.appendChild(fileLabel);
    el.appendChild(attachmentsDiv);
    el.appendChild(actions);
    el.appendChild(meta);
    return el;
}

export function renderNotes(notes, board, socket){
    board.innerHTML = '';
    notes.sort((a,b) => (a.order || 0) - (b.order || 0)).forEach(n => {
        board.appendChild(createNoteElement(n, socket))
    });
}

