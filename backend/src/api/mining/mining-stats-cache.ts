import logger from '../../logger';

export default class MiningStatsCache<T> {
  private snapshot: {syncedAt: number, byKey: Record<string, T>} | null = null;
  private rebuild: Promise<Record<string, T>> | null = null;
  private generation = 0;
  private syncedGeneration = -1;

  constructor (
    private name: string,
    private $build: () => Promise<Record<string, T>>,
    private resyncMs: number,
  ) { }

  /** @asyncUnsafe */
  public async $get(key: string): Promise<T> {
    const snapshot = this.snapshot;

    if (snapshot) {
      // reads never react to invalidations, only to the snapshot ageing out: rebuilding is
      // driven by events so that request volume cannot pull heavy work onto the read path
      if (Date.now() - snapshot.syncedAt >= this.resyncMs) {
        void this.$refreshQuietly();
      }
      return snapshot.byKey[key];
    }

    return (await this.$refresh())[key];
  }

  /**
   * Record that the underlying data changed without starting a rebuild, for callers that defer
   * the rebuild to a scheduled task. If a rebuild is already in flight its result predates this
   * change, so the mark is what makes another one follow it; and if the deferred task is dropped
   * the mark survives for the next invalidation or the periodic resync to pick up.
   */
  public markDirty(): void {
    this.generation++;
  }

  /** @asyncSafe */
  public $invalidate(): Promise<void> {
    this.markDirty();
    return this.$refreshQuietly();
  }

  /** @asyncSafe */
  private async $refreshQuietly(): Promise<void> {
    try {
      await this.$refresh();
    } catch (e) {
      logger.err(`Failed to refresh ${this.name} cache. Reason: ` + (e instanceof Error ? e.message : e), logger.tags.mining);
    }
  }

  private $refresh(): Promise<Record<string, T>> {
    if (this.rebuild) {
      return this.rebuild;
    }

    const generation = this.generation;
    const rebuild = this.$build().then((byKey) => {
      this.snapshot = { syncedAt: Date.now(), byKey };
      this.syncedGeneration = generation;
      return byKey;
    });

    this.rebuild = rebuild;

    const clearRebuild = (): void => {
      if (this.rebuild === rebuild) {
        this.rebuild = null;
      }
    };

    rebuild.then(() => {
      clearRebuild();
      if (this.isDirty()) {
        void this.$refreshQuietly();
      }
    }, clearRebuild);

    return rebuild;
  }

  private isDirty(): boolean {
    return this.syncedGeneration !== this.generation;
  }
}