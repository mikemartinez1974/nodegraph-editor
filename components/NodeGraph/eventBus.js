// eventBus.js
// Centralized event bus for NodeGraph with safe subscription helpers
import { useEffect, useRef } from 'react';

class EventBus {
    constructor() {
        this.listeners = {};
    }
    on(event, callback) {
        if (!event || typeof callback !== 'function') return () => {};
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
        return () => this.off(event, callback);
    }
    off(event, callback) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
    emit(event, data) {
        if (!this.listeners[event]) return;
        this.listeners[event].forEach(cb => cb(data));
    }
}

const eventBus = new EventBus();

export function useEventBusListener(event, handler, options = {}) {
    const { enabled = true, dependencies = [] } = options;
    const deps = Array.isArray(dependencies) ? dependencies : [dependencies];
    const handlerRef = useRef(handler);

    useEffect(() => {
        handlerRef.current = handler;
    }, [handler]);

    useEffect(() => {
        const hasHandler = typeof handlerRef.current === 'function';
        if (!enabled || !event || !hasHandler) {
            return undefined;
        }

        const listener = (payload) => {
            if (handlerRef.current) {
                handlerRef.current(payload);
            }
        };

        const unsubscribe = eventBus.on(event, listener);
        return () => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            } else {
                eventBus.off(event, listener);
            }
        };
    }, [event, enabled, ...deps]);
}

export default eventBus;
