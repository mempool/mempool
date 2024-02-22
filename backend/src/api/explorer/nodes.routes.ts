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
      .get(config.MEMPOOL.API_URL_PREFIX + 'lightning/nodes/:public_key/fees/histogram', this.$getFeeHistogram)
      .get(config.MEMPOOL.API_URL_PREFIX + 'lightning/nodes/:public_key', this.$getNode)
      .get(config.MEMPOOL.API_URL_PREFIX + 'lightning/nodes/group/:name', this.$getNodeGroup)
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

  private async $getNodeGroup(req: Request, res: Response) {
    try {
      let nodesList;
      let nodes: any[] = [];
      switch (config.MEMPOOL.NETWORK) {
        case 'testnet':
          nodesList = [
            '0259db43b4e4ac0ff12a805f2d81e521253ba2317f6739bc611d8e2fa156d64256',
            '0352b9944b9a52bd2116c91f1ba70c4ef851ac5ba27e1b20f1d92da3ade010dd10',
            '03424f5a7601eaa47482cb17100b31a84a04d14fb44b83a57eeceffd8e299878e3',
            '032850492ee61a5f7006a2fda6925e4b4ec3782f2b6de2ff0e439ef5a38c3b2470',
            '022c80bace98831c44c32fb69755f2b353434e0ee9e7fbda29507f7ef8abea1421',
            '02c3559c833e6f99f9ca05fe503e0b4e7524dea9121344edfd3e811101e0c28680',
            '032c7c7819276c4f706a04df1a0f1e10a5495994a7be4c1d3d28ca766e5a2b957b',
            '025a7e38c2834dd843591a4d23d5f09cdeb77ddca85f673c2d944a14220ff14cf7',
            '0395e2731a1673ef21d7a16a727c4fc4d4c35a861c428ce2c819c53d2b81c8bd55',
            '032ab2028c0b614c6d87824e2373529652fd7e4221b4c70cc4da7c7005c49afcf0',
            '029001b22fe70b48bee12d014df91982eb85ff1bd404ec772d5c83c4ee3e88d2c3',
            '0212e2848d79f928411da5f2ff0a8c95ec6ccb5a09d2031b6f71e91309dcde63af',
            '03e871a2229523d34f76e6311ff197cfe7f26c2fbec13554b93a46f4e710c47dab',
            '032202ec98d976b0e928bd1d91924e8bd3eab07231fc39feb3737b010071073df8',
            '02fa7c5a948d03d563a9f36940c2205a814e594d17c0042ced242c71a857d72605',
            '039c14fdec2d958e3d14cebf657451bbd9e039196615785e82c917f274e3fb2205',
            '033589bbcb233ffc416cefd5437c7f37e9d7cb7942d405e39e72c4c846d9b37f18',
            '029293110441c6e2eacb57e1255bf6ef05c41a6a676fe474922d33c19f98a7d584',
            '0235ad0b56ed8c42c4354444c24e971c05e769ec0b5fb0ccea42880095dc02ea2c',
            '029700819a37afea630f80e6cc461f3fd3c4ace2598a21cfbbe64d1c78d0ee69a5',
            '02c2d8b2dbf87c7894af2f1d321290e2fe6db5446cd35323987cee98f06e2e0075',
            '030b0ca1ea7b1075716d2a555630e6fd47ef11bc7391fe68963ec06cf370a5e382',
            '031adb9eb2d66693f85fa31a4adca0319ba68219f3ad5f9a2ef9b34a6b40755fa1',
            '02ccd07faa47eda810ecf5591ccf5ca50f6c1034d0d175052898d32a00b9bae24f',
          ];
          break;
        case 'signet':
          nodesList = [
            '029fe3621fc0c6e08056a14b868f8fb9acca1aa28a129512f6cea0f0d7654d9f92',
            '02f60cd7a3a4f1c953dd9554a6ebd51a34f8b10b8124b7fc43a0b381139b55c883',
            '03cbbf581774700865eebd1be42d022bc004ba30881274ab304e088a25d70e773d',
            '0243348cb3741cfe2d8485fa8375c29c7bc7cbb67577c363cb6987a5e5fd0052cc',
            '02cb73e631af44bee600d80f8488a9194c9dc5c7590e575c421a070d1be05bc8e9',
            '0306f55ee631aa1e2cd4d9b2bfcbc14404faec5c541cef8b2e6f779061029d09c4',
            '03ddab321b760433cbf561b615ef62ac7d318630c5f51d523aaf5395b90b751956',
            '033d92c7bfd213ef1b34c90e985fb5dc77f9ec2409d391492484e57a44c4aca1de',
            '02ad010dda54253c1eb9efe38b0760657a3b43ecad62198c359c051c9d99d45781',
            '025196512905b8a3f1597428b867bec63ec9a95e5089eb7dc7e63e2d2691669029',
            '027c625aa1fbe3768db68ebcb05b53b6dc0ce68b7b54b8900d326d167363e684fe',
            '03f1629af3101fcc56b7aac2667016be84e3defbf3d0c8719f836c9b41c9a57a43',
            '02dfb81e2f7a3c4c9e8a51b70ef82b4a24549cc2fab1f5b2fd636501774a918991',
            '02d01ccf832944c68f10d39006093769c5b8bda886d561b128534e313d729fdb34',
            '02499ed23027d4698a6904ff4ec1b6085a61f10b9a6937f90438f9947e38e8ea86',
            '038310e3a786340f2bd7770704c7ccfe560fd163d9a1c99d67894597419d12cbf7',
            '03e5e9d879b72c7d67ecd483bae023bd33e695bb32b981a4021260f7b9d62bc761',
            '028d16e1a0ace4c0c0a421536d8d32ce484dfe6e2f726b7b0e7c30f12a195f8cc7',
            '02ff690d06c187ab994bf83c5a2114fe5bf50112c2c817af0f788f736be9fa2070',
            '02a9f570c51a2526a5ee85802e88f9281bed771eb66a0c8a7d898430dd5d0eae45',
            '038c3de773255d3bd7a50e31e58d423baac5c90826a74d75e64b74c95475de1097',
            '0242c7f7d315095f37ad1421ae0a2fc967d4cbe65b61b079c5395a769436959853',
            '02a909e70eb03742f12666ebb1f56ac42a5fbaab0c0e8b5b1df4aa9f10f8a09240',
            '03a26efa12489803c07f3ac2f1dba63812e38f0f6e866ce3ebb34df7de1f458cd2',
          ];
          break;
        default:
          nodesList = [
            '02b12b889fe3c943cb05645921040ef13d6d397a2e7a4ad000e28500c505ff26d6',
            '0302240ac9d71b39617cbde2764837ec3d6198bd6074b15b75d2ff33108e89d2e1',
            '03364a8ace313376e5e4b68c954e287c6388e16df9e9fdbaf0363ecac41105cbf6',
            '03229ab4b7f692753e094b93df90530150680f86b535b5183b0cffd75b3df583fc',
            '03a696eb7acde991c1be97a58a9daef416659539ae462b897f5e9ae361f990228e',
            '0248bf26cf3a63ab8870f34dc0ec9e6c8c6288cdba96ba3f026f34ec0f13ac4055',
            '03fbc17549ec667bccf397ababbcb4cdc0e3394345e4773079ab2774612ec9be61',
            '03da9a8623241ccf95f19cd645c6cecd4019ac91570e976eb0a128bebbc4d8a437',
            '03ca5340cf85cb2e7cf076e489f785410838de174e40be62723e8a60972ad75144',
            '0238bd27f02d67d6c51e269692bc8c9a32357a00e7777cba7f4f1f18a2a700b108',
            '03f983dcabed6baa1eab5b56c8b2e8fdc846ab3fd931155377897335e85a9fa57c',
            '03e399589533581e48796e29a825839a010036a61b20744fda929d6709fcbffcc5',
            '021f5288b5f72c42cd0d8801086af7ce09a816d8ee9a4c47a4b436399b26cb601a',
            '032b01b7585f781420cd4148841a82831ba37fa952342052cec16750852d4f2dd9',
            '02848036488d4b8fb1f1c4064261ec36151f43b085f0b51bd239ade3ddfc940c34',
            '02b6b1640fe029e304c216951af9fbefdb23b0bdc9baaf327540d31b6107841fdf',
            '03694289827203a5b3156d753071ddd5bf92e371f5a462943f9555eef6d2d6606c',
            '0283d850db7c3e8ea7cc9c4abc7afaab12bbdf72b677dcba1d608350d2537d7d43',
            '02521287789f851268a39c9eccc9d6180d2c614315b583c9e6ae0addbd6d79df06',
            '0258c2a7b7f8af2585b4411b1ec945f70988f30412bb1df179de941f14d0b1bc3e',
            '03c3389ff1a896f84d921ed01a19fc99c6724ce8dc4b960cd3b7b2362b62cd60d7',
            '038d118996b3eaa15dcd317b32a539c9ecfdd7698f204acf8a087336af655a9192',
            '02a928903d93d78877dacc3642b696128a3636e9566dd42d2d132325b2c8891c09',
            '0328cd17f3a9d3d90b532ade0d1a67e05eb8a51835b3dce0a2e38eac04b5a62a57',
          ];
      }

      for (let pubKey of nodesList) {
        try {
          const node = await nodesApi.$getNode(pubKey);
          if (node) {
            nodes.push(node);
          }
        } catch (e) {}
      }
      
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 60).toUTCString());
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

  private async $getFeeHistogram(req: Request, res: Response) {
    try {
      const node = await nodesApi.$getFeeHistogram(req.params.public_key);
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
