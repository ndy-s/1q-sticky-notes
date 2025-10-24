export function setCookie(name, value, days = 365) {
    const d = new Date();
    d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${encodeURIComponent(value)};path=/;expires=${d.toUTCString()}`;
}

export function getCookie(name) {
    const parts = document.cookie.split('; ').map(s=>s.split('='));
    for (const [k, v] of parts) if (k===name) return decodeURIComponent(v || '');
    return null;
}

export function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"
    })[c]);
}

export function debounce(fn,ms) {
    let t;
    return (...a)=> {
        clearTimeout(t);
        t = setTimeout(() => fn(...a), ms);
    };
}

export function getTruncatedName(name, maxLength = 20) {
    if (name.length <= maxLength) return name;
    const ext = name.includes('.') ? '.' + name.split('.').pop() : '';
    return name.slice(0, maxLength - ext.length - 1) + '…' + ext;
}

export async function askNameIfNeeded(socket) {
    let name = getCookie('memoUser') || '';

    while (true) {
        if (!name) {
            name = prompt('Enter your name (required):')?.trim() || '';
        }

        if (!name) {
            alert('You must enter a name to continue.');
            continue;
        }

        const res = await new Promise(resolve => {
            socket.emit('registerName', name, resolve);
        });

        if (res.success) {
            setCookie('memoUser', name);
            userArea.innerHTML = `Logged in as: <strong>${escapeHtml(name)}</strong>`;
            break;
        }

        alert(res.error);
        setCookie('memoUser', '', -1);
        name = '';
    }

    return name;
}
