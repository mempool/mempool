"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("../logger");
const axios_1 = require("axios");
class FiatConversion {
    constructor() {
        this.conversionRates = {
            'USD': 0
        };
    }
    setProgressChangedCallback(fn) {
        this.ratesChangedCallback = fn;
    }
    startService() {
        logger_1.default.info('Starting currency rates service');
        setInterval(this.updateCurrency.bind(this), 1000 * 60 * 60);
        this.updateCurrency();
    }
    getConversionRates() {
        return this.conversionRates;
    }
    async updateCurrency() {
        try {
            const response = await axios_1.default.get('https://price.bisq.wiz.biz/getAllMarketPrices');
            const usd = response.data.data.find((item) => item.currencyCode === 'USD');
            this.conversionRates = {
                'USD': usd.price,
            };
            if (this.ratesChangedCallback) {
                this.ratesChangedCallback(this.conversionRates);
            }
        }
        catch (e) {
            logger_1.default.err('Error updating fiat conversion rates: ' + e);
        }
    }
}
exports.default = new FiatConversion();
