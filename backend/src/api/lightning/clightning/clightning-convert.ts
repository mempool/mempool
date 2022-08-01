import { ILightningApi } from '../lightning-api.interface';

/**
 * Convert a clightning "listnode" entry to a lnd node entry
 */
export function convertNode(clNode: any): ILightningApi.Node {
  return {
    alias: clNode.alias ?? '',
    color: `#${clNode.color ?? ''}`,
    features: [], // TODO parse and return clNode.feature
    pub_key: clNode.nodeid,
    addresses: clNode.addresses?.map((addr) => {
      return {
        network: addr.type,
        addr: `${addr.address}:${addr.port}`
      };
    }),
    last_update: clNode?.last_timestamp ?? 0,
  };
}

/**
 * Convert clightning "listchannels" response to lnd "describegraph.edges" format
 */
 export function convertAndmergeBidirectionalChannels(clChannels: any[]): ILightningApi.Channel[] {
  const consolidatedChannelList: ILightningApi.Channel[] = [];
  const clChannelsDict = {};
  const clChannelsDictCount = {};

  for (const clChannel of clChannels) {    
    if (!clChannelsDict[clChannel.short_channel_id]) {
      clChannelsDict[clChannel.short_channel_id] = clChannel;
      clChannelsDictCount[clChannel.short_channel_id] = 1;
    } else {
      consolidatedChannelList.push(
        buildFullChannel(clChannel, clChannelsDict[clChannel.short_channel_id])
      );
      delete clChannelsDict[clChannel.short_channel_id];
      clChannelsDictCount[clChannel.short_channel_id]++;
    }
  }
  for (const short_channel_id of Object.keys(clChannelsDict)) {
    consolidatedChannelList.push(buildIncompleteChannel(clChannelsDict[short_channel_id]));
  }

  return consolidatedChannelList;
}

export function convertChannelId(channelId): string {
  const s = channelId.split('x').map(part => parseInt(part));
  return BigInt((s[0] << 40) | (s[1] << 16) | s[2]).toString();
}

/**
 * Convert two clightning "getchannels" entries into a full a lnd "describegraph.edges" format
 * In this case, clightning knows the channel policy for both nodes
 */
function buildFullChannel(clChannelA: any, clChannelB: any): ILightningApi.Channel {
  const lastUpdate = Math.max(clChannelA.last_update ?? 0, clChannelB.last_update ?? 0);
  
  return {
    channel_id: clChannelA.short_channel_id,
    capacity: clChannelA.satoshis,
    last_update: lastUpdate,
    node1_policy: convertPolicy(clChannelA),
    node2_policy: convertPolicy(clChannelB),
    chan_point: ':0', // TODO
    node1_pub: clChannelA.source,
    node2_pub: clChannelB.source,
  };
}

/**
 * Convert one clightning "getchannels" entry into a full a lnd "describegraph.edges" format
 * In this case, clightning knows the channel policy of only one node
 */
 function buildIncompleteChannel(clChannel: any): ILightningApi.Channel {
  return {
    channel_id: clChannel.short_channel_id,
    capacity: clChannel.satoshis,
    last_update: clChannel.last_update ?? 0,
    node1_policy: convertPolicy(clChannel),
    node2_policy: null,
    chan_point: ':0', // TODO
    node1_pub: clChannel.source,
    node2_pub: clChannel.destination,
  };
}

/**
 * Convert a clightning "listnode" response to a lnd channel policy format
 */
 function convertPolicy(clChannel: any): ILightningApi.RoutingPolicy {
  return {
    time_lock_delta: 0, // TODO
    min_htlc: clChannel.htlc_minimum_msat.slice(0, -4),
    max_htlc_msat: clChannel.htlc_maximum_msat.slice(0, -4),
    fee_base_msat: clChannel.base_fee_millisatoshi,
    fee_rate_milli_msat: clChannel.fee_per_millionth,
    disabled: !clChannel.active,
    last_update: clChannel.last_update ?? 0,
  };
}
