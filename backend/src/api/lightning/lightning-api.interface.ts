export namespace ILightningApi {
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