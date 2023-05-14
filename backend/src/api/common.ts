import { Ancestor, CpfpInfo, CpfpSummary, EffectiveFeeStats, MempoolBlockWithTransactions, TransactionExtended, TransactionStripped, WorkingEffectiveFeeStats } from '../mempool.interfaces';
import config from '../config';
import { NodeSocket } from '../repositories/NodesSocketsRepository';
import { isIP } from 'net';
export class Common {
  static nativeAssetId = config.MEMPOOL.NETWORK === 'liquidtestnet' ?
    '144c654344aa716d6f3abcc1ca90e5641e4e2a7f633bc09fe3baf64585819a49'
  : '6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d';
  static _isLiquid = config.MEMPOOL.NETWORK === 'liquid' || config.MEMPOOL.NETWORK === 'liquidtestnet';

  static isLiquid(): boolean {
    return this._isLiquid;
  }

  static median(numbers: number[]) {
    let medianNr = 0;
    const numsLen = numbers.length;
    if (numsLen % 2 === 0) {
        medianNr = (numbers[numsLen / 2 - 1] + numbers[numsLen / 2]) / 2;
    } else {
        medianNr = numbers[(numsLen - 1) / 2];
    }
    return medianNr;
  }

  static percentile(numbers: number[], percentile: number) {
    if (percentile === 50) {
      return this.median(numbers);
    }
    const index = Math.ceil(numbers.length * (100 - percentile) * 1e-2);
    if (index < 0 || index > numbers.length - 1) {
      return 0;
    }
    return numbers[index];
  }

  static getFeesInRange(transactions: TransactionExtended[], rangeLength: number) {
    const filtered: TransactionExtended[] = [];
    let lastValidRate = Infinity;
    // filter out anomalous fee rates to ensure monotonic range
    for (const tx of transactions) {
      if (tx.effectiveFeePerVsize <= lastValidRate) {
        filtered.push(tx);
        lastValidRate = tx.effectiveFeePerVsize;
      }
    }
    const arr = [filtered[filtered.length - 1].effectiveFeePerVsize];
    const chunk = 1 / (rangeLength - 1);
    let itemsToAdd = rangeLength - 2;

    while (itemsToAdd > 0) {
      arr.push(filtered[Math.floor(filtered.length * chunk * itemsToAdd)].effectiveFeePerVsize);
      itemsToAdd--;
    }

    arr.push(filtered[0].effectiveFeePerVsize);
    return arr;
  }

  static findRbfTransactions(added: TransactionExtended[], deleted: TransactionExtended[]): { [txid: string]: TransactionExtended[] } {
    const matches: { [txid: string]: TransactionExtended[] } = {};
    added
      .forEach((addedTx) => {
        const foundMatches = deleted.filter((deletedTx) => {
          // The new tx must, absolutely speaking, pay at least as much fee as the replaced tx.
          return addedTx.fee > deletedTx.fee
            // The new transaction must pay more fee per kB than the replaced tx.
            && addedTx.feePerVsize > deletedTx.feePerVsize
            // Spends one or more of the same inputs
            && deletedTx.vin.some((deletedVin) =>
              addedTx.vin.some((vin) => vin.txid === deletedVin.txid && vin.vout === deletedVin.vout));
            });
        if (foundMatches?.length) {
          matches[addedTx.txid] = foundMatches;
        }
      });
    return matches;
  }

  static stripTransaction(tx: TransactionExtended): TransactionStripped {
    return {
      txid: tx.txid,
      fee: tx.fee,
      vsize: tx.weight / 4,
      value: tx.vout.reduce((acc, vout) => acc + (vout.value ? vout.value : 0), 0),
      rate: tx.effectiveFeePerVsize,
    };
  }

  static sleep$(ms: number): Promise<void> {
    return new Promise((resolve) => {
       setTimeout(() => {
         resolve();
       }, ms);
    });
  }

