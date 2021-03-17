import { CpfpInfo, TransactionExtended, TransactionStripped } from '../mempool.interfaces';

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
    const arr = [transactions[transactions.length - 1].effectiveFeePerVsize];
    const chunk = 1 / (rangeLength - 1);
    let itemsToAdd = rangeLength - 2;

    while (itemsToAdd > 0) {
      arr.push(transactions[Math.floor(transactions.length * chunk * itemsToAdd)].effectiveFeePerVsize);
      itemsToAdd--;
    }

    arr.push(transactions[0].effectiveFeePerVsize);
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

  static stripTransaction(tx: TransactionExtended): TransactionStripped {
    return {
      txid: tx.txid,
      fee: tx.fee,
      vsize: tx.weight / 4,
      value: tx.vout.reduce((acc, vout) => acc + (vout.value ? vout.value : 0), 0),
    };
  }

  static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
       setTimeout(() => {
         resolve();
       }, ms);
    });
  }

  static setRelativesAndGetCpfpInfo(tx: TransactionExtended, memPool: { [txid: string]: TransactionExtended }): CpfpInfo {
    const parents = this.findAllParents(tx, memPool);

    let totalWeight = tx.weight + parents.reduce((prev, val) => prev + val.weight, 0);
    let totalFees = tx.fee + parents.reduce((prev, val) => prev + val.fee, 0);

    tx.ancestors = parents
      .map((t) => {
        return {
          txid: t.txid,
          weight: t.weight,
          fee: t.fee,
        };
      });

    // Add high (high fee) decendant weight and fees
    if (tx.descended) {
      totalWeight += tx.descended.weight;
      totalFees += tx.descended.fee;
    }

    tx.effectiveFeePerVsize = totalFees / (totalWeight / 4);
    tx.cpfpChecked = true;

    return {
      ancestors: tx.ancestors,
      descended: tx.descended || null,
    };
  }


  private static findAllParents(tx: TransactionExtended, memPool: { [txid: string]: TransactionExtended }): TransactionExtended[] {
    let parents: TransactionExtended[] = [];
    tx.vin.forEach((parent) => {
      const parentTx = memPool[parent.txid];
      if (parentTx) {
        if (tx.descended && tx.descended.fee / (tx.descended.weight / 4) > parentTx.feePerVsize) {
          if (parentTx.descended && parentTx.descended.fee < tx.fee + tx.descended.fee) {
            parentTx.descended = {
              weight: tx.weight + tx.descended.weight,
              fee: tx.fee + tx.descended.fee,
              txid: tx.txid,
            };
          }
        } else if (tx.feePerVsize > parentTx.feePerVsize) {
          parentTx.descended = {
            weight: tx.weight,
            fee: tx.fee,
            txid: tx.txid
          };
        }
        parents.push(parentTx);
        parents = parents.concat(this.findAllParents(parentTx, memPool));
      }
    });
    return parents;
  }

}
