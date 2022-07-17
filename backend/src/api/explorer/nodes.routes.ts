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
      const [country]: any[] = await DB.query(
        `SELECT geo_names.id, geo_names_country.names as country_names
        FROM geo_names
        JOIN geo_names geo_names_country on geo_names.id = geo_names_country.id AND geo_names_country.type = 'country'
        WHERE geo_names.type = 'country_iso_code' AND geo_names.names = ?`,
        [req.params.country]
      );

      if (country.length === 0) {
        res.status(404).send(`This country does not exist or does not host any lightning nodes on clearnet`);
        return;
      }

      const nodes = await nodesApi.$getNodesPerCountry(country[0].id);
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 60).toUTCString());
      res.json({
        country: JSON.parse(country[0].country_names),
        nodes: nodes,
      });
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }
}

export default new NodesRoutes();
