function getAuthorFromQuery() {
    const params = new URLSearchParams(window.location.search);
    return params.get('author') || 'Anonymous';
}

export const author = getAuthorFromQuery();
export const socket = io({ path: '/socket.io-remote', query: { author } });

export const elements = {
    screen: document.getElementById('screen'),
    wrapper: document.getElementById('screen-wrapper'),
    clipboardInput: document.getElementById('clipboard-input'),
    urlInput: document.getElementById('url'),
    goBtn: document.getElementById('go'),
    backBtn: document.getElementById('btn-back'),
    forwardBtn: document.getElementById('btn-forward'),
    refreshBtn: document.getElementById('btn-refresh'),
    loadingOverlay: document.getElementById('loading-overlay'),
    queueEl: document.getElementById('queue'),
    statusEl: document.getElementById('control-status'),
    bannerEl: document.getElementById('view-only-banner'),
};

export let state = {
    clientWidth: elements.screen.clientWidth,
    clientHeight: elements.screen.clientHeight,
    loading: false,
    mouseDown: false,
    hasControl: false,
    lastScreenUpdate: Date.now(), 
    disconnected: false,
};

export function updateState(updates) {
    state = { ...state, ...updates};
}

export function log(...args) {
  console.log('[ClientJS]', ...args);
}

