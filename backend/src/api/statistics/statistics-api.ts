import DB from '../../database';
import logger from '../../logger';
import { Statistic, OptimizedStatistic } from '../../mempool.interfaces';

class StatisticsApi {
  protected queryTimeout = 120000;

  public async $createZeroedStatistic(): Promise<number | undefined> {
    try {
      const query = `INSERT INTO statistics(
              added,
              unconfirmed_transactions,
              tx_per_second,
              vbytes_per_second,
              mempool_byte_weight,
              fee_data,
              total_fee,
              min_fee,
              vsize_1,
              vsize_2,
              vsize_3,
              vsize_4,
              vsize_5,
              vsize_6,
              vsize_8,
              vsize_10,
              vsize_12,
              vsize_15,
              vsize_20,
              vsize_30,
              vsize_40,
              vsize_50,
              vsize_60,
              vsize_70,
              vsize_80,
              vsize_90,
              vsize_100,
              vsize_125,
              vsize_150,
              vsize_175,
              vsize_200,
              vsize_250,
              vsize_300,
              vsize_350,
              vsize_400,
              vsize_500,
              vsize_600,
              vsize_700,
              vsize_800,
              vsize_900,
              vsize_1000,
              vsize_1200,
              vsize_1400,
              vsize_1600,
              vsize_1800,
              vsize_2000
            )
            VALUES (NOW(), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
               0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)`;
      const [result]: any = await DB.query(query);
      return result.insertId;
    } catch (e) {
      logger.err('$create() error' + (e instanceof Error ? e.message : e));
    }
  }

