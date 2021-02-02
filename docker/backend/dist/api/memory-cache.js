"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class MemoryCache {
    constructor() {
        this.cache = [];
        setInterval(this.cleanup.bind(this), 1000);
    }
    set(type, id, data, secondsExpiry) {
        const expiry = new Date();
        expiry.setSeconds(expiry.getSeconds() + secondsExpiry);
        this.cache.push({
            type: type,
            id: id,
            data: data,
            expires: expiry,
        });
    }
    get(type, id) {
        const found = this.cache.find((cache) => cache.type === type && cache.id === id);
        if (found) {
            return found.data;
        }
        return null;
    }
    cleanup() {
        this.cache = this.cache.filter((cache) => cache.expires < (new Date()));
    }
}
exports.default = new MemoryCache();
