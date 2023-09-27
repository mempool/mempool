export namespace ILightningApi {
  export interface NetworkInfo {
    graph_diameter: number;
    avg_out_degree: number;
    max_out_degree: number;
    num_nodes: number;
    num_channels: number;
    total_network_capacity: string;
    avg_channel_size: number;
    min_channel_size: string;
    max_channel_size: string;
    median_channel_size_sat: string;
    num_zombie_chans: string;
  }

  export interface NetworkGraph {
    nodes: Node[];
    edges: Channel[];
  }

  export interface Channel {
    channel_id: string;
    chan_point: string;
    last_update: number | null;
    node1_pub: string;
    node2_pub: string;
    capacity: string;
    node1_policy: RoutingPolicy | null;
    node2_policy: RoutingPolicy | null;
  }

  export interface RoutingPolicy {
    time_lock_delta: number;
    min_htlc: string;
    fee_base_msat: string;
    fee_rate_milli_msat: string;
    disabled: boolean;
    max_htlc_msat: string;
    last_update: number | null;
  }

  export interface Node {
    last_update: number | null;
    pub_key: string;
    alias: string;
    addresses: {
      network: string;
      addr: string;
    }[];
    color: string;
    features: { [key: number]: Feature };
    custom_records?: { [type: number]: string };
  }

  export interface Info {
    identity_pubkey: string;
    alias: string;
    num_pending_channels: number;
    num_active_channels: number;
    num_peers: number;
    block_height: number;
    block_hash: string;
    synced_to_chain: boolean;
    testnet: boolean;
    uris: string[];
    best_header_timestamp: string;
    version: string;
    num_inactive_channels: number;
    chains: {
      chain: string;
      network: string;
    }[];
    color: string;
    synced_to_graph: boolean;
    features: { [key: number]: Feature };
    commit_hash: string;
    /** Available on LND since v0.15.0-beta */
    require_htlc_interceptor?: boolean;
  }

  export interface Feature {
    bit: number;
    name: string;
    is_required: boolean;
    is_known: boolean;
  }

  export interface ForensicOutput {
    node?: 1 | 2;
    type: number;
    value: number;
  }
}