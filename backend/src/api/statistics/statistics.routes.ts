import { Application, Request, Response } from 'express';
import config from '../../config';
import statisticsApi from './statistics-api';
import { handleError } from '../../utils/api';
class StatisticsRoutes {
  public initRoutes(app: Application) {
    app
      .get(config.MEMPOOL.API_URL_PREFIX + 'statistics/2h', this.$getStatisticsByTime.bind(this, '2h'))
      .get(config.MEMPOOL.API_URL_PREFIX + 'statistics/24h', this.$getStatisticsByTime.bind(this, '24h'))
      .get(config.MEMPOOL.API_URL_PREFIX + 'statistics/1w', this.$getStatisticsByTime.bind(this, '1w'))
      .get(config.MEMPOOL.API_URL_PREFIX + 'statistics/1m', this.$getStatisticsByTime.bind(this, '1m'))
      .get(config.MEMPOOL.API_URL_PREFIX + 'statistics/3m', this.$getStatisticsByTime.bind(this, '3m'))
      .get(config.MEMPOOL.API_URL_PREFIX + 'statistics/6m', this.$getStatisticsByTime.bind(this, '6m'))
      .get(config.MEMPOOL.API_URL_PREFIX + 'statistics/1y', this.$getStatisticsByTime.bind(this, '1y'))
      .get(config.MEMPOOL.API_URL_PREFIX + 'statistics/2y', this.$getStatisticsByTime.bind(this, '2y'))
      .get(config.MEMPOOL.API_URL_PREFIX + 'statistics/3y', this.$getStatisticsByTime.bind(this, '3y'))
      .get(config.MEMPOOL.API_URL_PREFIX + 'statistics/4y', this.$getStatisticsByTime.bind(this, '4y'))
      .get(config.MEMPOOL.API_URL_PREFIX + 'statistics/all', this.$getStatisticsByTime.bind(this, 'all'))
    ;
  }

  private async $getStatisticsByTime(time: '2h' | '24h' | '1w' | '1m' | '3m' | '6m' | '1y' | '2y' | '3y' | '4y' | 'all', req: Request, res: Response) {
    res.header('Pragma', 'public');
    res.header('Cache-control', 'public');
    res.setHeader('Expires', new Date(Date.now() + 1000 * 300).toUTCString());

    try {
      let result;
      switch (time as string) {
        case '24h':
          result = await statisticsApi.$list24H();
          res.setHeader('Expires', new Date(Date.now() + 1000 * 60).toUTCString());
          break;
        case '1w':
          result = await statisticsApi.$list1W();
          break;
        case '1m':
          result = await statisticsApi.$list1M();
          break;
        case '3m':
          result = await statisticsApi.$list3M();
          break;
        case '6m':
          result = await statisticsApi.$list6M();
          break;
        case '1y':
          result = await statisticsApi.$list1Y();
          break;
        case '2y':
          result = await statisticsApi.$list2Y();
          break;
        case '3y':
          result = await statisticsApi.$list3Y();
          break;
        case '4y':
          result = await statisticsApi.$list4Y();
          break;
        case 'all':
          result = await statisticsApi.$listAll();
          break;
        default:
          result = await statisticsApi.$list2H();
          res.setHeader('Expires', new Date(Date.now() + 1000 * 30).toUTCString());
          break;
      }
      res.json(result);
    } catch (e) {
      handleError(req, res, 500, 'Failed to get statistics');
    }
  }
}

export default new StatisticsRoutes();
