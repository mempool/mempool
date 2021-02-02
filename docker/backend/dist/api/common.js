"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Common = void 0;
class Common {
    static median(numbers) {
        let medianNr = 0;
        const numsLen = numbers.length;
        if (numsLen % 2 === 0) {
            medianNr = (numbers[numsLen / 2 - 1] + numbers[numsLen / 2]) / 2;
        }
        else {
            medianNr = numbers[(numsLen - 1) / 2];
        }
        return medianNr;
    }
    static getFeesInRange(transactions, rangeLength) {
        const arr = [transactions[transactions.length - 1].feePerVsize];
        const chunk = 1 / (rangeLength - 1);
        let itemsToAdd = rangeLength - 2;
        while (itemsToAdd > 0) {
            arr.push(transactions[Math.floor(transactions.length * chunk * itemsToAdd)].feePerVsize);
            itemsToAdd--;
        }
        arr.push(transactions[0].feePerVsize);
        return arr;
    }
    static findRbfTransactions(added, deleted) {
        const matches = {};
        deleted
            // The replaced tx must have at least one input with nSequence < maxint-1 (That’s the opt-in)
            .filter((tx) => tx.vin.some((vin) => vin.sequence < 0xfffffffe))
            .forEach((deletedTx) => {
            const foundMatches = added.find((addedTx) => {
                // The new tx must, absolutely speaking, pay at least as much fee as the replaced tx.
                return addedTx.fee > deletedTx.fee
                    // The new transaction must pay more fee per kB than the replaced tx.
                    && addedTx.feePerVsize > deletedTx.feePerVsize
                    // Spends one or more of the same inputs
                    && deletedTx.vin.some((deletedVin) => addedTx.vin.some((vin) => vin.txid === deletedVin.txid));
            });
            if (foundMatches) {
                matches[deletedTx.txid] = foundMatches;
            }
        });
        return matches;
    }
    static stripTransaction(tx) {
        return {
            txid: tx.txid,
            fee: tx.fee,
            weight: tx.weight,
            vsize: tx.weight / 4,
            value: tx.vout.reduce((acc, vout) => acc + (vout.value ? vout.value : 0), 0),
        };
    }
    static sleep(ms) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve();
            }, ms);
        });
    }
}
exports.Common = Common;
