import axios from 'axios';
import { Application, Request, Response } from 'express';
import config from '../../config';
import elementsParser from './elements-parser';
import icons from './icons';
import { handleError } from '../../utils/api';

class LiquidRoutes {
  public initRoutes(app: Application) {
    app
      .get(config.MEMPOOL.API_URL_PREFIX + 'assets/icons', this.getAllLiquidIcon)
      .get(config.MEMPOOL.API_URL_PREFIX + 'assets/featured', this.$getAllFeaturedLiquidAssets)
      .get(config.MEMPOOL.API_URL_PREFIX + 'asset/:assetId/icon', this.getLiquidIcon)
      .get(config.MEMPOOL.API_URL_PREFIX + 'assets/group/:id', this.$getAssetGroup)
      ;
    
    if (config.DATABASE.ENABLED) {
      app
        .get(config.MEMPOOL.API_URL_PREFIX + 'liquid/pegs', this.$getElementsPegs)
        .get(config.MEMPOOL.API_URL_PREFIX + 'liquid/pegs/month', this.$getElementsPegsByMonth)
        .get(config.MEMPOOL.API_URL_PREFIX + 'liquid/pegs/list/:count', this.$getPegsList)
        .get(config.MEMPOOL.API_URL_PREFIX + 'liquid/pegs/volume', this.$getPegsVolumeDaily)
        .get(config.MEMPOOL.API_URL_PREFIX + 'liquid/pegs/count', this.$getPegsCount)
        .get(config.MEMPOOL.API_URL_PREFIX + 'liquid/reserves', this.$getFederationReserves)
        .get(config.MEMPOOL.API_URL_PREFIX + 'liquid/reserves/month', this.$getFederationReservesByMonth)
        .get(config.MEMPOOL.API_URL_PREFIX + 'liquid/reserves/addresses', this.$getFederationAddresses)
        .get(config.MEMPOOL.API_URL_PREFIX + 'liquid/reserves/addresses/total', this.$getFederationAddressesNumber)
        .get(config.MEMPOOL.API_URL_PREFIX + 'liquid/reserves/utxos', this.$getFederationUtxos)
        .get(config.MEMPOOL.API_URL_PREFIX + 'liquid/reserves/utxos/total', this.$getFederationUtxosNumber)
        .get(config.MEMPOOL.API_URL_PREFIX + 'liquid/reserves/utxos/expired', this.$getExpiredUtxos)
        .get(config.MEMPOOL.API_URL_PREFIX + 'liquid/reserves/utxos/emergency-spent', this.$getEmergencySpentUtxos)
        .get(config.MEMPOOL.API_URL_PREFIX + 'liquid/reserves/utxos/emergency-spent/stats', this.$getEmergencySpentUtxosStats)
        .get(config.MEMPOOL.API_URL_PREFIX + 'liquid/reserves/status', this.$getFederationAuditStatus)
        ;
    }
  }


  private getLiquidIcon(req: Request, res: Response) {
    const result = icons.getIconByAssetId(req.params.assetId);
    if (result) {
      res.setHeader('content-type', 'image/png');
      res.setHeader('content-length', result.length);
      res.send(result);
    } else {
      handleError(req, res, 404, 'Asset icon not found');
    }
  }

  private getAllLiquidIcon(req: Request, res: Response) {
    const result = icons.getAllIconIds();
    if (result) {
      res.json(result);
    } else {
      handleError(req, res, 404, 'Asset icons not found');
    }
  }

  private async $getAllFeaturedLiquidAssets(req: Request, res: Response) {
    try {
      const response = await axios.get(`${config.EXTERNAL_DATA_SERVER.LIQUID_API}/assets/featured`, { responseType: 'stream', timeout: 10000 });
      response.data.pipe(res);
    } catch (e) {
      res.status(500).end();
    }
  }

  private async $getAssetGroup(req: Request, res: Response) {
    try {
      const response = await axios.get(`${config.EXTERNAL_DATA_SERVER.LIQUID_API}/assets/group/${parseInt(req.params.id, 10)}`,
        { responseType: 'stream', timeout: 10000 });
      response.data.pipe(res);
    } catch (e) {
      res.status(500).end();
    }
  }

