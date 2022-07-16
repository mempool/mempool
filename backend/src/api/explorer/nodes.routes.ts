import config from '../../config';
import { Application, Request, Response } from 'express';
import nodesApi from './nodes.api';
import DB from '../../database';

class NodesRoutes {
  constructor() { }

  public initRoutes(app: Application) {
    app
      .get(config.MEMPOOL.API_URL_PREFIX + 'lightning/nodes/country/:country', this.$getNodesPerCountry)
      .get(config.MEMPOOL.API_URL_PREFIX + 'lightning/nodes/search/:search', this.$searchNode)
      .get(config.MEMPOOL.API_URL_PREFIX + 'lightning/nodes/top', this.$getTopNodes)
      .get(config.MEMPOOL.API_URL_PREFIX + 'lightning/nodes/asShare', this.$getNodesAsShare)
      .get(config.MEMPOOL.API_URL_PREFIX + 'lightning/nodes/:public_key/statistics', this.$getHistoricalNodeStats)
      .get(config.MEMPOOL.API_URL_PREFIX + 'lightning/nodes/:public_key', this.$getNode)
    ;
  }

  private async $searchNode(req: Request, res: Response) {
    try {
      const nodes = await nodesApi.$searchNodeByPublicKeyOrAlias(req.params.search);
      res.json(nodes);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async $getNode(req: Request, res: Response) {
    try {
      const node = await nodesApi.$getNode(req.params.public_key);
      if (!node) {
        res.status(404).send('Node not found');
        return;
      }
      res.json(node);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async $getHistoricalNodeStats(req: Request, res: Response) {
    try {
      const statistics = await nodesApi.$getNodeStats(req.params.public_key);
      res.json(statistics);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async $getTopNodes(req: Request, res: Response) {
    try {
      const topCapacityNodes = await nodesApi.$getTopCapacityNodes();
      const topChannelsNodes = await nodesApi.$getTopChannelsNodes();
      res.json({
        topByCapacity: topCapacityNodes,
        topByChannels: topChannelsNodes,
      });
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async $getNodesAsShare(req: Request, res: Response) {
    try {
      const nodesPerAs = await nodesApi.$getNodesAsShare();
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 600).toUTCString());
      res.json(nodesPerAs);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async $getNodesPerCountry(req: Request, res: Response) {
    try {
      const [countryName]: any[] = await DB.query(`SELECT names FROM geo_names WHERE LOWER(JSON_EXTRACT(geo_names.names, '$.en')) = ?`,
        [`"${req.params.country}"`]);

      if (countryName.length === 0) {
        res.status(404).send(`This country does not exists`);
        return;
      }

      const nodes = await nodesApi.$getNodesPerCountry(req.params.country.toLowerCase());
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 60).toUTCString());
      res.json({
        country: JSON.parse(countryName[0].names),
        nodes: nodes,
      });
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }
}

export default new NodesRoutes();
