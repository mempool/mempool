import memPool from '../mempool';
import logger from '../../logger';
import { TransactionExtended, OptimizedStatistic } from '../../mempool.interfaces';
import { Common } from '../common';
import statisticsApi from './statistics-api';

class Statistics {
  protected intervalTimer: NodeJS.Timer | undefined;
  protected lastRun: number = 0;
  protected newStatisticsEntryCallback: ((stats: OptimizedStatistic) => void) | undefined;

  public setNewStatisticsEntryCallback(fn: (stats: OptimizedStatistic) => void) {
    this.newStatisticsEntryCallback = fn;
  }

  public startStatistics(): void {
    logger.info('Starting statistics service');

    const now = new Date();
    const nextInterval = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(),
      Math.floor(now.getMinutes() / 1) * 1 + 1, 0, 0);
    const difference = nextInterval.getTime() - now.getTime();

    setTimeout(() => {
      this.runStatistics();
      this.intervalTimer = setInterval(() => {
        this.runStatistics(true);
      }, 1 * 60 * 1000);
    }, difference);
  }

  public async runStatistics(skipIfRecent = false): Promise<void> {
    if (!memPool.isInSync()) {
      return;
    }

    if (skipIfRecent && new Date().getTime() / 1000 - this.lastRun < 30) {
      return;
    }

    this.lastRun = new Date().getTime() / 1000;
    const currentMempool = memPool.getMempool();
    const txPerSecond = memPool.getTxPerSecond();
    const vBytesPerSecond = memPool.getVBytesPerSecond();

    logger.debug('Running statistics');

    let memPoolArray: TransactionExtended[] = [];
    for (const i in currentMempool) {
      if (currentMempool.hasOwnProperty(i)) {
        memPoolArray.push(currentMempool[i]);
      }
    }
    // Remove 0 and undefined
    memPoolArray = memPoolArray.filter((tx) => tx.effectiveFeePerVsize);

    if (!memPoolArray.length) {
      try {
        const insertIdZeroed = await statisticsApi.$createZeroedStatistic();
        if (this.newStatisticsEntryCallback && insertIdZeroed) {
          const newStats = await statisticsApi.$get(insertIdZeroed);
          if (newStats) {
            this.newStatisticsEntryCallback(newStats);
          }
        }
      } catch (e) {
        logger.err('Unable to insert zeroed statistics. ' + e);
      }
      return;
    }

    memPoolArray.sort((a, b) => a.effectiveFeePerVsize - b.effectiveFeePerVsize);
    const totalWeight = memPoolArray.map((tx) => tx.vsize).reduce((acc, curr) => acc + curr) * 4;
    const totalFee = memPoolArray.map((tx) => tx.fee).reduce((acc, curr) => acc + curr);

    const logFees = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100, 125, 150, 175, 200,
      250, 300, 350, 400, 500, 600, 700, 800, 900, 1000, 1200, 1400, 1600, 1800, 2000];

    const weightVsizeFees: { [feePerWU: number]: number } = {};
    const lastItem = logFees.length - 1;

    memPoolArray.forEach((transaction) => {
      for (let i = 0; i < logFees.length; i++) {
        if (
          (Common.isLiquid() && (i === lastItem || transaction.effectiveFeePerVsize * 10 < logFees[i + 1]))
          ||
          (!Common.isLiquid() && (i === lastItem || transaction.effectiveFeePerVsize < logFees[i + 1]))
        ) {
          if (weightVsizeFees[logFees[i]]) {
            weightVsizeFees[logFees[i]] += transaction.vsize;
          } else {
            weightVsizeFees[logFees[i]] = transaction.vsize;
          }
          break;
        }
      }
    });

    // get minFee and convert to sats/vb
    const minFee = memPool.getMempoolInfo().mempoolminfee * 100000;

    try {
      const insertId = await statisticsApi.$create({
        added: 'NOW()',
        unconfirmed_transactions: memPoolArray.length,
        tx_per_second: txPerSecond,
        vbytes_per_second: Math.round(vBytesPerSecond),
        mempool_byte_weight: totalWeight,
        total_fee: totalFee,
        fee_data: '',
        min_fee: minFee,
        vsize_1: weightVsizeFees['1'] || 0,
        vsize_2: weightVsizeFees['2'] || 0,
        vsize_3: weightVsizeFees['3'] || 0,
        vsize_4: weightVsizeFees['4'] || 0,
        vsize_5: weightVsizeFees['5'] || 0,
        vsize_6: weightVsizeFees['6'] || 0,
        vsize_8: weightVsizeFees['8'] || 0,
        vsize_10: weightVsizeFees['10'] || 0,
        vsize_12: weightVsizeFees['12'] || 0,
        vsize_15: weightVsizeFees['15'] || 0,
        vsize_20: weightVsizeFees['20'] || 0,
        vsize_30: weightVsizeFees['30'] || 0,
        vsize_40: weightVsizeFees['40'] || 0,
        vsize_50: weightVsizeFees['50'] || 0,
        vsize_60: weightVsizeFees['60'] || 0,
        vsize_70: weightVsizeFees['70'] || 0,
        vsize_80: weightVsizeFees['80'] || 0,
        vsize_90: weightVsizeFees['90'] || 0,
        vsize_100: weightVsizeFees['100'] || 0,
        vsize_125: weightVsizeFees['125'] || 0,
        vsize_150: weightVsizeFees['150'] || 0,
        vsize_175: weightVsizeFees['175'] || 0,
        vsize_200: weightVsizeFees['200'] || 0,
        vsize_250: weightVsizeFees['250'] || 0,
        vsize_300: weightVsizeFees['300'] || 0,
        vsize_350: weightVsizeFees['350'] || 0,
        vsize_400: weightVsizeFees['400'] || 0,
        vsize_500: weightVsizeFees['500'] || 0,
        vsize_600: weightVsizeFees['600'] || 0,
        vsize_700: weightVsizeFees['700'] || 0,
        vsize_800: weightVsizeFees['800'] || 0,
        vsize_900: weightVsizeFees['900'] || 0,
        vsize_1000: weightVsizeFees['1000'] || 0,
        vsize_1200: weightVsizeFees['1200'] || 0,
        vsize_1400: weightVsizeFees['1400'] || 0,
        vsize_1600: weightVsizeFees['1600'] || 0,
        vsize_1800: weightVsizeFees['1800'] || 0,
        vsize_2000: weightVsizeFees['2000'] || 0,
      });

      if (this.newStatisticsEntryCallback && insertId) {
        const newStats = await statisticsApi.$get(insertId);
        if (newStats) {
          this.newStatisticsEntryCallback(newStats);
        }
      }
    } catch (e) {
      logger.err('Unable to insert statistics. ' + e);
    }
  }
}

export default new Statistics();
