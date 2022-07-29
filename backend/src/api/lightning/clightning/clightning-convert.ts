import { ILightningApi } from '../lightning-api.interface';

/**
 * Convert a clightning "listnode" entry to a lnd node entry
 */
export function convertNode(clNode: any): ILightningApi.Node {
  return {
    alias: clNode.alias ?? '',
    color: `#${clNode.color ?? ''}`,
    features: [], // TODO parse and return clNode.feature
    public_key: clNode.nodeid,
    sockets: clNode.addresses?.map(addr => `${addr.address}:${addr.port}`) ?? [],
    updated_at: new Date((clNode?.last_timestamp ?? 0) * 1000).toUTCString(),
  };
}

/**
 * Convert clightning "listchannels" response to lnd "describegraph.channels" format
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

/**
 * Convert two clightning "getchannels" entries into a full a lnd "describegraph.channels" format
 * In this case, clightning knows the channel policy for both nodes
 */
function buildFullChannel(clChannelA: any, clChannelB: any): ILightningApi.Channel {
  const lastUpdate = Math.max(clChannelA.last_update ?? 0, clChannelB.last_update ?? 0);
  
  return {
    id: clChannelA.short_channel_id,
    capacity: clChannelA.satoshis,
    transaction_id: '', // TODO
    transaction_vout: 0, // TODO
    updated_at: new Date(lastUpdate * 1000).toUTCString(),
    policies: [
      convertPolicy(clChannelA),
      convertPolicy(clChannelB)
    ]
  };
}

/**
 * Convert one clightning "getchannels" entry into a full a lnd "describegraph.channels" format
 * In this case, clightning knows the channel policy of only one node
 */
 function buildIncompleteChannel(clChannel: any): ILightningApi.Channel {
  return {
    id: clChannel.short_channel_id,
    capacity: clChannel.satoshis,
    policies: [convertPolicy(clChannel), getEmptyPolicy()],
    transaction_id: '', // TODO
    transaction_vout: 0, // TODO
    updated_at: new Date((clChannel.last_update ?? 0) * 1000).toUTCString(),
  };
}

/**
 * Convert a clightning "listnode" response to a lnd channel policy format
 */
 function convertPolicy(clChannel: any): ILightningApi.Policy {
  return {
    public_key: clChannel.source,
    base_fee_mtokens: clChannel.base_fee_millisatoshi,
    fee_rate: clChannel.fee_per_millionth,
    is_disabled: !clChannel.active,
    max_htlc_mtokens: clChannel.htlc_maximum_msat.slice(0, -4),
    min_htlc_mtokens: clChannel.htlc_minimum_msat.slice(0, -4),
    updated_at: new Date((clChannel.last_update ?? 0) * 1000).toUTCString(),
  };
}

/**
 * Create an empty channel policy in lnd format
 */
 function getEmptyPolicy(): ILightningApi.Policy {
  return {
    public_key: 'null',
    base_fee_mtokens: '0',
    fee_rate: 0,
    is_disabled: true,
    max_htlc_mtokens: '0',
    min_htlc_mtokens: '0',
    updated_at: new Date(0).toUTCString(),
  };
}
