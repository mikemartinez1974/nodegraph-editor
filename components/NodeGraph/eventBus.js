// eventBus.js
// Centralized event bus for NodeGraph



class EventBus {
    constructor() {
        this.listeners = {};
    }
    on(event, callback) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
    }
    off(event, callback) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
    emit(event, data) {
        //console.log(`[eventBus] emit: ${event}`, data); // Debug log for all emitted events
        if (!this.listeners[event]) return;
        this.listeners[event].forEach(cb => cb(data));
    }
}

const eventBus = new EventBus();

export default eventBus;
