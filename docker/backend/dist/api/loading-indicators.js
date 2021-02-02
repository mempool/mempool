"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class LoadingIndicators {
    constructor() {
        this.loadingIndicators = {
            'mempool': 0,
        };
    }
    setProgressChangedCallback(fn) {
        this.progressChangedCallback = fn;
    }
    setProgress(name, progressPercent) {
        const newProgress = Math.round(progressPercent);
        if (newProgress >= 100) {
            delete this.loadingIndicators[name];
        }
        else {
            this.loadingIndicators[name] = newProgress;
        }
        if (this.progressChangedCallback) {
            this.progressChangedCallback(this.loadingIndicators);
        }
    }
    getLoadingIndicators() {
        return this.loadingIndicators;
    }
}
exports.default = new LoadingIndicators();
