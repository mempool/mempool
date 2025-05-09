import { ChainStats, Transaction } from '@interfaces/electrs.interface';

export class WalletStats implements ChainStats {
  addresses: string[];
  funded_txo_count: number;
  funded_txo_sum: number;
  spent_txo_count: number;
  spent_txo_sum: number;
  tx_count: number;

  constructor (stats: ChainStats[], addresses: string[]) {
    Object.assign(this, stats.reduce((acc, stat) => {
        acc.funded_txo_count += stat.funded_txo_count;
        acc.funded_txo_sum += stat.funded_txo_sum;
        acc.spent_txo_count += stat.spent_txo_count;
        acc.spent_txo_sum += stat.spent_txo_sum;
        acc.tx_count += stat.tx_count;
        return acc;
      }, {
        funded_txo_count: 0,
        funded_txo_sum: 0,
        spent_txo_count: 0,
        spent_txo_sum: 0,
        tx_count: 0,
      })
    );
    this.addresses = addresses;
  }

  public addTx(tx: Transaction): void {
    for (const vin of tx.vin) {
      if (this.addresses.includes(vin.prevout?.scriptpubkey_address)) {
        this.spendTxo(vin.prevout.value);
      }
    }
    for (const vout of tx.vout) {
      if (this.addresses.includes(vout.scriptpubkey_address)) {
        this.fundTxo(vout.value);
      }
    }
    this.tx_count++;
  }

  public removeTx(tx: Transaction): void {
    for (const vin of tx.vin) {
      if (this.addresses.includes(vin.prevout?.scriptpubkey_address)) {
        this.unspendTxo(vin.prevout.value);
      }
    }
    for (const vout of tx.vout) {
      if (this.addresses.includes(vout.scriptpubkey_address)) {
        this.unfundTxo(vout.value);
      }
    }
    this.tx_count--;
  }

  private fundTxo(value: number): void {
    this.funded_txo_sum += value;
    this.funded_txo_count++;
  }

  private unfundTxo(value: number): void {
    this.funded_txo_sum -= value;
    this.funded_txo_count--;
  }

  private spendTxo(value: number): void {
    this.spent_txo_sum += value;
    this.spent_txo_count++;
  }

  private unspendTxo(value: number): void {
    this.spent_txo_sum -= value;
    this.spent_txo_count--;
  }

  get balance(): number {
    return this.funded_txo_sum - this.spent_txo_sum;
  }

  get totalReceived(): number {
    return this.funded_txo_sum;
  }

  get utxos(): number {
    return this.funded_txo_count - this.spent_txo_count;
  }
}