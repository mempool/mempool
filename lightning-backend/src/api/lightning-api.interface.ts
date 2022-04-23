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
    updated_at: string;
  }

  interface Policy {
    public_key: string;
    base_fee_mtokens?: number;
    cltv_delta?: number;
    fee_rate?: number;
    is_disabled?: boolean;
    max_htlc_mtokens?: number;
    min_htlc_mtokens?: number;
    updated_at?: string;
  }

  export interface Node {
    alias: string;
    color: string;
    features: Feature[];
    public_key: string;
    sockets: string[];
    updated_at: string;
  }

  interface Feature {
    bit: number;
    is_known: boolean;
    is_required: boolean;
    type: string;
  }
}
