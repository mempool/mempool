'use strict';

import { existsSync, statSync } from 'fs';
import { createConnection, Socket } from 'net';
import { homedir } from 'os';
import path from 'path';
import { createInterface, Interface } from 'readline';
import logger from '../../../logger';
import { AbstractLightningApi } from '../lightning-api-abstract-factory';
import { ILightningApi } from '../lightning-api.interface';
import { Common } from '../../common';

import * as ldk from "lightningdevkit";
import * as ldk_net from "lightningdevkit-node-net";
import * as fs from "fs";
import { strict as assert } from "assert";

function bytes_to_hex(inp: Uint8Array|Array<number>): string {
  return Array.from(inp, b => ('0' + b.toString(16)).slice(-2)).join('');
}
function hex_to_bytes(inp: string): Uint8Array {
  var res = new Uint8Array(inp.length / 2);
  for (var i = 0; i < inp.length / 2; i++) {
    res[i] = parseInt(inp.substr(i*2, 2), 16);
  }
  return res;
}

export default class GenericLightningClient implements AbstractLightningApi {
  private constructor(
      private network_graph: ldk.NetworkGraph,
      private peer_manager: ldk.PeerManager,
      private net_handler: ldk_net.NodeLDKNet,
      private peer_pk: Uint8Array,
      private peer_ip: string,
      private peer_port: number
  ) {}

  static async build(peerPubkey, peerIp, peerPort): Promise<GenericLightningClient> {
    const wasm_file = fs.readFileSync("node_modules/lightningdevkit/liblightningjs.wasm");
    await ldk.initializeWasmFromBinary(wasm_file);

    //TODO: Create a random key, I guess, not that it matters really
    const signer = ldk.KeysManager.constructor_new(new Uint8Array(32), 42n, 42);

    // Construct a logger to handle log output from LDK, note that you can tweak
    // the verbosity by chaning the level comparison.
    const ldk_logger = ldk.Logger.new_impl({
      log(record: ldk.Record): void {
        if (record.get_level() != ldk.Level.LDKLevel_Gossip)
          logger.debug("LDK: " + record.get_module_path() + ": " + record.get_args());
      }
    } as ldk.LoggerInterface);

    // Construct the network graph and a callback it will use to verify lightning gossip data
    const network_graph = ldk.NetworkGraph.constructor_new(ldk.Network.LDKNetwork_Bitcoin, ldk_logger);

    const peer_manager;
    const gossip_checker = ldk.UtxoLookup.new_impl({
      get_utxo(_genesis_hash: Uint8Array, short_channel_id: bigint): ldk.UtxoResult {
        // In order to verify lightning gossip data, LDK will call this method to request information
        // about the UTXO at the given SCID.
        const result_future = ldk.UtxoFuture.constructor_new();
        const promise_future_copy = result_future.clone();
        new Promise(function() {
            try {
                /*const txIds = await bitcoinApi.$getTxIdsForBlock(req.params.hash);
                const txIds = await bitcoinApi.$getTxIdsForBlock(req.params.hash);
                const transactions: TransactionExtended[] = [];
                const startingIndex = Math.max(0, parseInt(req.params.index || '0', 10));
  
                const endIndex = Math.min(startingIndex + 10, txIds.length);
                for (let i = startingIndex; i < endIndex; i++) {
                  try {
                    const transaction = await transactionUtils.$getTransactionExtended(txIds[i], true, true);
                    transactions.push(transaction);
                    loadingIndicators.setProgress('blocktxs-' + req.params.hash, (i - startingIndex + 1) / (endIndex - startingIndex) * 100);
                  } catch (e) {
                    logger.debug('getBlockTransactions error: ' + (e instanceof Error ? e.message : e));
                  }
                }
                res.json(transactions);*/
                // XXX
                const utxo_value_satoshis = BigInt(4_000_000_000);
                const utxo_script_pubkey = new Uint8Array(33);
                const txout = ldk.TxOut.constructor_new(utxo_value_satoshis, utxo_script_pubkey);
                const result = ldk.Result_TxOutUtxoLookupErrorZ.constructor_ok(txout);
                promise_future_copy.resolve_without_forwarding(network_graph, result);
                peer_manager.process_events();
            } catch (e) {
                logger.debug('Lightning transaction validation error: ' + (e instanceof Error ? e.message : e));
            }
        });
        return ldk.UtxoResult.constructor_async(result_future);
      }
    } as ldk.UtxoLookupInterface);

    // Now construct the gossip syncer.
    const gossiper = ldk.P2PGossipSync.constructor_new(network_graph, ldk.Option_UtxoLookupZ.constructor_some(gossip_checker), ldk_logger);

    // Construct the peer and socket handler
    const ignoring_handler = ldk.IgnoringMessageHandler.constructor_new();
    peer_manager = ldk.PeerManager.constructor_new(ldk.ErroringMessageHandler.constructor_new().as_ChannelMessageHandler(), gossiper.as_RoutingMessageHandler(), ignoring_handler.as_OnionMessageHandler(), ignoring_handler.as_CustomMessageHandler(), 4242, new Uint8Array(32), ldk_logger, signer.as_NodeSigner());
    return new GenericLightningClient(
        network_graph, peer_manager, new ldk_net.NodeLDKNet(peer_manager),
        hex_to_bytes(peerPubkey), peerIp, peerPort
    );
  }

