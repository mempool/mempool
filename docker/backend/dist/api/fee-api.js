"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("../config");
const mempool_blocks_1 = require("./mempool-blocks");
class FeeApi {
    constructor() {
        this.defaultFee = config_1.default.MEMPOOL.NETWORK === 'liquid' ? 0.1 : 1;
    }
    getRecommendedFee() {
        const pBlocks = mempool_blocks_1.default.getMempoolBlocks();
        if (!pBlocks.length) {
            return {
                'fastestFee': this.defaultFee,
                'halfHourFee': this.defaultFee,
                'hourFee': this.defaultFee,
            };
        }
        const firstMedianFee = this.optimizeMedianFee(pBlocks[0]);
        const secondMedianFee = pBlocks[1] ? this.optimizeMedianFee(pBlocks[1], firstMedianFee) : this.defaultFee;
        const thirdMedianFee = pBlocks[2] ? this.optimizeMedianFee(pBlocks[2], secondMedianFee) : this.defaultFee;
        return {
            'fastestFee': firstMedianFee,
            'halfHourFee': secondMedianFee,
            'hourFee': thirdMedianFee,
        };
    }
    optimizeMedianFee(pBlock, previousFee) {
        const useFee = previousFee ? (pBlock.medianFee + previousFee) / 2 : pBlock.medianFee;
        if (pBlock.blockVSize <= 500000) {
            return this.defaultFee;
        }
        if (pBlock.blockVSize <= 950000) {
            const multiplier = (pBlock.blockVSize - 500000) / 500000;
            return Math.max(Math.round(useFee * multiplier), this.defaultFee);
        }
        return Math.round(useFee);
    }
}
exports.default = new FeeApi();
