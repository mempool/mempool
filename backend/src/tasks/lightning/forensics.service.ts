import DB from '../../database';
import logger from '../../logger';
import channelsApi from '../../api/explorer/channels.api';
import bitcoinApi from '../../api/bitcoin/bitcoin-api-factory';
import config from '../../config';
import { IEsploraApi } from '../../api/bitcoin/esplora-api.interface';
import { Common } from '../../api/common';
import { ILightningApi } from '../../api/lightning/lightning-api.interface';

const tempCacheSize = 10000;

class ForensicsService {
  loggerTimer = 0;
  closedChannelsScanBlock = 0;
  txCache: { [txid: string]: IEsploraApi.Transaction } = {};
  tempCached: string[] = [];

  constructor() {}

  public async $startService(): Promise<void> {
    logger.info('Starting lightning network forensics service');

    this.loggerTimer = new Date().getTime() / 1000;

    await this.$runTasks();
  }

  private async $runTasks(): Promise<void> {
    try {
      logger.debug(`Running forensics scans`);

      if (config.MEMPOOL.BACKEND === 'esplora') {
        await this.$runClosedChannelsForensics(false);
        await this.$runOpenedChannelsForensics();
      }

    } catch (e) {
      logger.err('ForensicsService.$runTasks() error: ' + (e instanceof Error ? e.message : e));
    }

    setTimeout(() => { this.$runTasks(); }, 1000 * config.LIGHTNING.FORENSICS_INTERVAL);
  }

  /*
    1. Mutually closed
    2. Forced closed
    3. Forced closed with penalty

    ┌────────────────────────────────────┐       ┌────────────────────────────┐
    │ outputs contain revocation script? ├──yes──► force close w/ penalty = 3 │
    └──────────────┬─────────────────────┘       └────────────────────────────┘
                   no
    ┌──────────────▼──────────────────────────┐
    │ outputs contain other lightning script? ├──┐
    └──────────────┬──────────────────────────┘  │
                   no                           yes
    ┌──────────────▼─────────────┐               │
    │ sequence starts with 0x80  │      ┌────────▼────────┐
    │           and              ├──────► force close = 2 │
    │ locktime starts with 0x20? │      └─────────────────┘
    └──────────────┬─────────────┘
                   no
         ┌─────────▼────────┐
         │ mutual close = 1 │
         └──────────────────┘
  */