  async $getNetworkGraph(): Promise<ILightningApi.NetworkGraph> {
    if (this.peer_manager.get_peer_node_ids().length == 0) {
      await this.net_handler.connect_peer(this.peer_ip, this.peer_port, this.peer_pk);
      // XXX: Give us a bit of time to finish sync...
      return { nodes: [], edges: [] };
    }

    const locked_graph = this.network_graph.read_only();
    var nodes: ILightningApi.Node[] = [];
    var edges: ILightningApi.Channel[] = [];

    for (const scid of locked_graph.list_channels()) {
      const chan_info = locked_graph.channel(scid);
      const dir_a_update = chan_info.get_one_to_two();
      const dir_b_update = chan_info.get_two_to_one();

      var last_update = 0;
      var node1_policy: null | ILightningApi.RoutingPolicy = null;
      if (dir_a_update != null) {
        last_update = Math.max(last_update, dir_a_update.get_last_update());
        node1_policy = {
          time_lock_delta: dir_a_update.get_cltv_expiry_delta(),
          min_htlc: dir_a_update.get_htlc_minimum_msat() + "",
          fee_base_msat: dir_a_update.get_fees().get_base_msat() + "",
          fee_rate_milli_msat: dir_a_update.get_fees().get_proportional_millionths() + "",
          disabled: !dir_a_update.get_enabled(),
          max_htlc_msat: dir_a_update.get_htlc_maximum_msat() + "",
          last_update: dir_a_update.get_last_update(),
        };
      }
      var node2_policy: null | ILightningApi.RoutingPolicy = null;
      if (dir_b_update != null) {
        last_update = Math.max(last_update, dir_b_update.get_last_update());
        node2_policy = {
          time_lock_delta: dir_b_update.get_cltv_expiry_delta(),
          min_htlc: dir_b_update.get_htlc_minimum_msat() + "",
          fee_base_msat: dir_b_update.get_fees().get_base_msat() + "",
          fee_rate_milli_msat: dir_b_update.get_fees().get_proportional_millionths() + "",
          disabled: !dir_b_update.get_enabled(),
          max_htlc_msat: dir_b_update.get_htlc_maximum_msat() + "",
          last_update: dir_b_update.get_last_update(),
        };
      }
      edges.push({
        channel_id: Common.channelShortIdToIntegerId(scid + ""),
        last_update, // XXX: this field makes no sense - channel announcements are never updated.
        chan_point: "", // XXX: 
        capacity: (chan_info.get_capacity_sats() as ldk.Option_u64Z_Some).some + "",
        node1_pub: bytes_to_hex(chan_info.get_node_one().as_slice()),
        node2_pub: bytes_to_hex(chan_info.get_node_two().as_slice()),
        node1_policy,
        node2_policy,
      });
    }
    for (const node_id of locked_graph.list_nodes()) {
      const node_info = locked_graph.node(node_id);
      var last_update = 0;
      var alias = "";
      var addresses: { network: string; addr: string; }[] = [];
      var color = "000000";
      var features = {};
      const last_announcement = node_info.get_announcement_info();
      if (last_announcement != null) {
        last_update = last_announcement.get_last_update();
        alias = bytes_to_hex(last_announcement.get_alias().get_a());
        color = bytes_to_hex(last_announcement.get_rgb());
        for (const address of last_announcement.addresses()) {
          if (address instanceof ldk.NetAddress_IPv4) {
            addresses.push({ network: "v4", addr: bytes_to_hex(address.addr) + ":" + address.port });
          } else if (address instanceof ldk.NetAddress_IPv6) {
            addresses.push({ network: "v4", addr: bytes_to_hex(address.addr) + ":" + address.port });
          } else if (address instanceof ldk.NetAddress_OnionV3) {
            const host_str = bytes_to_hex(address.ed25519_pubkey) +
              bytes_to_hex([(address.checksum >> 8), (address.checksum & 0xff)]) +
              bytes_to_hex([address.version & 0xff]);
            // We should swap the hex string here for base32 for a proper ".onion"
            addresses.push({ network: "onionv3", addr: host_str + ".onion:" + address.port });
          } else if (address instanceof ldk.NetAddress_Hostname) {
            addresses.push({ network: "hostname", addr: address.hostname + ":" + address.port });
          }
        }
        // TODO: We should fill in features, but we don't currently have an API which is
        // equivalent to the lnd one the returned object was built around.
      }
      nodes.push({
        last_update,
        pub_key: bytes_to_hex(node_id.as_slice()),
        alias,
        addresses,
        color,
        features,
      });
    }
    locked_graph.free();
    return { nodes, edges };
  }
}
