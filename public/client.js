const socket = io();
const board = document.getElementById('board');
const newNoteBtn = document.getElementById('newNoteBtn');
const userArea = document.getElementById('userArea');
const historyList = document.getElementById('historyList');

function setCookie(name, value, days = 365) {
    const d = new Date();
    d.setTime(d.getTime() + days*24*60*60*1000);
    document.cookie = `${name}=${encodeURIComponent(value)};path=/;expires=${d.toUTCString()}`;
}

function getCookie(name) {
    const parts = document.cookie.split('; ').map(s=>s.split('='));
    for(const [k,v] of parts) if(k===name) return decodeURIComponent(v||'');
    return null;
}

async function askNameIfNeeded() {
    let name = getCookie('memoUser');
    if(!name){
        name = prompt('Enter your name:')||'Anonymous';
        setCookie('memoUser', name);
    }
    userArea.innerHTML = `Logged in as: <strong>${name}</strong>`;
    return name;
}

function createNoteElement(note) {
    const el = document.createElement('div');
    el.className = 'note';
    el.dataset.id = note.id;

    if(note.width) el.style.width = note.width+'px';
    if(note.height) el.style.height = note.height+'px';

    const textarea = document.createElement('textarea');
    textarea.value = note.text||'';
    textarea.rows = 6;

    textarea.addEventListener('input', debounce(()=>{
        const author = getCookie('memoUser')||'Anonymous';
        socket.emit('updateNote',{id:note.id,text:textarea.value,author});
    },500));

    const resizeObserver = new ResizeObserver(debounce(()=>{
        const author = getCookie('memoUser') || 'Anonymous';
        socket.emit('updateNote',{
            id: note.id,
            width: el.offsetWidth,
            height: el.offsetHeight,
            author,
            actionType: 'resized'
        });
    }, 1000));
    resizeObserver.observe(el);

    resizeObserver.observe(el);

    const actions = document.createElement('div');
    actions.className='actions';
    const delBtn = document.createElement('button');
    delBtn.textContent='🗑';
    delBtn.className='btn';
    delBtn.addEventListener('click',()=>{
        if(!confirm('Delete this note?')) return;
        socket.emit('deleteNote',{id:note.id});
    });
    actions.appendChild(delBtn);

    const meta = document.createElement('div');
    meta.className='meta';
    meta.innerHTML=`<span>${escapeHtml(note.author||'Anonymous')}</span><span>${new Date(note.updatedAt||note.createdAt).toLocaleString()}</span>`;

    el.appendChild(actions);
    el.appendChild(textarea);
    el.appendChild(meta);

    return el;
}

function renderNotes(notes){
    board.innerHTML='';
    notes.forEach(n=>board.appendChild(createNoteElement(n)));
}

function renderHistory(history){
    historyList.innerHTML='';
    history.slice().reverse().forEach(item=>{
        const li = document.createElement('li');
        let color='#000';
        if(item.action==='created') color='green';
        else if(item.action==='updated') color='orange';
        else if(item.action==='deleted') color='red';
        else if(item.action==='resized') color='blue';

        li.innerHTML=`
      <strong style="color:${color}">${escapeHtml(item.author)}</strong> ${item.action} note (${item.noteId})<br>
      <em>${escapeHtml(item.text)}</em><br>
      <small>${new Date(item.timestamp).toLocaleString()}</small>
    `;
        historyList.appendChild(li);
    });
}

(async()=>{
    await askNameIfNeeded();
    const notes=await (await fetch('/api/notes')).json();
    const history = await (await fetch('/api/history?limit=100')).json();
    renderNotes(notes);
    renderHistory(history);
})();

socket.on('noteCreated', note=>board.appendChild(createNoteElement(note)));

socket.on('noteUpdated', note=>{
    const existing=board.querySelector(`.note[data-id="${note.id}"]`);
    if(existing){
        existing.querySelector('textarea').value=note.text;
        existing.querySelector('.meta').innerHTML=`<span>${escapeHtml(note.author||'Anonymous')}</span><span>${new Date(note.updatedAt||note.createdAt).toLocaleString()}</span>`;
    } else board.appendChild(createNoteElement(note));
});

socket.on('noteDeleted', payload=>{
    const el=board.querySelector(`.note[data-id="${payload.id}"]`);
    if(el) el.remove();
});

socket.on('historyUpdated', history=>renderHistory(history));

newNoteBtn.addEventListener('click',()=>{
    const author=getCookie('memoUser')||'Anonymous';
    socket.emit('createNote',{text:'',author});
});

function debounce(fn,ms){let t;return (...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);};}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[c]);}

