export interface Stats {
  address: number;
  minted: number;
  burnt: number;
  spent_txos: number;
  unspent_txos: number;
}

export interface StatsInstance {
  getStats: () => Promise<Stats>;
}
