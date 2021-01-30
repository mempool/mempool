import config from '../config';
import axios from 'axios';
import { DB } from '../database';
import logger from '../logger';

class Donations {
  private notifyDonationStatusCallback: ((invoiceId: string) => void) | undefined;
  private options = {
    baseURL: config.SPONSORS.BTCPAY_URL,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': config.SPONSORS.BTCPAY_AUTH,
    },
    timeout: 10000,
  };

  sponsorsCache: any[] = [];

  constructor() {}

  public async $updateCache() {
    try {
      this.sponsorsCache = await this.$getDonationsFromDatabase('handle, image');
    } catch (e) {
      logger.warn('Setting sponsorsCache failed ' + e.message || e);
    }
  }

  setNotfyDonationStatusCallback(fn: any): void {
    this.notifyDonationStatusCallback = fn;
  }

  async $createRequest(amount: number, orderId: string): Promise<any> {
    logger.notice('New invoice request. Handle: ' + orderId + ' Amount: ' + amount + ' BTC');

    const postData = {
      'price': amount,
      'orderId': orderId,
      'currency': 'BTC',
      'itemDesc': 'Sponsor mempool.space',
      'notificationUrl': config.SPONSORS.BTCPAY_WEBHOOK_URL,
      'redirectURL': 'https://mempool.space/about',
    };
    const response = await axios.post('/invoices', postData, this.options);
    return {
      id: response.data.data.id,
      amount: parseFloat(response.data.data.btcPrice),
      addresses: response.data.data.addresses,
    };
  }

  async $handleWebhookRequest(data: any): Promise<void> {
    if (!data || !data.id) {
      return;
    }
    const response = await this.$getStatus(data.id);
    logger.notice(`Received BTCPayServer webhook. Invoice ID: ${data.id} Status: ${response.status} BTC Paid: ${response.btcPaid}`);
    if (response.status !== 'complete' && response.status !== 'confirmed' && response.status !== 'paid') {
      return;
    }

    if (this.notifyDonationStatusCallback) {
      this.notifyDonationStatusCallback(data.id);
    }

    if (parseFloat(response.btcPaid) < 0.01) {
      return;
    }

    if (response.orderId !== '') {
      try {
        const userData = await this.$getTwitterUserData(response.orderId);
        const imageUrl = userData.profile_image_url.replace('normal', '200x200');
        const imageBlob = await this.$downloadProfileImageBlob(imageUrl);

        logger.debug('Creating database entry for donation with invoice id: ' + response.id);
        await this.$addDonationToDatabase(response.btcPaid, userData.screen_name, userData.id, response.id, imageUrl, imageBlob);
        this.$updateCache();
      } catch (e) {
        logger.err(`Error fetching twitter data for handle ${response.orderId}: ${e.message}`);
      }
    }
  }

  getSponsorImage(id: string): any | undefined {
    const sponsor = this.sponsorsCache.find((s) => s.handle === id);
    if (sponsor) {
      return sponsor.image;
    }
  }

  async $getDonationsFromDatabase(fields: string): Promise<any[]> {
    try {
      const connection = await DB.pool.getConnection();
      const query = `SELECT ${fields} FROM donations ORDER BY id DESC`;
      const [rows] = await connection.query<any>(query);
      connection.release();
      return rows;
    } catch (e) {
      logger.err('$getDonationsFromDatabase() error: ' + e.message || e);
      return [];
    }
  }

  private async $getOldDonations(): Promise<any[]> {
    try {
      const connection = await DB.pool.getConnection();
      const query = `SELECT * FROM donations WHERE twitter_id IS NULL AND handle != ''`;
      const [rows] = await connection.query<any>(query);
      connection.release();
      return rows;
    } catch (e) {
      logger.err('$getLegacyDonations() error' + e.message || e);
      return [];
    }
  }

  private async $getStatus(id: string): Promise<any> {
    logger.debug('Fetching status for invoice: ' + id);
    const response = await axios.get('/invoices/' + id, this.options);
    logger.debug('Invoice status received: ' + JSON.stringify(response.data));
    return response.data.data;
  }

  private async $addDonationToDatabase(btcPaid: number, handle: string, twitter_id: number | null,
    orderId: string, imageUrl: string, image: string): Promise<void> {
    try {
      const connection = await DB.pool.getConnection();
      const query = `INSERT IGNORE INTO donations(added, amount, handle, twitter_id, order_id, imageUrl, image) VALUES (NOW(), ?, ?, ?, ?, ?, FROM_BASE64(?))`;
      const params: (string | number | null)[] = [
        btcPaid,
        handle,
        twitter_id,
        orderId,
        imageUrl,
        image,
      ];
      const [result]: any = await connection.query(query, params);
      connection.release();
    } catch (e) {
      logger.err('$addDonationToDatabase() error' + e.message || e);
    }
  }

  private async $updateDonation(id: number, handle: string, twitterId: number, imageUrl: string, image: string): Promise<void> {
    try {
      const connection = await DB.pool.getConnection();
      const query = `UPDATE donations SET handle = ?, twitter_id = ?, imageUrl = ?, image = FROM_BASE64(?) WHERE id = ?`;
      const params: (string | number)[] = [
        handle,
        twitterId,
        imageUrl,
        image,
        id,
      ];
      const [result]: any = await connection.query(query, params);
      connection.release();
    } catch (e) {
      logger.err('$updateDonation() error' + e.message || e);
    }
  }

  private async $getTwitterUserData(handle: string): Promise<any> {
    logger.debug('Fetching Twitter API data...');
    const res = await axios.get(`https://api.twitter.com/1.1/users/show.json?screen_name=${handle}`, {
      headers: {
        Authorization: 'Bearer ' + config.SPONSORS.TWITTER_BEARER_AUTH
      },
      timeout: 10000,
    });
    logger.debug('Twitter user data fetched:' + JSON.stringify(res.data));
    return res.data;
  }

  private async $downloadProfileImageBlob(url: string): Promise<string> {
    logger.debug('Fetching image blob...');
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
    logger.debug('Image downloaded.');
    return Buffer.from(res.data, 'utf8').toString('base64');
  }

  private async refreshSponsors(): Promise<void> {
    const oldDonations = await this.$getOldDonations();
    oldDonations.forEach(async (donation: any) => {
      logger.debug('Migrating donation for handle: ' + donation.handle);
      try {
        const twitterData = await this.$getTwitterUserData(donation.handle);
        const imageUrl = twitterData.profile_image_url.replace('normal', '200x200');
        const imageBlob = await this.$downloadProfileImageBlob(imageUrl);
        await this.$updateDonation(donation.id, twitterData.screen_name, twitterData.id, imageUrl, imageBlob);
      } catch (e) {
        logger.err('Failed to migrate donation for handle: ' + donation.handle + '. ' + (e.message || e));
      }
    });
  }
}

export default new Donations();
