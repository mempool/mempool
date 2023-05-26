import { Common } from './api/common';
import logger from './logger';
import 'websocket-polyfill';
import { SimplePool } from 'nostr-tools';
import config from './config';
import bitcoinApi from './api/bitcoin/bitcoin-api-factory';


class Nostr {
  public async $run(): Promise<void> {
    logger.debug(`Running nostr connector`);

    const pool = new SimplePool()
    const bitcoinTransactionsKind = 28333

    const networks: { [key: string]: string } = {
      "mainnet": "f9beb4d9",
      "testnet": "0b110907",
      "signet": "0a03cf40",
    };

    const networkType: string = config.MEMPOOL.NETWORK;
    const magic = networks[networkType];

    if (magic === undefined) {
      logger.err(`Nostr subscription failed, network unknown`);

      return;
    }

    let sub = pool.sub(
      config.NOSTR.RELAYS,
      [
        {
          kinds: [bitcoinTransactionsKind]
        }
      ]
    )

    sub.on('event', async event => {
      // Gather relevant tags.
      let eventMagic, txs;
      for (let tag of event.tags) {
        if (tag[0] === 'magic' && tag.length === 2) {
          eventMagic = tag[1]

          continue
        }

        if (tag[0] === 'transactions' && tag.length >= 2) {
          txs = tag.slice(1)

          continue
        }
      }

      // Skip if there are no transactions.
      if (txs === undefined) {
        logger.debug(`Skipping nostr event without transactions`)

        return;
      }

      // Check network of the event and skip if not matching the network that we
      // are running on currently.
      if (eventMagic !== magic) {
        logger.debug(`Skipping nostr event from network ${eventMagic} as we are on ${magic}`)

        return;
      }

      for (let tx of txs) {
        logger.debug(`Nostr transaction received: ${JSON.stringify(txs)}`)

        try {
          await bitcoinApi.$sendRawTransaction(tx);
        } catch (e) {
          logger.debug(`Nostr transaction send error: ${e}`)
        }
      }
    })
  }
}

export default new Nostr();
