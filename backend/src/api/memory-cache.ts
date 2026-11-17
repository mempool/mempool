interface ICache {
  type: string;
  id: string;
  expires: Date;
  data: any;
}

class MemoryCache {
  private cache: Record<string, ICache> = {};
  constructor() {
    setInterval(this.cleanup.bind(this), 1000);
  }

  public set(type: string, id: string, data: any, secondsExpiry: number): void {
    const expiry = new Date();
    expiry.setSeconds(expiry.getSeconds() + secondsExpiry);
    this.cache[this.getCacheKey(type, id)] = {
      type: type,
      id: id,
      data: data,
      expires: expiry,
    };
  }

  public get<T>(type: string, id: string): T | null {
    const found = this.cache[this.getCacheKey(type, id)];
    if (found) {
      return found.data;
    }
    return null;
  }

  private cleanup(): void {
    const keys = Object.keys(this.cache);
    for (const key of keys) {
      if (this.cache[key].expires <= (new Date())) {
        delete this.cache[key];
      }
    }
  }

  private getCacheKey(type: string, id: string): string {
    return `${type}:${id}`;
  }
}

export default new MemoryCache();
