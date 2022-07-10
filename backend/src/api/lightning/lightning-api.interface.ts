export namespace ILightningApi {
  export interface NetworkInfo {
    average_channel_size: number;
    channel_count: number;
    max_channel_size: number;
    median_channel_size: number;
    min_channel_size: number;
    node_count: number;
    not_recently_updated_policy_count: number;
    total_capacity: number;
  }

  export interface NetworkGraph {
    channels: Channel[];
    nodes: Node[];
  }

  export interface Channel {
    id: string;
    capacity: number;
    policies: Policy[];
    transaction_id: string;
    transaction_vout: number;
    updated_at?: string;
  }

  interface Policy {
    public_key: string;
    base_fee_mtokens?: string;
    cltv_delta?: number;
    fee_rate?: number;
    is_disabled?: boolean;
    max_htlc_mtokens?: string;
    min_htlc_mtokens?: string;
    updated_at?: string;
  }

  export interface Node {
    alias: string;
    color: string;
    features: Feature[];
    public_key: string;
    sockets: string[];
    updated_at?: string;
  }

  export interface Info {
    chains: string[];
    color: string;
    active_channels_count: number;
    alias: string;
    current_block_hash: string;
    current_block_height: number;
    features: Feature[];
    is_synced_to_chain: boolean;
    is_synced_to_graph: boolean;
    latest_block_at: string;
    peers_count: number;
    pending_channels_count: number;
    public_key: string;
    uris: any[];
    version: string;
  }
  
  export interface Feature {
    bit: number;
    is_known: boolean;
    is_required: boolean;
    type?: string;
  }
}