  public async $runClosedChannelsForensics(onlyNewChannels: boolean = false): Promise<void> {
    if (config.MEMPOOL.BACKEND !== 'esplora') {
      return;
    }

    let progress = 0;

    try {
      logger.debug(`Started running closed channel forensics...`);
      let channels;
      if (onlyNewChannels) {
        channels = await channelsApi.$getClosedChannelsWithoutReason();
      } else {
        channels = await channelsApi.$getUnresolvedClosedChannels();
      }

      for (const channel of channels) {
        let reason = 0;
        let resolvedForceClose = false;
        // Only Esplora backend can retrieve spent transaction outputs
        const cached: string[] = [];
        try {
          let outspends: IEsploraApi.Outspend[] | undefined;
          try {
            outspends = await bitcoinApi.$getOutspends(channel.closing_transaction_id);
            await Common.sleep$(config.LIGHTNING.FORENSICS_RATE_LIMIT);
          } catch (e) {
            logger.err(`Failed to call ${config.ESPLORA.REST_API_URL + '/tx/' + channel.closing_transaction_id + '/outspends'}. Reason ${e instanceof Error ? e.message : e}`);
            continue;
          }
          const lightningScriptReasons: number[] = [];
          for (const outspend of outspends) {
            if (outspend.spent && outspend.txid) {
              let spendingTx = await this.fetchTransaction(outspend.txid);
              if (!spendingTx) {
                continue;
              }
              cached.push(spendingTx.txid);
              const lightningScript = this.findLightningScript(spendingTx.vin[outspend.vin || 0]);
              lightningScriptReasons.push(lightningScript);
            }
          }
          const filteredReasons = lightningScriptReasons.filter((r) => r !== 1);
          if (filteredReasons.length) {
            if (filteredReasons.some((r) => r === 2 || r === 4)) {
              reason = 3;
            } else {
              reason = 2;
              resolvedForceClose = true;
            }
          } else {
            /*
              We can detect a commitment transaction (force close) by reading Sequence and Locktime
              https://github.com/lightning/bolts/blob/master/03-transactions.md#commitment-transaction
            */
            let closingTx = await this.fetchTransaction(channel.closing_transaction_id, true);
            if (!closingTx) {
              continue;
            }
            cached.push(closingTx.txid);
            const sequenceHex: string = closingTx.vin[0].sequence.toString(16);
            const locktimeHex: string = closingTx.locktime.toString(16);
            if (sequenceHex.substring(0, 2) === '80' && locktimeHex.substring(0, 2) === '20') {
              reason = 2; // Here we can't be sure if it's a penalty or not
            } else {
              reason = 1;
            }
          }
          if (reason) {
            logger.debug('Setting closing reason ' + reason + ' for channel: ' + channel.id + '.');
            await DB.query(`UPDATE channels SET closing_reason = ? WHERE id = ?`, [reason, channel.id]);
            if (reason === 2 && resolvedForceClose) {
              await DB.query(`UPDATE channels SET closing_resolved = ? WHERE id = ?`, [true, channel.id]);
            }
            if (reason !== 2 || resolvedForceClose) {
              cached.forEach(txid => {
                delete this.txCache[txid];
              });
            }
          }
        } catch (e) {
          logger.err(`$runClosedChannelsForensics() failed for channel ${channel.short_id}. Reason: ${e instanceof Error ? e.message : e}`);
        }

        ++progress;
        const elapsedSeconds = Math.round((new Date().getTime() / 1000) - this.loggerTimer);
        if (elapsedSeconds > 10) {
          logger.debug(`Updating channel closed channel forensics ${progress}/${channels.length}`);
          this.loggerTimer = new Date().getTime() / 1000;
        }
      }
      logger.debug(`Closed channels forensics scan complete.`);
    } catch (e) {
      logger.err('$runClosedChannelsForensics() error: ' + (e instanceof Error ? e.message : e));
    }
  }

