"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const os = require("os");
const logger_1 = require("../logger");
class BackendInfo {
    constructor() {
        this.gitCommitHash = '';
        this.hostname = '';
        this.setLatestCommitHash();
        this.hostname = os.hostname();
    }
    getBackendInfo() {
        return {
            'hostname': this.hostname,
            'git-commit': this.gitCommitHash,
        };
    }
    getShortCommitHash() {
        return this.gitCommitHash.slice(0, 7);
    }
    setLatestCommitHash() {
        try {
            this.gitCommitHash = fs.readFileSync('../.git/refs/heads/master').toString().trim();
        }
        catch (e) {
            logger_1.default.err('Could not load git commit info: ' + e.message || e);
        }
    }
}
exports.default = new BackendInfo();
