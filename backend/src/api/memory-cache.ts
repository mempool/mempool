interface ICache {
  type: string;
  id: string;
  expires: Date;
  data: any;
}

class MemoryCache {
  private cache: ICache[] = [];
  constructor() {
    setInterval(this.cleanup.bind(this), 1000);
  }

  public set(type: string, id: string, data: any, secondsExpiry: number) {
    const expiry = new Date();
    expiry.setSeconds(expiry.getSeconds() + secondsExpiry);
    this.cache.push({
      type: type,
      id: id,
      data: data,
      expires: expiry,
    });
  }

  public get<T>(type: string, id: string): T | null {
    const found = this.cache.find((cache) => cache.type === type && cache.id === id);
    if (found) {
      return found.data;
    }
    return null;
  }

  private cleanup() {
    this.cache = this.cache.filter((cache) => cache.expires > (new Date()));
  }
}

export default new MemoryCache();
