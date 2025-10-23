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

    // Textarea
    const textarea = document.createElement('textarea');
    textarea.value = note.text||'';
    textarea.rows = 6;
    textarea.addEventListener('input', debounce(()=>{
        const author = getCookie('memoUser')||'Anonymous';
        socket.emit('updateNote',{id:note.id, text:textarea.value, author});
    },500));

    // Resize observer only fires if user resizes
    let lastWidth = note.width ?? el.offsetWidth;
    let lastHeight = note.height ?? el.offsetHeight;
    let userResized = false;

    el.addEventListener('mousedown', e=>{
        if(e.target===textarea) return; // ignore typing
        userResized = true;
    });

    const resizeObserver = new ResizeObserver(debounce(()=>{
        const currentWidth = el.offsetWidth;
        const currentHeight = el.offsetHeight;

        if(!userResized) return;
        if(currentWidth===lastWidth && currentHeight===lastHeight) return;

        lastWidth = currentWidth;
        lastHeight = currentHeight;
        const author = getCookie('memoUser')||'Anonymous';
        socket.emit('updateNote',{
            id:note.id,
            width:currentWidth,
            height:currentHeight,
            author,
            actionType:'resized'
        });
    },1000));
    resizeObserver.observe(el);

    // Actions
    const actions = document.createElement('div'); actions.className='actions';
    const delBtn = document.createElement('button'); delBtn.textContent='🗑'; delBtn.className='btn';
    delBtn.addEventListener('click',()=>{
        if(!confirm('Delete this note?')) return;
        const author = getCookie('memoUser')||'Anonymous';
        socket.emit('deleteNote',{id:note.id, author});
    });
    actions.appendChild(delBtn);

    // Meta
    const meta = document.createElement('div'); meta.className='meta';
    const shortId = note.id.slice(0,8)+'…';
    const idEl = document.createElement('code'); idEl.textContent=shortId; idEl.title=note.id;
    idEl.style.cursor='pointer';
    idEl.addEventListener('click',()=>{navigator.clipboard.writeText(note.id); alert('Note ID copied: '+note.id);});
    meta.innerHTML = `<span>${escapeHtml(note.author||'Anonymous')}</span>
                      <span>${new Date(note.updatedAt||note.createdAt).toLocaleString()}</span>`;
    meta.prepend(idEl);

    el.appendChild(actions); el.appendChild(textarea); el.appendChild(meta);
    return el;
}

function renderNotes(notes){
    board.innerHTML='';
    notes.sort((a,b)=>(a.order||0)-(b.order||0)).forEach(n=>board.appendChild(createNoteElement(n)));
}

function renderHistory(history){
    historyList.innerHTML='';
    history.slice().reverse().forEach(item=>{
        let color='#000';
        if(item.action==='created') color='green';
        else if(item.action==='updated') color='orange';
        else if(item.action==='deleted') color='red';
        else if(item.action==='resized') color='blue';
        const li = document.createElement('li');
        li.innerHTML=`<strong style="color:${color}">${escapeHtml(item.author)}</strong> ${item.action} note (${item.noteId})<br>
                      <em>${escapeHtml(item.text)}</em><br>
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
    el.scrollIntoView({behavior:'smooth', block:'center'});
    el.querySelector('textarea').focus();
});
socket.on('noteUpdated', note => {
    const el = board.querySelector(`.note[data-id="${note.id}"]`);
    if (el) {
        const textarea = el.querySelector('textarea');
        textarea.value = note.text;

        const meta = el.querySelector('.meta');

        // Update author and timestamp only, keep the code element
        const codeEl = meta.querySelector('code');
        if (codeEl) codeEl.title = note.id; // just in case

        const infoSpans = meta.querySelectorAll('span');
        if (infoSpans.length >= 2) {
            infoSpans[0].textContent = note.author || 'Anonymous';
            infoSpans[1].textContent = new Date(note.updatedAt || note.createdAt).toLocaleString();
        }
    } else {
        board.appendChild(createNoteElement(note));
    }
});
socket.on('noteDeleted', payload=>{ const el=board.querySelector(`.note[data-id="${payload.id}"]`); if(el) el.remove(); });
socket.on('historyUpdated', history=>renderHistory(history));

// New note
newNoteBtn.addEventListener('click',()=>{
    const author=getCookie('memoUser')||'Anonymous';
    socket.emit('createNote',{text:'',author});
});

// Toggle history
const toggleBtn = document.getElementById('toggleHistoryBtn');
const rightPanel = document.querySelector('.right-panel');
toggleBtn.addEventListener('click', ()=>{
    if(rightPanel.style.display==='none'){ rightPanel.style.display='block'; toggleBtn.textContent='Hide History'; }
    else { rightPanel.style.display='none'; toggleBtn.textContent='Show History'; }
});

