import * as fs from 'fs';
import logger from '../../logger';

class Icons {
  private static FILE_NAME = '/elements/asset_registry_db/icons.json';
  private iconIds: string[] = [];
  private icons: { [assetId: string]: string; } = {};

  constructor() {}

  public loadIcons() {
    if (!fs.existsSync(Icons.FILE_NAME)) {
      logger.warn(`${Icons.FILE_NAME} does not exist. No Liquid icons loaded.`);
      return;
    }
    const cacheData = fs.readFileSync(Icons.FILE_NAME, 'utf8');
    this.icons = JSON.parse(cacheData);

    for (const i in this.icons) {
      this.iconIds.push(i);
    }
    logger.debug(`Liquid icons has been loaded.`);
  }

  public getIconByAssetId(assetId: string): Buffer | undefined {
    const icon = this.icons[assetId];
    if (icon) {
      return Buffer.from(icon, 'base64');
    }
  }

  public getAllIconIds() {
    return this.iconIds;
  }

}

export default new Icons();
