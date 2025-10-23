const socket = io();
const board = document.getElementById('board');
const newNoteBtn = document.getElementById('newNoteBtn');
const userArea = document.getElementById('userArea');
const historyList = document.getElementById('historyList');

function setCookie(name, value, days=365){
    const d = new Date();
    d.setTime(d.getTime()+days*24*60*60*1000);
    document.cookie = `${name}=${encodeURIComponent(value)};path=/;expires=${d.toUTCString()}`;
}

function getCookie(name){
    const parts = document.cookie.split('; ').map(s=>s.split('='));
    for(const [k,v] of parts) if(k===name) return decodeURIComponent(v||'');
    return null;
}

async function askNameIfNeeded(){
    let name = getCookie('memoUser');
    if(!name){
        name = prompt('Enter your name:')||'Anonymous';
        setCookie('memoUser', name);
    }
    userArea.innerHTML = `Logged in as: <strong>${name}</strong>`;
    return name;
}

function escapeHtml(s){
    return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[c]);
}

function debounce(fn,ms){
    let t;
    return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); };
}

function createNoteElement(note){
    const el = document.createElement('div');
    el.className='note';
    el.dataset.id = note.id;
    if(note.width) el.style.width = note.width+'px';
    if(note.height) el.style.height = note.height+'px';

    // --- Textarea ---
    const textarea = document.createElement('textarea');
    textarea.value = note.text || '';
    textarea.rows = 6;
    textarea.addEventListener('input', debounce(()=>{
        const author = getCookie('memoUser')||'Anonymous';
        socket.emit('updateNote',{id:note.id, text:textarea.value, author});
    }, 500));

    // --- Attachments container ---
    const attachmentsDiv = document.createElement('div');
    attachmentsDiv.className='attachments';

    function renderAttachments(){
        attachmentsDiv.innerHTML = '';
        (note.attachments || []).forEach((att, idx) => {
            const div = document.createElement('div');
            div.className = 'attachment-item';
            const a = document.createElement('a');
            a.href = att.url;
            a.textContent = att.originalName;
            a.target = '_blank';
            const rm = document.createElement('button');
            rm.textContent = '❌';
            rm.className = 'btn';
            rm.addEventListener('click', () => {
                if(!confirm('Remove this file?')) return;
                note.attachments.splice(idx, 1);
                const author = getCookie('memoUser') || 'Anonymous';
                socket.emit('updateNote', { id: note.id, attachments: note.attachments, author });
            });
            div.appendChild(a);
            div.appendChild(rm);
            attachmentsDiv.appendChild(div);
        });
    }
    renderAttachments();

    // --- File upload using label & icon ---
    const fileLabel = document.createElement('label');
    fileLabel.style.cursor = 'pointer';
    fileLabel.style.display = 'inline-block';
    fileLabel.style.marginTop = '6px';
    fileLabel.title = 'Attach file';
    fileLabel.innerHTML = '📎'; // small paperclip icon

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.style.display = 'none'; // hide actual input
    fileLabel.appendChild(fileInput);

    fileInput.addEventListener('change', async e => {
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.error) { alert('Upload failed'); return; }
        note.attachments = note.attachments || [];
        note.attachments.push(data);
        const author = getCookie('memoUser') || 'Anonymous';
        socket.emit('updateNote', { id: note.id, attachments: note.attachments, author });
    });

    // --- Actions ---
    const actions = document.createElement('div');
    actions.className='actions';
    const delBtn = document.createElement('button');
    delBtn.textContent='🗑';
    delBtn.className='btn';
    delBtn.addEventListener('click', ()=>{
        if(!confirm('Delete this note?')) return;
        const author = getCookie('memoUser')||'Anonymous';
        socket.emit('deleteNote',{id:note.id, author});
    });
    actions.appendChild(delBtn);

    // --- Meta ---
    const meta = document.createElement('div');
    meta.className='meta';
    const shortId = note.id.slice(0,8)+'…';
    const idEl = document.createElement('code');
    idEl.textContent=shortId;
    idEl.title=note.id;
    idEl.style.cursor='pointer';
    idEl.addEventListener('click',()=>{navigator.clipboard.writeText(note.id); alert('Note ID copied: '+note.id);});
    meta.innerHTML = `<span>${escapeHtml(note.author||'Anonymous')}</span>
                      <span>${new Date(note.updatedAt||note.createdAt).toLocaleString()}</span>`;
    meta.prepend(idEl);

    // --- Append all ---
    el.appendChild(textarea);
    el.appendChild(fileLabel);       // clickable icon
    el.appendChild(attachmentsDiv);
    el.appendChild(actions);
    el.appendChild(meta);

    return el;
}

