const config = require('../../mempool-config.json');
import * as request from 'request';
import { DB } from '../database';
import logger from '../logger';

class Donations {
  private notifyDonationStatusCallback: ((invoiceId: string) => void) | undefined;
  private options = {
    baseUrl: config.BTCPAY_URL,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': config.BTCPAY_AUTH,
    },
  };

  constructor() { }

  setNotfyDonationStatusCallback(fn: any) {
    this.notifyDonationStatusCallback = fn;
  }

  createRequest(amount: number, orderId: string): Promise<any> {
    const postData = {
      'price': amount,
      'orderId': orderId,
      'currency': 'BTC',
      'itemDesc': 'Sponsor mempool.space',
      'notificationUrl': config.BTCPAY_WEBHOOK_URL,
      'redirectURL': 'https://mempool.space/about'
    };
    return new Promise((resolve, reject) => {
      request.post({
        uri: '/invoices',
        json: postData,
        ...this.options,
      }, (err, res, body) => {
        if (err) { return reject(err); }
        const formattedBody = {
          id: body.data.id,
          amount: parseFloat(body.data.btcPrice),
          address: body.data.bitcoinAddress,
        };
        resolve(formattedBody);
      });
    });
  }

  async $handleWebhookRequest(data: any) {
    logger.debug('Received BTCPayServer webhook data: ' + JSON.stringify(data));
    if (!data || !data.id) {
      return;
    }

    const response = await this.getStatus(data.id);
    if (response.status !== 'complete' && response.status !== 'confirmed' && response.status !== 'paid') {
      return;
    }

    if (this.notifyDonationStatusCallback) {
      this.notifyDonationStatusCallback(data.id);
    }

    if (parseFloat(response.btcPaid) < 0.001) {
      return;
    }

    let imageUrl = '';
    let handle = '';
    if (response.orderId !== '') {
      try {
        const hiveData = await this.$getTwitterImageUrl(response.orderId);
        imageUrl = hiveData.imageUrl;
        handle = hiveData.screenName;
      } catch (e) {
        logger.err('Error fetching twitter image' + e.message);
      }
    }

    logger.debug('Creating database entry for donation with invoice id: ' + response.id);
    this.$addDonationToDatabase(response.btcPaid, handle, response.id, imageUrl);
  }

  private getStatus(id: string): Promise<any> {
    return new Promise((resolve, reject) => {
      logger.debug('Fetching status for invoice: ' + id);
      request.get({
        uri: '/invoices/' + id,
        json: true,
        ...this.options,
      }, (err, res, body) => {
        if (err) { return reject(err); }
        logger.debug('Invoice status received: ' + JSON.stringify(body.data));
        resolve(body.data);
      });
    });
  }

  async $getDonationsFromDatabase() {
    try {
      const connection = await DB.pool.getConnection();
      const query = `SELECT handle, imageUrl FROM donations WHERE handle != '' ORDER BY id DESC`;
      const [rows] = await connection.query<any>(query);
      connection.release();
      return rows;
    } catch (e) {
      logger.err('$getDonationsFromDatabase() error' + e);
    }
  }

  private async $addDonationToDatabase(btcPaid: number, handle: string, orderId: string, imageUrl: string): Promise<void> {
    try {
      const connection = await DB.pool.getConnection();
      const query = `INSERT IGNORE INTO donations(added, amount, handle, order_id, imageUrl) VALUES (NOW(), ?, ?, ?, ?)`;
      const params: (string | number)[] = [
        btcPaid,
        handle,
        orderId,
        imageUrl,
      ];
      const [result]: any = await connection.query(query, params);
      connection.release();
    } catch (e) {
      logger.err('$addDonationToDatabase() error' + e);
    }
  }

  private async $getTwitterImageUrl(handle: string): Promise<any> {
    return new Promise((resolve, reject) => {
      logger.debug('Fetching Hive.one data...');
      request.get({
        uri: `https://api.hive.one/v1/influencers/screen_name/${handle}/?format=json`,
        json: true,
      }, (err, res, body) => {
        if (err) { return reject(err); }
        logger.debug('Hive.one data fetched:' + JSON.stringify(body.data));
        resolve(body.data);
      });
    });
  }
}

export default new Donations();
