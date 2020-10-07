const config = require('../../mempool-config.json');
import * as request from 'request';
import { DB } from '../database';

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
    if (!data || !data.id) {
      return;
    }
    const response = await this.getStatus(data.id);
    if (response.status === 'complete') {
      if (this.notifyDonationStatusCallback) {
        this.notifyDonationStatusCallback(data.id);
      }

      let imageUrl = '';
      if (response.orderId !== '') {
        try {
          imageUrl = await this.$getTwitterImageUrl(response.orderId);
        } catch (e) {
          console.log('Error fetching twitter image from Hive', e.message);
        }
      }

      this.$addDonationToDatabase(response, imageUrl);
    }
  }

  private getStatus(id: string): Promise<any> {
    return new Promise((resolve, reject) => {
      request.get({
        uri: '/invoices/' + id,
        json: true,
        ...this.options,
      }, (err, res, body) => {
        if (err) { return reject(err); }
        resolve(body.data);
      });
    });
  }

  async $getDonationsFromDatabase() {
    try {
      const connection = await DB.pool.getConnection();
      const query = `SELECT handle, imageUrl FROM donations WHERE handle != ''`;
      const [rows] = await connection.query<any>(query);
      connection.release();
      return rows;
    } catch (e) {
      console.log('$getDonationsFromDatabase() error', e);
    }
  }

  private async $addDonationToDatabase(response: any, imageUrl: string): Promise<void> {
    try {
      const connection = await DB.pool.getConnection();
      const query = `INSERT INTO donations(added, amount, handle, order_id, imageUrl) VALUES (NOW(), ?, ?, ?, ?)`;
      const params: (string | number)[] = [
        response.btcPaid,
        response.orderId,
        response.id,
        imageUrl,
      ];
      const [result]: any = await connection.query(query, params);
      connection.release();
    } catch (e) {
      console.log('$addDonationToDatabase() error', e);
    }
  }

  private async $getTwitterImageUrl(handle: string): Promise<string> {
    return new Promise((resolve, reject) => {
      request.get({
        uri: `https://api.hive.one/v1/influencers/screen_name/${handle}/?format=json`,
        json: true,
      }, (err, res, body) => {
        if (err) { return reject(err); }
        resolve(body.data.imageUrl);
      });
    });
  }
}

export default new Donations();
