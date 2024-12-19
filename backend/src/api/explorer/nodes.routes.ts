import config from '../../config';
import { Application, Request, Response } from 'express';
import nodesApi from './nodes.api';
import DB from '../../database';
import { INodesRanking } from '../../mempool.interfaces';
import { handleError } from '../../utils/api';

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
      handleError(req, res, 500, 'Failed to search for node');
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
            '02b36a324fa2dd3af2a63ac65f241907882829bed5002b4e14171d25c219e0d470',
            '0231b6e8f21f9f6c057f6bf8a812f79e396ee16a66ece91939a1576ce9fb9e87a5',
            '034b6aac206bffcbd651b7ead1ab8a0991c945dfafe19ff27dcdeadc6843ebd15c',
            '039c065f7e344acd969ebdd4a94550915b6f24e8782ae2be540bb96c8a4fcfb86b',
            '03d9f9f4803fc75920f14dd13d83fbecc53229a65d4ee4cd2d86fdf211f7337576',
            '0357fe48c4dece744f70865eda66e396aab5d05e09e1145cd3b7da83f11446d4cf',
            '02bca4d642eda631f2c8659758e2a2868e518b93503f2bfcd767749c6530a10679',
            '03f32c99c0bb9f62dae53671d1d300565773455248f34134cc02779b881561174e',
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
            '038eb09bed4532ff36d12acc1279f55cbe8d95212d19f809e057bb50de00051fba',
            '027b7c0278366a0268e8bd0072b14539f6cb455a7bd588ae22d888bed541f65311',
            '02f4dd78f6eda8838029b2cdbaaea6e875e2fa373cd348ee41a7c1bb177d3fca66',
            '036b3fb692da214a3edaac5b67903b958f5ccd8712e09aa61b67ea7acfd94b40c2',
            '023bc8915d308e0b65f8de6867f95960141372436fce3edad5cec3f364d6ac948f',
            '0341690503ef21d0e203dddd9e62646380d0dfc32c499e055e7f698b9064d1c736',
            '0355d573805c018a37a5b2288378d70e9b5b438f7394abd6f467cb9b47c90eeb93',
            '0361aa68deb561a8b47b41165848edcccb98a1b56a5ea922d9d5b30a09bb7282ea',
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
            '030bbbd8495561a894e301fe6ba5b22f8941fc661cc0e673e0206158231d8ac130',
            '03ee1f08e516ed083475f39c6cae4fa1eec686d004d2f105218269e27d7f2da5a4',
            '028c378b998f476ed22d6815c170dd2a3388a43fdf791a7cff70b9997349b8447a',
            '036f19f044d19cb1b04f14d91b6e7e5443ce337217a8c14d43861f3e86dd07bd7f',
            '03058d61869e8b88436493648b2e3e530627edf5a0b253c285cd565c1477a5c237',
            '0279dfedc87b47a941f1797f2c422c03aa3108914ea6b519d76537d60860535a9a',
            '0353486b8016761e58ec8aee7305ee58d5dc66b55ef5bd8cbaf49508f66d52d62e',
            '03df5db8eccfabcae47ff15553cfdecb2d3f56979f43a0c3578f28d056b5e35104',
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
            '0326cf9a4ca67a5b9cdffae57293dbd6f7c5113b93010dc6f6fe4af3afde1a1739',
            '034867e16f62cebb8c2c2c22b91117c173bbece9c8a1e5bd001374a3699551cd8f',
            '038dfb1f1b637a8c27e342ffc6f9feca20e0b47be3244e09ae78df4998e2ae83b9',
            '03cb1cea3394d973355c11bc61c2f689f9d3e1c3db60d205f27770f5ad83200f77',
            '03535447b592cbdb153189b3e06a455452b1011380cb3e6511a31090c15d8efc9f',
            '028e90e9984d262ebfa3c23fb3f335a2ae061a0bdedee03f45f72b438d9e7d2ce3',
            '03ee0176289dc4a6111fa5ef22eed5273758c420fbe58cc1d2d76def75dd7e640c',
            '0370b2cd9f0eaf436d5c25c93fb39210d8cc06b31f688fc2f54418aabe394aed79',
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
            '021b28ecdd782fd909705d6be354db268977b1a2ac5a5275186fc19e08bb8fca93',
            '031bec1fbd8eb7fe94d2bda108c9c3cc8c22ecfc1c3a5c11d36f5881b01b4a81a6',
            '03879c4f827a3188574d5757e002f574265a966d70aea942169785b31369b067d5',
            '0228d4b5a4fd73a03967b76f8b8cb37b9d0b6e7039126a9397bb732c15bed78e9b',
            '03f58dbb629f4427f5a1dbc02e6a7ec79345fdf13a0e4163d4f3b7aea2539cf095',
            '021cdcb8123aa670cdfc9f43909dbb297363c093883409e9e7fc82e7267f7c72bd',
            '02f2aa2c2b7b432a70dc4d0b04afa19d48715ed3b90594d49c1c8744f2e9ebb030',
            '03709a02fb3ab4857689a8ea0bd489a6ab6f56f8a397be578bc6d5ad22efbe3756',
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
            '03b4dda7878d3b7b71ecd6d4738322c7f9a9c1fb583374d2724f4ccc4947f37570',
            '0279a35f05b5acf159429549e56fd426685c4fec191431c58738968bbc77a39f25',
            '03cb102d796ddcf08610cd03fae8b7a1df69ff48e9e8a152af315f9edf71762eb8',
            '036b89526f4d5ac4c317f4fd23cb9f8e4ad844498bc7950a41114d060101d995d4',
            '0313eade145959d7036db009fd5b0bf1947a739c7c3c790b491ec9161b94e6ad1e',
            '02b670ca4c4bb2c5ea89c3b691da98a194cfc48fcd5c072df02a20290bddd60610',
            '02a9196d5e08598211397a83cf013a5962b84bd61198abfdd204dff987e54f7a0d',
            '036d015cd2f486fb38348182980b7e596e6c9733873102ea126fed7b4152be03b8',
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
      handleError(req, res, 500, 'Failed to get node group');
    }
  }

  private async $getNode(req: Request, res: Response) {
    try {
      const node = await nodesApi.$getNode(req.params.public_key);
      if (!node) {
        handleError(req, res, 404, 'Node not found');
        return;
      }
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 60).toUTCString());
      res.json(node);
    } catch (e) {
      handleError(req, res, 500, 'Failed to get node');
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
      handleError(req, res, 500, 'Failed to get historical node stats');
    }
  }

  private async $getFeeHistogram(req: Request, res: Response) {
    try {
      const node = await nodesApi.$getFeeHistogram(req.params.public_key);
      if (!node) {
        handleError(req, res, 404, 'Node not found');
        return;
      }
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 60).toUTCString());
      res.json(node);
    } catch (e) {
      handleError(req, res, 500, 'Failed to get fee histogram');
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
      handleError(req, res, 500, 'Failed to get nodes ranking');
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
      handleError(req, res, 500, 'Failed to get top nodes by capacity');
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
      handleError(req, res, 500, 'Failed to get top nodes by channels');
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
      handleError(req, res, 500, 'Failed to get oldest nodes');
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
      handleError(req, res, 500, 'Failed to get ISP ranking');
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
      handleError(req, res, 500, 'Failed to get world nodes');
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
        handleError(req, res, 404, `This country does not exist or does not host any lightning nodes on clearnet`);
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
      handleError(req, res, 500, 'Failed to get nodes per country');
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
        handleError(req, res, 404, `This ISP does not exist or does not host any lightning nodes on clearnet`);
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
      handleError(req, res, 500, 'Failed to get nodes per ISP');
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
      handleError(req, res, 500, 'Failed to get nodes per country');
    }
  }
}

export default new NodesRoutes();
