"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("../config");
const axios_1 = require("axios");
const database_1 = require("../database");
const logger_1 = require("../logger");
class Donations {
    constructor() {
        this.options = {
            baseURL: config_1.default.SPONSORS.BTCPAY_URL,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': config_1.default.SPONSORS.BTCPAY_AUTH,
            },
        };
        this.sponsorsCache = [];
        if (!config_1.default.SPONSORS.ENABLED) {
            return;
        }
        this.$updateCache();
    }
    async $updateCache() {
        try {
            this.sponsorsCache = await this.$getDonationsFromDatabase('handle, image');
        }
        catch (e) {
            logger_1.default.warn('Setting sponsorsCache failed ' + e.message || e);
        }
    }
    setNotfyDonationStatusCallback(fn) {
        this.notifyDonationStatusCallback = fn;
    }
    async $createRequest(amount, orderId) {
        logger_1.default.notice('New invoice request. Handle: ' + orderId + ' Amount: ' + amount + ' BTC');
        const postData = {
            'price': amount,
            'orderId': orderId,
            'currency': 'BTC',
            'itemDesc': 'Sponsor mempool.space',
            'notificationUrl': config_1.default.SPONSORS.BTCPAY_WEBHOOK_URL,
            'redirectURL': 'https://mempool.space/about',
        };
        const response = await axios_1.default.post('/invoices', postData, this.options);
        return {
            id: response.data.data.id,
            amount: parseFloat(response.data.data.btcPrice),
            addresses: response.data.data.addresses,
        };
    }
    async $handleWebhookRequest(data) {
        if (!data || !data.id) {
            return;
        }
        const response = await this.$getStatus(data.id);
        logger_1.default.notice(`Received BTCPayServer webhook. Invoice ID: ${data.id} Status: ${response.status} BTC Paid: ${response.btcPaid}`);
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
                logger_1.default.debug('Creating database entry for donation with invoice id: ' + response.id);
                await this.$addDonationToDatabase(response.btcPaid, userData.screen_name, userData.id, response.id, imageUrl, imageBlob);
                this.$updateCache();
            }
            catch (e) {
                logger_1.default.err(`Error fetching twitter data for handle ${response.orderId}: ${e.message}`);
            }
        }
    }
    getSponsorImage(id) {
        const sponsor = this.sponsorsCache.find((s) => s.handle === id);
        if (sponsor) {
            return sponsor.image;
        }
    }
    async $getDonationsFromDatabase(fields) {
        try {
            const connection = await database_1.DB.pool.getConnection();
            const query = `SELECT ${fields} FROM donations ORDER BY id DESC`;
            const [rows] = await connection.query(query);
            connection.release();
            return rows;
        }
        catch (e) {
            logger_1.default.err('$getDonationsFromDatabase() error: ' + e.message || e);
            return [];
        }
    }
    async $getOldDonations() {
        try {
            const connection = await database_1.DB.pool.getConnection();
            const query = `SELECT * FROM donations WHERE twitter_id IS NULL AND handle != ''`;
            const [rows] = await connection.query(query);
            connection.release();
            return rows;
        }
        catch (e) {
            logger_1.default.err('$getLegacyDonations() error' + e.message || e);
            return [];
        }
    }
    async $getStatus(id) {
        logger_1.default.debug('Fetching status for invoice: ' + id);
        const response = await axios_1.default.get('/invoices/' + id, this.options);
        logger_1.default.debug('Invoice status received: ' + JSON.stringify(response.data));
        return response.data.data;
    }
    async $addDonationToDatabase(btcPaid, handle, twitter_id, orderId, imageUrl, image) {
        try {
            const connection = await database_1.DB.pool.getConnection();
            const query = `INSERT IGNORE INTO donations(added, amount, handle, twitter_id, order_id, imageUrl, image) VALUES (NOW(), ?, ?, ?, ?, ?, FROM_BASE64(?))`;
            const params = [
                btcPaid,
                handle,
                twitter_id,
                orderId,
                imageUrl,
                image,
            ];
            const [result] = await connection.query(query, params);
            connection.release();
        }
        catch (e) {
            logger_1.default.err('$addDonationToDatabase() error' + e.message || e);
        }
    }
    async $updateDonation(id, handle, twitterId, imageUrl, image) {
        try {
            const connection = await database_1.DB.pool.getConnection();
            const query = `UPDATE donations SET handle = ?, twitter_id = ?, imageUrl = ?, image = FROM_BASE64(?) WHERE id = ?`;
            const params = [
                handle,
                twitterId,
                imageUrl,
                image,
                id,
            ];
            const [result] = await connection.query(query, params);
            connection.release();
        }
        catch (e) {
            logger_1.default.err('$updateDonation() error' + e.message || e);
        }
    }
    async $getTwitterUserData(handle) {
        logger_1.default.debug('Fetching Twitter API data...');
        const res = await axios_1.default.get(`https://api.twitter.com/1.1/users/show.json?screen_name=${handle}`, {
            headers: {
                Authorization: 'Bearer ' + config_1.default.SPONSORS.TWITTER_BEARER_AUTH
            }
        });
        logger_1.default.debug('Twitter user data fetched:' + JSON.stringify(res.data));
        return res.data;
    }
    async $downloadProfileImageBlob(url) {
        logger_1.default.debug('Fetching image blob...');
        const res = await axios_1.default.get(url, { responseType: 'arraybuffer' });
        logger_1.default.debug('Image downloaded.');
        return Buffer.from(res.data, 'utf8').toString('base64');
    }
    async refreshSponsors() {
        const oldDonations = await this.$getOldDonations();
        oldDonations.forEach(async (donation) => {
            logger_1.default.debug('Migrating donation for handle: ' + donation.handle);
            try {
                const twitterData = await this.$getTwitterUserData(donation.handle);
                const imageUrl = twitterData.profile_image_url.replace('normal', '200x200');
                const imageBlob = await this.$downloadProfileImageBlob(imageUrl);
                await this.$updateDonation(donation.id, twitterData.screen_name, twitterData.id, imageUrl, imageBlob);
            }
            catch (e) {
                logger_1.default.err('Failed to migrate donation for handle: ' + donation.handle + '. ' + (e.message || e));
            }
        });
    }
}
exports.default = new Donations();
