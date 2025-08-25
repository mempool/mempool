import { ChainStats, Transaction } from '@interfaces/electrs.interface';

export class WalletStats implements ChainStats {
  addresses: string[];
  funded_txo_count: number;
  funded_txo_sum: number;
  spent_txo_count: number;
  spent_txo_sum: number;
  tx_count: number;
  addressStats: Record<string, ChainStats> = {};

  constructor (stats: ChainStats[], addresses: string[]) {
    this.addressStats = {};
    for (let i = 0; i < stats.length; i++) {
      this.addressStats[addresses[i]] = stats[i];
    }
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
    const seenAddresses = new Set<string>;
    for (const vin of tx.vin) {
      const address = vin.prevout?.scriptpubkey_address;
      if (this.addresses.includes(address)) {
        seenAddresses.add(address);
        this.addressStats[address].spent_txo_count++;
        this.addressStats[address].spent_txo_sum += vin.prevout.value;
        this.spendTxo(vin.prevout.value);
      }
    }
    for (const vout of tx.vout) {
      const address = vout.scriptpubkey_address;
      if (this.addresses.includes(address)) {
        seenAddresses.add(address);
        this.addressStats[address].funded_txo_count++;
        this.addressStats[address].funded_txo_sum += vout.value;
        this.fundTxo(vout.value);
      }
    }
    for (const address of seenAddresses.values()) {
      this.addressStats[address].tx_count++;
    }
    this.tx_count++;
  }

  public removeTx(tx: Transaction): void {
    const seenAddresses = new Set<string>;
    for (const vin of tx.vin) {
      const address = vin.prevout?.scriptpubkey_address;
      if (this.addresses.includes(address)) {
        seenAddresses.add(address);
        this.addressStats[address].spent_txo_count--;
        this.addressStats[address].spent_txo_sum -= vin.prevout.value;
        this.unspendTxo(vin.prevout.value);
      }
    }
    for (const vout of tx.vout) {
      const address = vout.scriptpubkey_address;
      if (this.addresses.includes(address)) {
        seenAddresses.add(address);
        this.addressStats[address].funded_txo_count--;
        this.addressStats[address].funded_txo_sum -= vout.value;
        this.unfundTxo(vout.value);
      }
    }
    for (const address of seenAddresses.values()) {
      this.addressStats[address].tx_count--;
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