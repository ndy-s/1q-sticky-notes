export default class ControlQueue {
    constructor(io) {
        this.io = io;
        this.clients = [];
        this.index = 0;
    }

    add(clientId, author = 'Anonymous') {
        if (!this.clients.find(c => c.id === clientId)) {
            this.clients.push({ id: clientId, author });
            this.emit();
        }
    }

    remove(clientId) {
        const i = this.clients.findIndex(c => c.id === clientId);
        if (i >= 0) {
            this.clients.splice(i, 1);
            if (this.index >= this.clients.length) this.index = 0;
            this.emit();
        }
    }

    current() {
        return this.clients[this.index] || null;
    }

    next() {
        if (this.clients.length === 0) return;
        this.index = (this.index + 1) % this.clients.length;
        this.emit();
    }

    list() {
        return this.clients.map(c => ({ id: c.id, author: c.author }));
    }

    emit() {
        const currentClient = this.current()?.id;
        for (const client of this.clients) {
            this.io.to(client.id).emit('queue-update', {
                queue: this.list(),
                current: currentClient
            });
        }
    }
}