  public async $create(statistics: Statistic, convertToDatetime = false): Promise<number | undefined> {
    try {
      const query = `INSERT INTO statistics(
              added,
              unconfirmed_transactions,
              tx_per_second,
              vbytes_per_second,
              mempool_byte_weight,
              fee_data,
              total_fee,
              min_fee,
              vsize_1,
              vsize_2,
              vsize_3,
              vsize_4,
              vsize_5,
              vsize_6,
              vsize_8,
              vsize_10,
              vsize_12,
              vsize_15,
              vsize_20,
              vsize_30,
              vsize_40,
              vsize_50,
              vsize_60,
              vsize_70,
              vsize_80,
              vsize_90,
              vsize_100,
              vsize_125,
              vsize_150,
              vsize_175,
              vsize_200,
              vsize_250,
              vsize_300,
              vsize_350,
              vsize_400,
              vsize_500,
              vsize_600,
              vsize_700,
              vsize_800,
              vsize_900,
              vsize_1000,
              vsize_1200,
              vsize_1400,
              vsize_1600,
              vsize_1800,
              vsize_2000
            )
            VALUES (${convertToDatetime ? `FROM_UNIXTIME(${statistics.added})` : statistics.added}, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
               ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      const params: (string | number)[] = [
        statistics.unconfirmed_transactions,
        statistics.tx_per_second,
        statistics.vbytes_per_second,
        statistics.mempool_byte_weight,
        statistics.fee_data,
        statistics.total_fee,
        statistics.min_fee,
        statistics.vsize_1,
        statistics.vsize_2,
        statistics.vsize_3,
        statistics.vsize_4,
        statistics.vsize_5,
        statistics.vsize_6,
        statistics.vsize_8,
        statistics.vsize_10,
        statistics.vsize_12,
        statistics.vsize_15,
        statistics.vsize_20,
        statistics.vsize_30,
        statistics.vsize_40,
        statistics.vsize_50,
        statistics.vsize_60,
        statistics.vsize_70,
        statistics.vsize_80,
        statistics.vsize_90,
        statistics.vsize_100,
        statistics.vsize_125,
        statistics.vsize_150,
        statistics.vsize_175,
        statistics.vsize_200,
        statistics.vsize_250,
        statistics.vsize_300,
        statistics.vsize_350,
        statistics.vsize_400,
        statistics.vsize_500,
        statistics.vsize_600,
        statistics.vsize_700,
        statistics.vsize_800,
        statistics.vsize_900,
        statistics.vsize_1000,
        statistics.vsize_1200,
        statistics.vsize_1400,
        statistics.vsize_1600,
        statistics.vsize_1800,
        statistics.vsize_2000,
      ];
      const [result]: any = await DB.query(query, params);
      return result.insertId;
    } catch (e) {
      logger.err('$create() error' + (e instanceof Error ? e.message : e));
    }
  }

  private getQueryForDaysAvg(div: number, interval: string) {
    return `SELECT
      UNIX_TIMESTAMP(added) as added,
      CAST(avg(unconfirmed_transactions) as DOUBLE) as unconfirmed_transactions,
      CAST(avg(vbytes_per_second) as DOUBLE) as vbytes_per_second,
      CAST(avg(min_fee) as DOUBLE) as min_fee,
      CAST(avg(vsize_1) as DOUBLE) as vsize_1,
      CAST(avg(vsize_2) as DOUBLE) as vsize_2,
      CAST(avg(vsize_3) as DOUBLE) as vsize_3,
      CAST(avg(vsize_4) as DOUBLE) as vsize_4,
      CAST(avg(vsize_5) as DOUBLE) as vsize_5,
      CAST(avg(vsize_6) as DOUBLE) as vsize_6,
      CAST(avg(vsize_8) as DOUBLE) as vsize_8,
      CAST(avg(vsize_10) as DOUBLE) as vsize_10,
      CAST(avg(vsize_12) as DOUBLE) as vsize_12,
      CAST(avg(vsize_15) as DOUBLE) as vsize_15,
      CAST(avg(vsize_20) as DOUBLE) as vsize_20,
      CAST(avg(vsize_30) as DOUBLE) as vsize_30,
      CAST(avg(vsize_40) as DOUBLE) as vsize_40,
      CAST(avg(vsize_50) as DOUBLE) as vsize_50,
      CAST(avg(vsize_60) as DOUBLE) as vsize_60,
      CAST(avg(vsize_70) as DOUBLE) as vsize_70,
      CAST(avg(vsize_80) as DOUBLE) as vsize_80,
      CAST(avg(vsize_90) as DOUBLE) as vsize_90,
      CAST(avg(vsize_100) as DOUBLE) as vsize_100,
      CAST(avg(vsize_125) as DOUBLE) as vsize_125,
      CAST(avg(vsize_150) as DOUBLE) as vsize_150,
      CAST(avg(vsize_175) as DOUBLE) as vsize_175,
      CAST(avg(vsize_200) as DOUBLE) as vsize_200,
      CAST(avg(vsize_250) as DOUBLE) as vsize_250,
      CAST(avg(vsize_300) as DOUBLE) as vsize_300,
      CAST(avg(vsize_350) as DOUBLE) as vsize_350,
      CAST(avg(vsize_400) as DOUBLE) as vsize_400,
      CAST(avg(vsize_500) as DOUBLE) as vsize_500,
      CAST(avg(vsize_600) as DOUBLE) as vsize_600,
      CAST(avg(vsize_700) as DOUBLE) as vsize_700,
      CAST(avg(vsize_800) as DOUBLE) as vsize_800,
      CAST(avg(vsize_900) as DOUBLE) as vsize_900,
      CAST(avg(vsize_1000) as DOUBLE) as vsize_1000,
      CAST(avg(vsize_1200) as DOUBLE) as vsize_1200,
      CAST(avg(vsize_1400) as DOUBLE) as vsize_1400,
      CAST(avg(vsize_1600) as DOUBLE) as vsize_1600,
      CAST(avg(vsize_1800) as DOUBLE) as vsize_1800,
      CAST(avg(vsize_2000) as DOUBLE) as vsize_2000 \
      FROM statistics \
      ${interval === 'all' ? '' : `WHERE added BETWEEN DATE_SUB(NOW(), INTERVAL ${interval}) AND NOW()`} \
      GROUP BY UNIX_TIMESTAMP(added) DIV ${div} \
      ORDER BY statistics.added DESC;`;
  }

  private getQueryForDays(div: number, interval: string) {
    return `SELECT
      UNIX_TIMESTAMP(added) as added,
      CAST(avg(unconfirmed_transactions) as DOUBLE) as unconfirmed_transactions,
      CAST(avg(vbytes_per_second) as DOUBLE) as vbytes_per_second,
      CAST(avg(min_fee) as DOUBLE) as min_fee,
      vsize_1,
      vsize_2,
      vsize_3,
      vsize_4,
      vsize_5,
      vsize_6,
      vsize_8,
      vsize_10,
      vsize_12,
      vsize_15,
      vsize_20,
      vsize_30,
      vsize_40,
      vsize_50,
      vsize_60,
      vsize_70,
      vsize_80,
      vsize_90,
      vsize_100,
      vsize_125,
      vsize_150,
      vsize_175,
      vsize_200,
      vsize_250,
      vsize_300,
      vsize_350,
      vsize_400,
      vsize_500,
      vsize_600,
      vsize_700,
      vsize_800,
      vsize_900,
      vsize_1000,
      vsize_1200,
      vsize_1400,
      vsize_1600,
      vsize_1800,
      vsize_2000 \
      FROM statistics \
      ${interval === 'all' ? '' : `WHERE added BETWEEN DATE_SUB(NOW(), INTERVAL ${interval}) AND NOW()`} \
      GROUP BY UNIX_TIMESTAMP(added) DIV ${div} \
      ORDER BY statistics.added DESC;`;
  }

  public async $get(id: number): Promise<OptimizedStatistic | undefined> {
    try {
      const query = `SELECT *, UNIX_TIMESTAMP(added) as added FROM statistics WHERE id = ?`;
      const [rows] = await DB.query(query, [id]);
      if (rows[0]) {
        return this.mapStatisticToOptimizedStatistic([rows[0]])[0];
      }
    } catch (e) {
      logger.err('$list2H() error' + (e instanceof Error ? e.message : e));
    }
  }

  public async $list2H(): Promise<OptimizedStatistic[]> {
    try {
      const query = `SELECT *, UNIX_TIMESTAMP(added) as added FROM statistics WHERE added BETWEEN DATE_SUB(NOW(), INTERVAL 2 HOUR) AND NOW() ORDER BY statistics.added DESC`;
      const [rows] = await DB.query({ sql: query, timeout: this.queryTimeout });
      return this.mapStatisticToOptimizedStatistic(rows as Statistic[]);
    } catch (e) {
      logger.err('$list2H() error' + (e instanceof Error ? e.message : e));
      return [];
    }
  }

  public async $list24H(): Promise<OptimizedStatistic[]> {
    try {
      const query = `SELECT *, UNIX_TIMESTAMP(added) as added FROM statistics WHERE added BETWEEN DATE_SUB(NOW(), INTERVAL 24 HOUR) AND NOW() ORDER BY statistics.added DESC`;
      const [rows] = await DB.query({ sql: query, timeout: this.queryTimeout });
      return this.mapStatisticToOptimizedStatistic(rows as Statistic[]);
    } catch (e) {
      logger.err('$list24h() error' + (e instanceof Error ? e.message : e));
      return [];
    }
  }

  public async $list1W(): Promise<OptimizedStatistic[]> {
    try {
      const query = this.getQueryForDaysAvg(300, '1 WEEK'); // 5m interval
      const [rows] = await DB.query({ sql: query, timeout: this.queryTimeout });
      return this.mapStatisticToOptimizedStatistic(rows as Statistic[]);
    } catch (e) {
      logger.err('$list1W() error' + (e instanceof Error ? e.message : e));
      return [];
    }
  }

  public async $list1M(): Promise<OptimizedStatistic[]> {
    try {
      const query = this.getQueryForDaysAvg(1800, '1 MONTH'); // 30m interval
      const [rows] = await DB.query({ sql: query, timeout: this.queryTimeout });
      return this.mapStatisticToOptimizedStatistic(rows as Statistic[]);
    } catch (e) {
      logger.err('$list1M() error' + (e instanceof Error ? e.message : e));
      return [];
    }
  }

  public async $list3M(): Promise<OptimizedStatistic[]> {
    try {
      const query = this.getQueryForDaysAvg(7200, '3 MONTH'); // 2h interval
      const [rows] = await DB.query({ sql: query, timeout: this.queryTimeout });
      return this.mapStatisticToOptimizedStatistic(rows as Statistic[]);
    } catch (e) {
      logger.err('$list3M() error' + (e instanceof Error ? e.message : e));
      return [];
    }
  }

  public async $list6M(): Promise<OptimizedStatistic[]> {
    try {
      const query = this.getQueryForDaysAvg(10800, '6 MONTH'); // 3h interval
      const [rows] = await DB.query({ sql: query, timeout: this.queryTimeout });
      return this.mapStatisticToOptimizedStatistic(rows as Statistic[]);
    } catch (e) {
      logger.err('$list6M() error' + (e instanceof Error ? e.message : e));
      return [];
    }
  }

  public async $list1Y(): Promise<OptimizedStatistic[]> {
    try {
      const query = this.getQueryForDays(28800, '1 YEAR'); // 8h interval
      const [rows] = await DB.query({ sql: query, timeout: this.queryTimeout });
      return this.mapStatisticToOptimizedStatistic(rows as Statistic[]);
    } catch (e) {
      logger.err('$list1Y() error' + (e instanceof Error ? e.message : e));
      return [];
    }
  }

  public async $list2Y(): Promise<OptimizedStatistic[]> {
    try {
      const query = this.getQueryForDays(28800, '2 YEAR'); // 8h interval
      const [rows] = await DB.query({ sql: query, timeout: this.queryTimeout });
      return this.mapStatisticToOptimizedStatistic(rows as Statistic[]);
    } catch (e) {
      logger.err('$list2Y() error' + (e instanceof Error ? e.message : e));
      return [];
    }
  }

  public async $list3Y(): Promise<OptimizedStatistic[]> {
    try {
      const query = this.getQueryForDays(43200, '3 YEAR'); // 12h interval
      const [rows] = await DB.query({ sql: query, timeout: this.queryTimeout });
      return this.mapStatisticToOptimizedStatistic(rows as Statistic[]);
    } catch (e) {
      logger.err('$list3Y() error' + (e instanceof Error ? e.message : e));
      return [];
    }
  }

  public async $list4Y(): Promise<OptimizedStatistic[]> {
    try {
      const query = this.getQueryForDays(43200, '4 YEAR'); // 12h interval
      const [rows] = await DB.query({ sql: query, timeout: this.queryTimeout });
      return this.mapStatisticToOptimizedStatistic(rows as Statistic[]);
    } catch (e) {
      logger.err('$list4Y() error' + (e instanceof Error ? e.message : e));
      return [];
    }
  }

  public async $listAll(): Promise<OptimizedStatistic[]> {
    try {
      const query = this.getQueryForDays(43200, 'all'); // 12h interval
      const [rows] = await DB.query({ sql: query, timeout: this.queryTimeout });
      return this.mapStatisticToOptimizedStatistic(rows as Statistic[]);
    } catch (e) {
      logger.err('$listAll() error' + (e instanceof Error ? e.message : e));
      return [];
    }
  }

  private mapStatisticToOptimizedStatistic(statistic: Statistic[]): OptimizedStatistic[] {
    return statistic.map((s) => {
      return {
        added: s.added,
        count: s.unconfirmed_transactions,
        vbytes_per_second: s.vbytes_per_second,
        mempool_byte_weight: s.mempool_byte_weight,
        total_fee: s.total_fee,
        min_fee: s.min_fee,
        vsizes: [
          s.vsize_1,
          s.vsize_2,
          s.vsize_3,
          s.vsize_4,
          s.vsize_5,
          s.vsize_6,
          s.vsize_8,
          s.vsize_10,
          s.vsize_12,
          s.vsize_15,
          s.vsize_20,
          s.vsize_30,
          s.vsize_40,
          s.vsize_50,
          s.vsize_60,
          s.vsize_70,
          s.vsize_80,
          s.vsize_90,
          s.vsize_100,
          s.vsize_125,
          s.vsize_150,
          s.vsize_175,
          s.vsize_200,
          s.vsize_250,
          s.vsize_300,
          s.vsize_350,
          s.vsize_400,
          s.vsize_500,
          s.vsize_600,
          s.vsize_700,
          s.vsize_800,
          s.vsize_900,
          s.vsize_1000,
          s.vsize_1200,
          s.vsize_1400,
          s.vsize_1600,
          s.vsize_1800,
          s.vsize_2000,
        ]
      };
    });
  }

  public mapOptimizedStatisticToStatistic(statistic: OptimizedStatistic[]): Statistic[] {
    return statistic.map((s) => {
      return {
        added: s.added,
        unconfirmed_transactions: s.count,
        tx_per_second: 0,
        vbytes_per_second: s.vbytes_per_second,
        mempool_byte_weight: s.mempool_byte_weight || 0,
        total_fee: s.total_fee || 0,
        min_fee: s.min_fee,
        fee_data: '',
        vsize_1: s.vsizes[0],
        vsize_2: s.vsizes[1],
        vsize_3: s.vsizes[2],
        vsize_4: s.vsizes[3],
        vsize_5: s.vsizes[4],
        vsize_6: s.vsizes[5],
        vsize_8: s.vsizes[6],
        vsize_10: s.vsizes[7],
        vsize_12: s.vsizes[8],
        vsize_15: s.vsizes[9],
        vsize_20: s.vsizes[10],
        vsize_30: s.vsizes[11],
        vsize_40: s.vsizes[12],
        vsize_50: s.vsizes[13],
        vsize_60: s.vsizes[14],
        vsize_70: s.vsizes[15],
        vsize_80: s.vsizes[16],
        vsize_90: s.vsizes[17],
        vsize_100: s.vsizes[18],
        vsize_125: s.vsizes[19],
        vsize_150: s.vsizes[20],
        vsize_175: s.vsizes[21],
        vsize_200: s.vsizes[22],
        vsize_250: s.vsizes[23],
        vsize_300: s.vsizes[24],
        vsize_350: s.vsizes[25],
        vsize_400: s.vsizes[26],
        vsize_500: s.vsizes[27],
        vsize_600: s.vsizes[28],
        vsize_700: s.vsizes[29],
        vsize_800: s.vsizes[30],
        vsize_900: s.vsizes[31],
        vsize_1000: s.vsizes[32],
        vsize_1200: s.vsizes[33],
        vsize_1400: s.vsizes[34],
        vsize_1600: s.vsizes[35],
        vsize_1800: s.vsizes[36],
        vsize_2000: s.vsizes[37],
      }
    });
  }
}

export default new StatisticsApi();
