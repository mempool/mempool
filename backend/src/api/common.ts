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

    arr.push(transactions[1].feePerVsize);
    return arr;
  }
}
