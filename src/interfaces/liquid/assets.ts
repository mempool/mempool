export interface Asset {
  asset_id: string;
  chain_stats: AssetStats;
  mempool_stats: AssetStats;
}

interface AssetStats {
  tx_count: number;
  peg_in_count: number;
  peg_in_amount: number;
  peg_out_count: number;
  peg_out_amount: number;
  burn_count: number;
  burned_amount: number;
}

export interface AssetsInstance {
  getAsset: (params: { asset_id: string }) => Promise<Asset>;
  getAssetIcon: (params: { asset_id: string }) => Promise<BinaryData>;
  getAssetTxs: (params: {
    asset_id: string;
    is_mempool: boolean;
  }) => Promise<Asset>;
  getAssetSupply: (params: {
    asset_id: string;
    decimal: boolean;
  }) => Promise<Asset>;
  getAssetsIcons: () => Promise<string[]>
}