function renderNotes(notes){
    board.innerHTML='';
    notes.sort((a,b)=>(a.order||0)-(b.order||0)).forEach(n=>board.appendChild(createNoteElement(n)));
}

const userColors = {}; // store assigned colors
const availableColors = [
    '#FFD700', '#ADFF2F', '#FF69B4', '#87CEFA', '#FFA07A',
    '#DA70D6', '#40E0D0', '#FF8C00', '#8FBC8F', '#FF6347'
];

function getUserColor(user) {
    if (!userColors[user]) {
        // Assign a random available color
        const color = availableColors.shift() || '#' + Math.floor(Math.random()*16777215).toString(16);
        userColors[user] = color;
    }
    return userColors[user];
}

function renderHistory(history){
    historyList.innerHTML='';
    history.slice().reverse().forEach(item=>{
        const userColor = getUserColor(item.author);

        const li = document.createElement('li');
        li.style.backgroundColor = userColor + '33'; // transparent background
        li.style.padding = '4px';
        li.style.marginBottom = '2px';
        li.style.borderLeft = `5px solid ${userColor}`; // colored bar

        li.innerHTML=`<strong>${escapeHtml(item.author)}</strong> ${item.action} note (${item.noteId})<br>
                      ${item.extra ? `<em>${escapeHtml(item.extra)}</em><br>` : ''}
                      ${item.text ? `<em>Text: ${escapeHtml(item.text)}</em><br>` : ''}
                      <small>${new Date(item.timestamp).toLocaleString()}</small>`;
        historyList.appendChild(li);
    });
}

// Initial load
(async()=>{
    await askNameIfNeeded();
    const notes = await (await fetch('/api/notes')).json();
    const history = await (await fetch('/api/history?limit=100')).json();
    renderNotes(notes); renderHistory(history);
})();

// Socket events
socket.on('noteCreated', note => {
    const el = createNoteElement(note);
    board.appendChild(el);

    if(note.creatorId === socket.id){
        el.scrollIntoView({behavior:'smooth', block:'center'});
        el.querySelector('textarea').focus();
    }
});

socket.on('noteUpdated', note=>{
    const el = board.querySelector(`.note[data-id="${note.id}"]`);
    if(el){
        el.querySelector('textarea').value = note.text;
        const attachmentsDiv = el.querySelector('.attachments');
        attachmentsDiv.innerHTML='';
        (note.attachments||[]).forEach((att,idx)=>{
            const div = document.createElement('div');
            div.className='attachment-item';
            const a = document.createElement('a'); a.href=att.url; a.textContent=att.originalName; a.target='_blank';
            const rm = document.createElement('button'); rm.textContent='❌';
            rm.addEventListener('click', ()=>{
                note.attachments.splice(idx,1);
                const author = getCookie('memoUser')||'Anonymous';
                socket.emit('updateNote',{id:note.id, attachments: note.attachments, author});
            });
            div.appendChild(a); div.appendChild(rm); attachmentsDiv.appendChild(div);
        });
        const meta = el.querySelector('.meta');
        const spans = meta.querySelectorAll('span');
        spans[0].textContent = note.author||'Anonymous';
        spans[1].textContent = new Date(note.updatedAt||note.createdAt).toLocaleString();
    } else board.appendChild(createNoteElement(note));
});
socket.on('noteDeleted', payload=>{ const el=board.querySelector(`.note[data-id="${payload.id}"]`); if(el) el.remove(); });
socket.on('historyUpdated', history=>renderHistory(history));

// New note
newNoteBtn.addEventListener('click', async ()=>{
    const author = getCookie('memoUser')||'Anonymous';
    socket.emit('createNote', { text: '', author, creatorId: socket.id });
});

// Toggle history
const toggleBtn = document.getElementById('toggleHistoryBtn');
const rightPanel = document.querySelector('.right-panel');
toggleBtn.addEventListener('click', ()=>{
    if(rightPanel.style.display==='none'){ rightPanel.style.display='block'; toggleBtn.textContent='Hide History'; }
    else { rightPanel.style.display='none'; toggleBtn.textContent='Show History'; }
});

