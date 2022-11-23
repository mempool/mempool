import DB from '../../database';
import logger from '../../logger';
import channelsApi from '../../api/explorer/channels.api';
import bitcoinApi from '../../api/bitcoin/bitcoin-api-factory';
import config from '../../config';
import { IEsploraApi } from '../../api/bitcoin/esplora-api.interface';
import { Common } from '../../api/common';

const throttleDelay = 20; //ms

class ForensicsService {
  loggerTimer = 0;
  closedChannelsScanBlock = 0;
  txCache: { [txid: string]: IEsploraApi.Transaction } = {};

  constructor() {}

  public async $startService(): Promise<void> {
    logger.info('Starting lightning network forensics service');

    this.loggerTimer = new Date().getTime() / 1000;

    await this.$runTasks();
  }

  private async $runTasks(): Promise<void> {
    try {
      logger.info(`Running forensics scans`);

      if (config.MEMPOOL.BACKEND === 'esplora') {
        await this.$runClosedChannelsForensics(false);
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
      logger.info(`Started running closed channel forensics...`);
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
            await Common.sleep$(throttleDelay);
          } catch (e) {
            logger.err(`Failed to call ${config.ESPLORA.REST_API_URL + '/tx/' + channel.closing_transaction_id + '/outspends'}. Reason ${e instanceof Error ? e.message : e}`);
            continue;
          }
          const lightningScriptReasons: number[] = [];
          for (const outspend of outspends) {
            if (outspend.spent && outspend.txid) {
              let spendingTx: IEsploraApi.Transaction | undefined = this.txCache[outspend.txid];
              if (!spendingTx) {
                try {
                  spendingTx = await bitcoinApi.$getRawTransaction(outspend.txid);
                  await Common.sleep$(throttleDelay);
                  this.txCache[outspend.txid] = spendingTx;
                } catch (e) {
                  logger.err(`Failed to call ${config.ESPLORA.REST_API_URL + '/tx/' + outspend.txid}. Reason ${e instanceof Error ? e.message : e}`);
                  continue;
                }
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
            let closingTx: IEsploraApi.Transaction | undefined = this.txCache[channel.closing_transaction_id];
            if (!closingTx) {
              try {
                closingTx = await bitcoinApi.$getRawTransaction(channel.closing_transaction_id);
                await Common.sleep$(throttleDelay);
                this.txCache[channel.closing_transaction_id] = closingTx;
              } catch (e) {
                logger.err(`Failed to call ${config.ESPLORA.REST_API_URL + '/tx/' + channel.closing_transaction_id}. Reason ${e instanceof Error ? e.message : e}`);
                continue;
              }
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
          logger.info(`Updating channel closed channel forensics ${progress}/${channels.length}`);
          this.loggerTimer = new Date().getTime() / 1000;
        }
      }
      logger.info(`Closed channels forensics scan complete.`);
    } catch (e) {
      logger.err('$runClosedChannelsForensics() error: ' + (e instanceof Error ? e.message : e));
    }
  }

  private findLightningScript(vin: IEsploraApi.Vin): number {
    const topElement = vin.witness[vin.witness.length - 2];
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
        if (topElement.length === 66) {
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
}

export default new ForensicsService();