  static shuffleArray(array: any[]) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
  }

  static setRelativesAndGetCpfpInfo(tx: TransactionExtended, memPool: { [txid: string]: TransactionExtended }): CpfpInfo {
    const parents = this.findAllParents(tx, memPool);
    const lowerFeeParents = parents.filter((parent) => parent.feePerVsize < tx.effectiveFeePerVsize);

    let totalWeight = tx.weight + lowerFeeParents.reduce((prev, val) => prev + val.weight, 0);
    let totalFees = tx.fee + lowerFeeParents.reduce((prev, val) => prev + val.fee, 0);

    tx.ancestors = parents
      .map((t) => {
        return {
          txid: t.txid,
          weight: t.weight,
          fee: t.fee,
        };
      });

    // Add high (high fee) decendant weight and fees
    if (tx.bestDescendant) {
      totalWeight += tx.bestDescendant.weight;
      totalFees += tx.bestDescendant.fee;
    }

    tx.effectiveFeePerVsize = Math.max(0, totalFees / (totalWeight / 4));
    tx.cpfpChecked = true;

    return {
      ancestors: tx.ancestors,
      bestDescendant: tx.bestDescendant || null,
    };
  }


  private static findAllParents(tx: TransactionExtended, memPool: { [txid: string]: TransactionExtended }): TransactionExtended[] {
    let parents: TransactionExtended[] = [];
    tx.vin.forEach((parent) => {
      if (parents.find((p) => p.txid === parent.txid)) {
        return;
      }

      const parentTx = memPool[parent.txid];
      if (parentTx) {
        if (tx.bestDescendant && tx.bestDescendant.fee / (tx.bestDescendant.weight / 4) > parentTx.feePerVsize) {
          if (parentTx.bestDescendant && parentTx.bestDescendant.fee < tx.fee + tx.bestDescendant.fee) {
            parentTx.bestDescendant = {
              weight: tx.weight + tx.bestDescendant.weight,
              fee: tx.fee + tx.bestDescendant.fee,
              txid: tx.txid,
            };
          }
        } else if (tx.feePerVsize > parentTx.feePerVsize) {
          parentTx.bestDescendant = {
            weight: tx.weight,
            fee: tx.fee,
            txid: tx.txid
          };
        }
        parents.push(parentTx);
        parents = parents.concat(this.findAllParents(parentTx, memPool));
      }
    });
    return parents;
  }

  // calculates the ratio of matched transactions to projected transactions by weight
  static getSimilarity(projectedBlock: MempoolBlockWithTransactions, transactions: TransactionExtended[]): number {
    let matchedWeight = 0;
    let projectedWeight = 0;
    const inBlock = {};

    for (const tx of transactions) {
      inBlock[tx.txid] = tx;
    }

    // look for transactions that were expected in the template, but missing from the mined block
    for (const tx of projectedBlock.transactions) {
      if (inBlock[tx.txid]) {
        matchedWeight += tx.vsize * 4;
      }
      projectedWeight += tx.vsize * 4;
    }

    projectedWeight += transactions[0].weight;
    matchedWeight += transactions[0].weight;

    return projectedWeight ? matchedWeight / projectedWeight : 1;
  }

  static getSqlInterval(interval: string | null): string | null {
    switch (interval) {
      case '24h': return '1 DAY';
      case '3d': return '3 DAY';
      case '1w': return '1 WEEK';
      case '1m': return '1 MONTH';
      case '3m': return '3 MONTH';
      case '6m': return '6 MONTH';
      case '1y': return '1 YEAR';
      case '2y': return '2 YEAR';
      case '3y': return '3 YEAR';
      case '4y': return '4 YEAR';
      default: return null;
    }
  }

  static indexingEnabled(): boolean {
    return (
      ['mainnet', 'testnet', 'signet'].includes(config.MEMPOOL.NETWORK) &&
      config.DATABASE.ENABLED === true &&
      config.MEMPOOL.INDEXING_BLOCKS_AMOUNT !== 0
    );
  }

  static blocksSummariesIndexingEnabled(): boolean {
    return (
      Common.indexingEnabled() &&
      config.MEMPOOL.BLOCKS_SUMMARIES_INDEXING === true
    );
  }

  static cpfpIndexingEnabled(): boolean {
    return (
      Common.indexingEnabled() &&
      config.MEMPOOL.CPFP_INDEXING === true
    );
  }

  static setDateMidnight(date: Date): void {
    date.setUTCHours(0);
    date.setUTCMinutes(0);
    date.setUTCSeconds(0);
    date.setUTCMilliseconds(0);
  }

  static channelShortIdToIntegerId(channelId: string): string {
    if (channelId.indexOf('x') === -1) { // Already an integer id
      return channelId;
    }
    if (channelId.indexOf('/') !== -1) { // Topology import
      channelId = channelId.slice(0, -2);
    }
    const s = channelId.split('x').map(part => BigInt(part));
    return ((s[0] << 40n) | (s[1] << 16n) | s[2]).toString();
  }

  /** Decodes a channel id returned by lnd as uint64 to a short channel id */
  static channelIntegerIdToShortId(id: string): string {
    if (id.indexOf('/') !== -1) {
      id = id.slice(0, -2);
    }
    
    if (id.indexOf('x') !== -1) { // Already a short id
      return id;
    }

    const n = BigInt(id);
    return [
      n >> 40n, // nth block
      (n >> 16n) & 0xffffffn, // nth tx of the block
      n & 0xffffn // nth output of the tx
    ].join('x');
  }

  static utcDateToMysql(date?: number | null): string | null {
    if (date === null) {
      return null;
    }
    const d = new Date((date || 0) * 1000);
    return d.toISOString().split('T')[0] + ' ' + d.toTimeString().split(' ')[0];
  }

  static findSocketNetwork(addr: string): {network: string | null, url: string} {
    let network: string | null = null;
    let url: string = addr;

    if (config.LIGHTNING.BACKEND === 'cln') {
      url = addr.split('://')[1];
    }

    if (!url) {
      return {
        network: null,
        url: addr,
      };
    }

    if (addr.indexOf('onion') !== -1) {
      if (url.split('.')[0].length >= 56) {
        network = 'torv3';
      } else {
        network = 'torv2';
      }
    } else if (addr.indexOf('i2p') !== -1) {
      network = 'i2p';
    } else if (addr.indexOf('ipv4') !== -1 || (config.LIGHTNING.BACKEND === 'lnd' && isIP(url.split(':')[0]) === 4)) {
      const ipv = isIP(url.split(':')[0]);
      if (ipv === 4) {
        network = 'ipv4';
      } else {
        return {
          network: null,
          url: addr,
        };
      }
    } else if (addr.indexOf('ipv6') !== -1 || (config.LIGHTNING.BACKEND === 'lnd' && url.indexOf(']:'))) {
      url = url.split('[')[1].split(']')[0];
      const ipv = isIP(url);
      if (ipv === 6) {
        const parts = addr.split(':');
        network = 'ipv6';
        url = `[${url}]:${parts[parts.length - 1]}`;
      } else {
        return {
          network: null,
          url: addr,
        };
      }
    } else {
      return {
        network: null,
        url: addr,
      };
    }

    return {
      network: network,
      url: url,
    };
  }

  static formatSocket(publicKey: string, socket: {network: string, addr: string}): NodeSocket {
    if (config.LIGHTNING.BACKEND === 'cln') {
      return {
        publicKey: publicKey,
        network: socket.network,
        addr: socket.addr,
      };
    } else /* if (config.LIGHTNING.BACKEND === 'lnd') */ {
      const formatted = this.findSocketNetwork(socket.addr);
      return {
        publicKey: publicKey,
        network: formatted.network,
        addr: formatted.url,
      };
    }
  }

  static calculateCpfp(height: number, transactions: TransactionExtended[]): CpfpSummary {
    const clusters: { root: string, height: number, txs: Ancestor[], effectiveFeePerVsize: number }[] = [];
    let cluster: TransactionExtended[] = [];
    let ancestors: { [txid: string]: boolean } = {};
    const txMap = {};
    for (let i = transactions.length - 1; i >= 0; i--) {
      const tx = transactions[i];
      txMap[tx.txid] = tx;
      if (!ancestors[tx.txid]) {
        let totalFee = 0;
        let totalVSize = 0;
        cluster.forEach(tx => {
          totalFee += tx?.fee || 0;
          totalVSize += (tx.weight / 4);
        });
        const effectiveFeePerVsize = totalFee / totalVSize;
        if (cluster.length > 1) {
          clusters.push({
            root: cluster[0].txid,
            height,
            txs: cluster.map(tx => { return { txid: tx.txid, weight: tx.weight, fee: tx.fee || 0 }; }),
            effectiveFeePerVsize,
          });
        }
        cluster.forEach(tx => {
          txMap[tx.txid].effectiveFeePerVsize = effectiveFeePerVsize;
        });
        cluster = [];
        ancestors = {};
      }
      cluster.push(tx);
      tx.vin.forEach(vin => {
        ancestors[vin.txid] = true;
      });
    }
    return {
      transactions,
      clusters,
    };
  }

  static calcEffectiveFeeStatistics(transactions: { weight: number, fee: number, effectiveFeePerVsize?: number, txid: string }[]): EffectiveFeeStats {
    const sortedTxs = transactions.map(tx => { return { txid: tx.txid, weight: tx.weight, rate: tx.effectiveFeePerVsize || ((tx.fee || 0) / (tx.weight / 4)) }; }).sort((a, b) => a.rate - b.rate);

    let weightCount = 0;
    let medianFee = 0;
    let medianWeight = 0;

    // calculate the "medianFee" as the average fee rate of the middle 10000 weight units of transactions
    const leftBound = 1995000;
    const rightBound = 2005000;
    for (let i = 0; i < sortedTxs.length && weightCount < rightBound; i++) {
      const left = weightCount;
      const right = weightCount + sortedTxs[i].weight;
      if (right > leftBound) {
        const weight = Math.min(right, rightBound) - Math.max(left, leftBound);
        medianFee += (sortedTxs[i].rate * (weight / 4) );
        medianWeight += weight;
      }
      weightCount += sortedTxs[i].weight;
    }
    const medianFeeRate = medianWeight ? (medianFee / (medianWeight / 4)) : 0;

    // minimum effective fee heuristic:
    // lowest of
    // a) the 1st percentile of effective fee rates
    // b) the minimum effective fee rate in the last 2% of transactions (in block order)
    const minFee = Math.min(
      Common.getNthPercentile(1, sortedTxs).rate,
      transactions.slice(-transactions.length / 50).reduce((min, tx) => { return Math.min(min, tx.effectiveFeePerVsize || ((tx.fee || 0) / (tx.weight / 4))); }, Infinity)
    );

    // maximum effective fee heuristic:
    // highest of
    // a) the 99th percentile of effective fee rates
    // b) the maximum effective fee rate in the first 2% of transactions (in block order)
    const maxFee = Math.max(
      Common.getNthPercentile(99, sortedTxs).rate,
      transactions.slice(0, transactions.length / 50).reduce((max, tx) => { return Math.max(max, tx.effectiveFeePerVsize || ((tx.fee || 0) / (tx.weight / 4))); }, 0)
    );

    return {
      medianFee: medianFeeRate,
      feeRange: [
        minFee,
        [10,25,50,75,90].map(n => Common.getNthPercentile(n, sortedTxs).rate),
        maxFee,
      ].flat(),
    };
  }

  static getNthPercentile(n: number, sortedDistribution: any[]): any {
    return sortedDistribution[Math.floor((sortedDistribution.length - 1) * (n / 100))];
  }
}