  private findLightningScript(vin: IEsploraApi.Vin): number {
    const topElement = vin.witness?.length > 2 ? vin.witness[vin.witness.length - 2] : null;
      if (/^OP_IF OP_PUSHBYTES_33 \w{66} OP_ELSE OP_PUSH(NUM_\d+|BYTES_(1 \w{2}|2 \w{4})) OP_CSV OP_DROP OP_PUSHBYTES_33 \w{66} OP_ENDIF OP_CHECKSIG$/.test(vin.inner_witnessscript_asm)) {
        // https://github.com/lightning/bolts/blob/master/03-transactions.md#commitment-transaction-outputs
        if (topElement === '01') {
          // top element is '01' to get in the revocation path
          // 'Revoked Lightning Force Close';
          // Penalty force closed
          return 2;
        } else {
          // top element is '', this is a delayed to_local output
          // 'Lightning Force Close';
          return 3;
        }
      } else if (
        /^OP_DUP OP_HASH160 OP_PUSHBYTES_20 \w{40} OP_EQUAL OP_IF OP_CHECKSIG OP_ELSE OP_PUSHBYTES_33 \w{66} OP_SWAP OP_SIZE OP_PUSHBYTES_1 20 OP_EQUAL OP_NOTIF OP_DROP OP_PUSHNUM_2 OP_SWAP OP_PUSHBYTES_33 \w{66} OP_PUSHNUM_2 OP_CHECKMULTISIG OP_ELSE OP_HASH160 OP_PUSHBYTES_20 \w{40} OP_EQUALVERIFY OP_CHECKSIG OP_ENDIF (OP_PUSHNUM_1 OP_CSV OP_DROP |)OP_ENDIF$/.test(vin.inner_witnessscript_asm) ||
        /^OP_DUP OP_HASH160 OP_PUSHBYTES_20 \w{40} OP_EQUAL OP_IF OP_CHECKSIG OP_ELSE OP_PUSHBYTES_33 \w{66} OP_SWAP OP_SIZE OP_PUSHBYTES_1 20 OP_EQUAL OP_IF OP_HASH160 OP_PUSHBYTES_20 \w{40} OP_EQUALVERIFY OP_PUSHNUM_2 OP_SWAP OP_PUSHBYTES_33 \w{66} OP_PUSHNUM_2 OP_CHECKMULTISIG OP_ELSE OP_DROP OP_PUSHBYTES_3 \w{6} OP_CLTV OP_DROP OP_CHECKSIG OP_ENDIF (OP_PUSHNUM_1 OP_CSV OP_DROP |)OP_ENDIF$/.test(vin.inner_witnessscript_asm)
      ) {
        // https://github.com/lightning/bolts/blob/master/03-transactions.md#offered-htlc-outputs
        // https://github.com/lightning/bolts/blob/master/03-transactions.md#received-htlc-outputs
        if (topElement?.length === 66) {
          // top element is a public key
          // 'Revoked Lightning HTLC'; Penalty force closed
          return 4;
        } else if (topElement) {
          // top element is a preimage
          // 'Lightning HTLC';
          return 5;
        } else {
          // top element is '' to get in the expiry of the script
          // 'Expired Lightning HTLC';
          return 6;
        }
      } else if (/^OP_PUSHBYTES_33 \w{66} OP_CHECKSIG OP_IFDUP OP_NOTIF OP_PUSHNUM_16 OP_CSV OP_ENDIF$/.test(vin.inner_witnessscript_asm)) {
        // https://github.com/lightning/bolts/blob/master/03-transactions.md#to_local_anchor-and-to_remote_anchor-output-option_anchors
        if (topElement) {
          // top element is a signature
          // 'Lightning Anchor';
          return 7;
        } else {
          // top element is '', it has been swept after 16 blocks
          // 'Swept Lightning Anchor';
          return 8;
        }
      }
      return 1;
  }

  // If a channel open tx spends funds from a another channel transaction,
  // we can attribute that output to a specific counterparty
  private async $runOpenedChannelsForensics(): Promise<void> {
    const runTimer = Date.now();
    let progress = 0;

    try {
      logger.debug(`Started running open channel forensics...`);
      const channels = await channelsApi.$getChannelsWithoutSourceChecked();

      for (const openChannel of channels) {
        let openTx = await this.fetchTransaction(openChannel.transaction_id, true);
        if (!openTx) {
          continue;
        }
        for (const input of openTx.vin) {
          const closeChannel = await channelsApi.$getChannelByClosingId(input.txid);
          if (closeChannel) {
            // this input directly spends a channel close output
            await this.$attributeChannelBalances(closeChannel, openChannel, input);
          } else {
            const prevOpenChannels = await channelsApi.$getChannelsByOpeningId(input.txid);
            if (prevOpenChannels?.length) {
              // this input spends a channel open change output
              for (const prevOpenChannel of prevOpenChannels) {
                await this.$attributeChannelBalances(prevOpenChannel, openChannel, input, null, null, true);
              }
            } else {
              // check if this input spends any swept channel close outputs
              await this.$attributeSweptChannelCloses(openChannel, input);
            }
          }
        }
        // calculate how much of the total input value is attributable to the channel open output
        openChannel.funding_ratio = openTx.vout[openChannel.transaction_vout].value / ((openTx.vout.reduce((sum, v) => sum + v.value, 0) || 1) + openTx.fee);
        // save changes to the opening channel, and mark it as checked
        if (openTx?.vin?.length === 1) {
          openChannel.single_funded = true;
        }
        if (openChannel.node1_funding_balance || openChannel.node2_funding_balance || openChannel.node1_closing_balance || openChannel.node2_closing_balance || openChannel.closed_by) {
          await channelsApi.$updateOpeningInfo(openChannel);
        }
        await channelsApi.$markChannelSourceChecked(openChannel.id);

        ++progress;
        const elapsedSeconds = Math.round((new Date().getTime() / 1000) - this.loggerTimer);
        if (elapsedSeconds > 10) {
          logger.debug(`Updating opened channel forensics ${progress}/${channels?.length}`);
          this.loggerTimer = new Date().getTime() / 1000;
          this.truncateTempCache();
        }
        if (Date.now() - runTimer > (config.LIGHTNING.FORENSICS_INTERVAL * 1000)) {
          break;
        }
      }

      logger.debug(`Open channels forensics scan complete.`);
    } catch (e) {
      logger.err('$runOpenedChannelsForensics() error: ' + (e instanceof Error ? e.message : e));
    } finally {
      this.clearTempCache();
    }
  }

