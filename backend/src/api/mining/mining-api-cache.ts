class MiningApiCache {
  private generation = 0;
  private entries = new Map<string, { generation: number, expiresAt: number, value: unknown }>();
  private pending = new Map<string, Promise<unknown>>();

  constructor(private ttlMs: number) { }

  public invalidate(): void {
    this.generation++;
    this.entries.clear();
    this.pending.clear();
  }

  public $get<T>(key: string, $load: () => Promise<T>): Promise<T> {
    const entry = this.entries.get(key);
    if (entry && entry.generation === this.generation && Date.now() < entry.expiresAt) {
      return Promise.resolve(entry.value as T);
    }

    const inFlight = this.pending.get(key);
    if (inFlight) {
      return inFlight as Promise<T>;
    }

    const generation = this.generation;
    const expiresAt = Date.now() + this.ttlMs;
    const promise = $load().then((value) => {
      if (this.generation === generation) {
        this.entries.set(key, { generation, expiresAt, value });
      }
      return value;
    });

    this.pending.set(key, promise);
    const clear = (): void => {
      if (this.pending.get(key) === promise) {
        this.pending.delete(key);
      }
    };
    promise.then(clear, clear);

    return promise;
  }
}

export default new MiningApiCache(60000);