/**
 * Class to calculate average fee rates of a list of transactions
 * at certain weight percentiles, in a single pass
 * 
 * init with:
 *   maxWeight - the total weight to measure percentiles relative to (e.g. 4MW for a single block)
 *   percentileBandWidth - how many weight units to average over for each percentile (as a % of maxWeight)
 *   percentiles - an array of weight percentiles to compute, in %
 * 
 * then call .processNext(tx) for each transaction, in descending order
 * 
 * retrieve the final results with .getFeeStats()
 */
export class OnlineFeeStatsCalculator {
  private maxWeight: number;
  private percentiles = [10,25,50,75,90];

  private bandWidthPercent = 2;
  private bandWidth: number = 0;
  private bandIndex = 0;
  private leftBound = 0;
  private rightBound = 0;
  private inBand = false;
  private totalBandFee = 0;
  private totalBandWeight = 0;
  private minBandRate = Infinity;
  private maxBandRate = 0;

  private feeRange: { avg: number, min: number, max: number }[] = [];
  private totalWeight: number = 0;

  constructor (maxWeight: number, percentileBandWidth?: number, percentiles?: number[]) {
    this.maxWeight = maxWeight;
    if (percentiles && percentiles.length) {
      this.percentiles = percentiles;
    }
    if (percentileBandWidth != null) {
      this.bandWidthPercent = percentileBandWidth;
    }
    this.bandWidth = this.maxWeight * (this.bandWidthPercent / 100);
    // add min/max percentiles aligned to the ends of the range
    this.percentiles.unshift(this.bandWidthPercent / 2);
    this.percentiles.push(100 - (this.bandWidthPercent / 2));
    this.setNextBounds();
  }