  // Check if a channel open tx input spends the result of a swept channel close output
  private async $attributeSweptChannelCloses(openChannel: ILightningApi.Channel, input: IEsploraApi.Vin): Promise<void> {
    let sweepTx = await this.fetchTransaction(input.txid, true);
    if (!sweepTx) {
      logger.err(`couldn't find input transaction for channel forensics ${openChannel.channel_id} ${input.txid}`);
      return;
    }
    const openContribution = sweepTx.vout[input.vout].value;
    for (const sweepInput of sweepTx.vin) {
      const lnScriptType = this.findLightningScript(sweepInput);
      if (lnScriptType > 1) {
        const closeChannel = await channelsApi.$getChannelByClosingId(sweepInput.txid);
        if (closeChannel) {
          const initiator = (lnScriptType === 2 || lnScriptType === 4) ? 'remote' : (lnScriptType === 3 ? 'local' : null);
          await this.$attributeChannelBalances(closeChannel, openChannel, sweepInput, openContribution, initiator);
        }
      }
    }
  }

  private async $attributeChannelBalances(
    prevChannel, openChannel, input: IEsploraApi.Vin, openContribution: number | null = null,
    initiator: 'remote' | 'local' | null = null, linkedOpenings: boolean = false
  ): Promise<void> {
    // figure out which node controls the input/output
    let openSide;
    let prevLocal;
    let prevRemote;
    let matched = false;
    let ambiguous = false; // if counterparties are the same in both channels, we can't tell them apart
    if (openChannel.node1_public_key === prevChannel.node1_public_key) {
      openSide = 1;
      prevLocal = 1;
      prevRemote = 2;
      matched = true;
    } else if (openChannel.node1_public_key === prevChannel.node2_public_key) {
      openSide = 1;
      prevLocal = 2;
      prevRemote = 1;
      matched = true;
    }
    if (openChannel.node2_public_key === prevChannel.node1_public_key) {
      openSide = 2;
      prevLocal = 1;
      prevRemote = 2;
      if (matched) {
        ambiguous = true;
      }
      matched = true;
    } else if (openChannel.node2_public_key === prevChannel.node2_public_key) {
      openSide = 2;
      prevLocal = 2;
      prevRemote = 1;
      if (matched) {
        ambiguous = true;
      }
      matched = true;
    }

    if (matched && !ambiguous) {
      // fetch closing channel transaction and perform forensics on the outputs
      let prevChannelTx = await this.fetchTransaction(input.txid, true);
      let outspends: IEsploraApi.Outspend[] | undefined;
      try {
        outspends = await bitcoinApi.$getOutspends(input.txid);
        await Common.sleep$(config.LIGHTNING.FORENSICS_RATE_LIMIT);
      } catch (e) {
        logger.err(`Failed to call ${config.ESPLORA.REST_API_URL + '/tx/' + input.txid + '/outspends'}. Reason ${e instanceof Error ? e.message : e}`);
      }
      if (!outspends || !prevChannelTx) {
        return;
      }
      if (!linkedOpenings) {
        if (!prevChannel.outputs || !prevChannel.outputs.length) {
          prevChannel.outputs = prevChannelTx.vout.map(vout => {
            return {
              type: 0,
              value: vout.value,
            };
          });
        }
        for (let i = 0; i < outspends?.length; i++) {
          const outspend = outspends[i];
          const output = prevChannel.outputs[i];
          if (outspend.spent && outspend.txid) {
            try {
              const spendingTx = await this.fetchTransaction(outspend.txid, true);
              if (spendingTx) {
                output.type = this.findLightningScript(spendingTx.vin[outspend.vin || 0]);
              }
            } catch (e) {
              logger.err(`Failed to call ${config.ESPLORA.REST_API_URL + '/tx/' + outspend.txid}. Reason ${e instanceof Error ? e.message : e}`);
            }
          } else {
            output.type = 0;
          }
        }

        // attribute outputs to each counterparty, and sum up total known balances
        prevChannel.outputs[input.vout].node = prevLocal;
        const isPenalty = prevChannel.outputs.filter((out) => out.type === 2 || out.type === 4)?.length > 0;
        const normalOutput = [1,3].includes(prevChannel.outputs[input.vout].type);
        const mutualClose = ((prevChannel.status === 2 || prevChannel.status === 'closed') && prevChannel.closing_reason === 1);
        let localClosingBalance = 0;
        let remoteClosingBalance = 0;
        for (const output of prevChannel.outputs) {
          if (isPenalty) {
            // penalty close, so local node takes everything
            localClosingBalance += output.value;
          } else if (output.node) {
            // this output determinstically linked to one of the counterparties
            if (output.node === prevLocal) {
              localClosingBalance += output.value;
            } else {
              remoteClosingBalance += output.value;
            }
          } else if (normalOutput && (output.type === 1 || output.type === 3 || (mutualClose && prevChannel.outputs.length === 2))) {
            // local node had one main output, therefore remote node takes the other
            remoteClosingBalance += output.value;
          }
        }
        prevChannel[`node${prevLocal}_closing_balance`] = localClosingBalance;
        prevChannel[`node${prevRemote}_closing_balance`] = remoteClosingBalance;
        prevChannel.closing_fee = prevChannelTx.fee;

        if (initiator && !linkedOpenings) {
          const initiatorSide = initiator === 'remote' ? prevRemote : prevLocal;
          prevChannel.closed_by = prevChannel[`node${initiatorSide}_public_key`];
        }
  
        // save changes to the closing channel
        await channelsApi.$updateClosingInfo(prevChannel);
      } else {
        if (prevChannelTx.vin.length <= 1) {
          prevChannel[`node${prevLocal}_funding_balance`] = prevChannel.capacity;
          prevChannel.single_funded = true;
          prevChannel.funding_ratio = 1;
          // save changes to the closing channel
          await channelsApi.$updateOpeningInfo(prevChannel);
        }
      }
      openChannel[`node${openSide}_funding_balance`] = openChannel[`node${openSide}_funding_balance`] + (openContribution || prevChannelTx?.vout[input.vout]?.value || 0);
    }
  }

  async fetchTransaction(txid: string, temp: boolean = false): Promise<IEsploraApi.Transaction | null> {
    let tx = this.txCache[txid];
    if (!tx) {
      try {
        tx = await bitcoinApi.$getRawTransaction(txid);
        this.txCache[txid] = tx;
        if (temp) {
          this.tempCached.push(txid);
        }
        await Common.sleep$(config.LIGHTNING.FORENSICS_RATE_LIMIT);
      } catch (e) {
        logger.err(`Failed to call ${config.ESPLORA.REST_API_URL + '/tx/' + txid + '/outspends'}. Reason ${e instanceof Error ? e.message : e}`);
        return null;
      }
    }
    return tx;
  }

  clearTempCache(): void {
    for (const txid of this.tempCached) {
      delete this.txCache[txid];
    }
    this.tempCached = [];
  }

  truncateTempCache(): void {
    if (this.tempCached.length > tempCacheSize) {
      const removed = this.tempCached.splice(0, this.tempCached.length - tempCacheSize);
      for (const txid of removed) {
        delete this.txCache[txid];
      }
    }
  }
}

export default new ForensicsService();
