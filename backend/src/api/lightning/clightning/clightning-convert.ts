import logger from "../../../logger";
import { ILightningApi } from "../lightning-api.interface";

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
        buildBidirectionalChannel(clChannel, clChannelsDict[clChannel.short_channel_id])
      );
      delete clChannelsDict[clChannel.short_channel_id];
      clChannelsDictCount[clChannel.short_channel_id]++;
    }
  }
  const bidirectionalChannelsCount = consolidatedChannelList.length;

  for (const short_channel_id of Object.keys(clChannelsDict)) {
    consolidatedChannelList.push(buildUnidirectionalChannel(clChannelsDict[short_channel_id]));
  }
  const unidirectionalChannelsCount = consolidatedChannelList.length - bidirectionalChannelsCount;

  logger.debug(`clightning knows ${clChannels.length} channels. ` +
    `We found ${bidirectionalChannelsCount} bidirectional channels ` +
    `and ${unidirectionalChannelsCount} unidirectional channels.`); 

  return consolidatedChannelList;
}

function buildBidirectionalChannel(clChannelA: any, clChannelB: any): ILightningApi.Channel {
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

function buildUnidirectionalChannel(clChannel: any): ILightningApi.Channel {
  return {
    id: clChannel.short_channel_id,
    capacity: clChannel.satoshis,
    policies: [convertPolicy(clChannel), getEmptyPolicy()],
    transaction_id: '', // TODO
    transaction_vout: 0, // TODO
    updated_at: new Date((clChannel.last_update ?? 0) * 1000).toUTCString(),
  };
}

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