  processNext(tx: { weight: number, fee: number, effectiveFeePerVsize?: number, feePerVsize?: number, rate?: number, txid: string }): void {
    let left = this.totalWeight;
    const right = this.totalWeight + tx.weight;
    if (!this.inBand && right <= this.leftBound) {
      this.totalWeight += tx.weight;
      return;
    }

    while (left < right) {
      if (right > this.leftBound) {
        this.inBand = true;
        const txRate = (tx.rate || tx.effectiveFeePerVsize || tx.feePerVsize || 0);
        const weight = Math.min(right, this.rightBound) - Math.max(left, this.leftBound);
        this.totalBandFee += (txRate * weight);
        this.totalBandWeight += weight;
        this.maxBandRate = Math.max(this.maxBandRate, txRate);
        this.minBandRate = Math.min(this.minBandRate, txRate);
      }
      left = Math.min(right, this.rightBound);

      if (left >= this.rightBound) {
        this.inBand = false;
        const avgBandFeeRate = this.totalBandWeight ? (this.totalBandFee / this.totalBandWeight) : 0;
        this.feeRange.unshift({ avg: avgBandFeeRate, min: this.minBandRate, max: this.maxBandRate });
        this.bandIndex++;
        this.setNextBounds();
        this.totalBandFee = 0;
        this.totalBandWeight = 0;
        this.minBandRate = Infinity;
        this.maxBandRate = 0;
      }
    }
    this.totalWeight += tx.weight;
  }

