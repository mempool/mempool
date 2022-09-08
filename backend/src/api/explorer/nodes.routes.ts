import config from '../../config';
import { Application, Request, Response } from 'express';
import nodesApi from './nodes.api';
import DB from '../../database';
import { INodesRanking } from '../../mempool.interfaces';

class NodesRoutes {
  constructor() { }

  public initRoutes(app: Application) {
    app
      .get(config.MEMPOOL.API_URL_PREFIX + 'lightning/nodes/world', this.$getWorldNodes)
      .get(config.MEMPOOL.API_URL_PREFIX + 'lightning/nodes/country/:country', this.$getNodesPerCountry)
      .get(config.MEMPOOL.API_URL_PREFIX + 'lightning/nodes/search/:search', this.$searchNode)
      .get(config.MEMPOOL.API_URL_PREFIX + 'lightning/nodes/isp-ranking', this.$getISPRanking)
      .get(config.MEMPOOL.API_URL_PREFIX + 'lightning/nodes/isp/:isp', this.$getNodesPerISP)
      .get(config.MEMPOOL.API_URL_PREFIX + 'lightning/nodes/countries', this.$getNodesCountries)
      .get(config.MEMPOOL.API_URL_PREFIX + 'lightning/nodes/rankings', this.$getNodesRanking)
      .get(config.MEMPOOL.API_URL_PREFIX + 'lightning/nodes/rankings/liquidity', this.$getTopNodesByCapacity)
      .get(config.MEMPOOL.API_URL_PREFIX + 'lightning/nodes/rankings/connectivity', this.$getTopNodesByChannels)
      .get(config.MEMPOOL.API_URL_PREFIX + 'lightning/nodes/rankings/age', this.$getOldestNodes)
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
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 60).toUTCString());
      res.json(node);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async $getHistoricalNodeStats(req: Request, res: Response) {
    try {
      const statistics = await nodesApi.$getNodeStats(req.params.public_key);
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 60).toUTCString());
      res.json(statistics);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async $getNodesRanking(req: Request, res: Response): Promise<void> {
    try {
      const topCapacityNodes = await nodesApi.$getTopCapacityNodes(false);
      const topChannelsNodes = await nodesApi.$getTopChannelsNodes(false);
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 60).toUTCString());
      res.json(<INodesRanking>{
        topByCapacity: topCapacityNodes,
        topByChannels: topChannelsNodes,
      });
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async $getTopNodesByCapacity(req: Request, res: Response): Promise<void> {
    try {
      const topCapacityNodes = await nodesApi.$getTopCapacityNodes(true);
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 60).toUTCString());
      res.json(topCapacityNodes);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async $getTopNodesByChannels(req: Request, res: Response): Promise<void> {
    try {
      const topCapacityNodes = await nodesApi.$getTopChannelsNodes(true);
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 60).toUTCString());
      res.json(topCapacityNodes);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async $getOldestNodes(req: Request, res: Response): Promise<void> {
    try {
      const topCapacityNodes = await nodesApi.$getOldestNodes(true);
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 60).toUTCString());
      res.json(topCapacityNodes);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async $getISPRanking(req: Request, res: Response): Promise<void> {
    try {
      const nodesPerAs = await nodesApi.$getNodesISPRanking();
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 600).toUTCString());
      res.json(nodesPerAs);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async $getWorldNodes(req: Request, res: Response) {
    try {
      const worldNodes = await nodesApi.$getWorldNodes();
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 600).toUTCString());
      res.json(worldNodes);
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

  private async $getNodesPerISP(req: Request, res: Response) {
    try {
      const [isp]: any[] = await DB.query(
        `SELECT geo_names.names as isp_name
        FROM geo_names
        WHERE geo_names.type = 'as_organization' AND geo_names.id = ?`,
        [req.params.isp]
      );

      if (isp.length === 0) {
        res.status(404).send(`This ISP does not exist or does not host any lightning nodes on clearnet`);
        return;
      }

      const nodes = await nodesApi.$getNodesPerISP(req.params.isp);
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 60).toUTCString());
      res.json({
        isp: JSON.parse(isp[0].isp_name),
        nodes: nodes,
      });
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async $getNodesCountries(req: Request, res: Response) {
    try {
      const nodesPerAs = await nodesApi.$getNodesCountries();
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 600).toUTCString());
      res.json(nodesPerAs);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }
}

export default new NodesRoutes();
