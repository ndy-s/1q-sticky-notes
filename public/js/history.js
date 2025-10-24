import { escapeHtml } from "./utils.js";
import { getUserColor } from "./notes.js";

export function renderHistory(history, historyList){
    historyList.innerHTML = '';
    history.slice().reverse().forEach(item => {
        const userColor = getUserColor(item.author);

        const li = document.createElement('li');
        li.style.borderLeft = `6px solid ${userColor}`;
        li.style.backgroundColor = userColor + '15';

        li.innerHTML = `
            <div><strong>${escapeHtml(item.author)}</strong> ${item.action} note (${item.noteId})</div>
            ${item.extra ? `<div><em>${escapeHtml(item.extra)}</em></div>` : ''}
            ${item.text ? `<div><em>Text: ${escapeHtml(item.text)}</em></div>` : ''}
            <small>${new Date(item.timestamp).toLocaleString()}</small>
        `;

        historyList.appendChild(li);
    });
}