  private setNextBounds(): void {
    const nextPercentile = this.percentiles[this.bandIndex];
    if (nextPercentile != null) {
      this.leftBound = ((nextPercentile / 100) * this.maxWeight) - (this.bandWidth / 2);
      this.rightBound = this.leftBound + this.bandWidth;
    } else {
      this.leftBound = Infinity;
      this.rightBound = Infinity;
    }
  }

  getRawFeeStats(): WorkingEffectiveFeeStats {
    if (this.totalBandWeight > 0) {
      const avgBandFeeRate = this.totalBandWeight ? (this.totalBandFee / this.totalBandWeight) : 0;
      this.feeRange.unshift({ avg: avgBandFeeRate, min: this.minBandRate, max: this.maxBandRate });
    }
    while (this.feeRange.length < this.percentiles.length) {
      this.feeRange.unshift({ avg: 0, min: 0, max: 0 });
    }
    return {
      minFee: this.feeRange[0].min,
      medianFee: this.feeRange[Math.floor(this.feeRange.length / 2)].avg,
      maxFee: this.feeRange[this.feeRange.length - 1].max,
      feeRange: this.feeRange.map(f => f.avg),
    };
  }

  getFeeStats(): EffectiveFeeStats {
    const stats = this.getRawFeeStats();
    stats.feeRange[0] = stats.minFee;
    stats.feeRange[stats.feeRange.length - 1] = stats.maxFee;
    return stats;
  }
}
