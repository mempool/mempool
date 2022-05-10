import { ILoadingIndicators } from '../mempool.interfaces';

class LoadingIndicators {
  private loadingIndicators: ILoadingIndicators = {
    'mempool': 0,
  };
  private progressChangedCallback: ((loadingIndicators: ILoadingIndicators) => void) | undefined;

  constructor() { }

  public setProgressChangedCallback(fn: (loadingIndicators: ILoadingIndicators) => void) {
    this.progressChangedCallback = fn;
  }

  public setProgress(name: string, progressPercent: number, rounded: boolean = true) {
    const newProgress = rounded === true ? Math.round(progressPercent) : progressPercent;
    if (newProgress >= 100) {
      delete this.loadingIndicators[name];
    } else {
      this.loadingIndicators[name] = newProgress;
    }
    if (this.progressChangedCallback) {
      this.progressChangedCallback(this.loadingIndicators);
    }
  }

  public getLoadingIndicators() {
    return this.loadingIndicators;
  }
}

export default new LoadingIndicators();
