import { TransactionExtended } from '../interfaces';

export class Common {
  static median(numbers: number[]) {
    let medianNr = 0;
    const numsLen = numbers.length;
    if (numsLen % 2 === 0) {
        medianNr = (numbers[numsLen / 2 - 1] + numbers[numsLen / 2]) / 2;
    } else {
        medianNr = numbers[(numsLen - 1) / 2];
    }
    return medianNr;
  }

  static getFeesInRange(transactions: TransactionExtended[], rangeLength: number) {
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

  static findRbfTransactions(added: TransactionExtended[], deleted: TransactionExtended[]): { [txid: string]: TransactionExtended } {
    const matches: { [txid: string]: TransactionExtended } = {};
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
            && deletedTx.vin.some((deletedVin) =>
              addedTx.vin.some((vin) => vin.txid === deletedVin.txid));
            });
        if (foundMatches) {
          matches[deletedTx.txid] = foundMatches;
        }
      });
    return matches;
  }
}