  private async $getElementsPegsByMonth(req: Request, res: Response) {
    try {
      const pegs = await elementsParser.$getPegDataByMonth();
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 60 * 60).toUTCString());
      res.json(pegs);
    } catch (e) {
      handleError(req, res, 500, 'Failed to get pegs by month');
    }
  }

  private async $getFederationReservesByMonth(req: Request, res: Response) {
    try {
      const reserves = await elementsParser.$getFederationReservesByMonth();
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 60 * 60).toUTCString());
      res.json(reserves);
    } catch (e) {
      handleError(req, res, 500, 'Failed to get reserves by month');
    }
  }

  private async $getElementsPegs(req: Request, res: Response) {
    try {
      const currentSupply = await elementsParser.$getCurrentLbtcSupply();
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 30).toUTCString());
      res.json(currentSupply);
    } catch (e) {
      handleError(req, res, 500, 'Failed to get pegs');
    }
  }

  private async $getFederationReserves(req: Request, res: Response) {
    try {
      const currentReserves = await elementsParser.$getCurrentFederationReserves();
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 30).toUTCString());
      res.json(currentReserves);
    } catch (e) {
      handleError(req, res, 500, 'Failed to get reserves');
    }
  }

  private async $getFederationAuditStatus(req: Request, res: Response) {
    try {
      const auditStatus = await elementsParser.$getAuditStatus();
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 30).toUTCString());
      res.json(auditStatus);
    } catch (e) {
      handleError(req, res, 500, 'Failed to get federation audit status');
    }
  }

  private async $getFederationAddresses(req: Request, res: Response) {
    try {
      const federationAddresses = await elementsParser.$getFederationAddresses();
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 30).toUTCString());
      res.json(federationAddresses);
    } catch (e) {
      handleError(req, res, 500, 'Failed to get federation addresses');
    }
  }

  private async $getFederationAddressesNumber(req: Request, res: Response) {
    try {
      const federationAddresses = await elementsParser.$getFederationAddressesNumber();
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 30).toUTCString());
      res.json(federationAddresses);
    } catch (e) {
      handleError(req, res, 500, 'Failed to get federation addresses');
    }
  }

  private async $getFederationUtxos(req: Request, res: Response) {
    try {
      const federationUtxos = await elementsParser.$getFederationUtxos();
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 30).toUTCString());
      res.json(federationUtxos);
    } catch (e) {
      handleError(req, res, 500, 'Failed to get federation utxos');
    }
  }

  private async $getExpiredUtxos(req: Request, res: Response) {
    try {
      const expiredUtxos = await elementsParser.$getExpiredUtxos();
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 30).toUTCString());
      res.json(expiredUtxos);
    } catch (e) {
      handleError(req, res, 500, 'Failed to get expired utxos');
    }
  }

  private async $getFederationUtxosNumber(req: Request, res: Response) {
    try {
      const federationUtxos = await elementsParser.$getFederationUtxosNumber();
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 30).toUTCString());
      res.json(federationUtxos);
    } catch (e) {
      handleError(req, res, 500, 'Failed to get federation utxos number');
    }
  }

  private async $getEmergencySpentUtxos(req: Request, res: Response) {
    try {
      const emergencySpentUtxos = await elementsParser.$getEmergencySpentUtxos();
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 30).toUTCString());
      res.json(emergencySpentUtxos);
    } catch (e) {
      handleError(req, res, 500, 'Failed to get emergency spent utxos');
    }
  }

  private async $getEmergencySpentUtxosStats(req: Request, res: Response) {
    try {
      const emergencySpentUtxos = await elementsParser.$getEmergencySpentUtxosStats();
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 30).toUTCString());
      res.json(emergencySpentUtxos);
    } catch (e) {
      handleError(req, res, 500, 'Failed to get emergency spent utxos stats');
    }
  }

  private async $getPegsList(req: Request, res: Response) {
    try {
      const recentPegs = await elementsParser.$getPegsList(parseInt(req.params?.count));
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 30).toUTCString());
      res.json(recentPegs);
    } catch (e) {
      handleError(req, res, 500, 'Failed to get pegs list');
    }
  }

  private async $getPegsVolumeDaily(req: Request, res: Response) {
    try {
      const pegsVolume = await elementsParser.$getPegsVolumeDaily();
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 30).toUTCString());
      res.json(pegsVolume);
    } catch (e) {
      handleError(req, res, 500, 'Failed to get pegs volume daily');
    }
  }

  private async $getPegsCount(req: Request, res: Response) {
    try {
      const pegsCount = await elementsParser.$getPegsCount();
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 30).toUTCString());
      res.json(pegsCount);
    } catch (e) {
      handleError(req, res, 500, 'Failed to get pegs count');
    }
  }

}

export default new LiquidRoutes();
