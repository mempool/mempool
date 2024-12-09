import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Runestone, Etching } from '@app/shared/ord/rune.utils';
import { Inscription } from '@app/shared/ord/inscription.utils';

@Component({
  selector: 'app-ord-data',
  templateUrl: './ord-data.component.html',
  styleUrls: ['./ord-data.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrdDataComponent implements OnChanges {
  @Input() inscriptions: Inscription[];
  @Input() runestone: Runestone;
  @Input() runeInfo: { [id: string]: { etching: Etching; txid: string } };
  @Input() type: 'vin' | 'vout';

  toNumber = (value: bigint): number => Number(value);

  // Inscriptions
  inscriptionsData: { [key: string]: { count: number, totalSize: number, text?: string; json?: JSON; tag?: string; delegate?: string } };
  // Rune mints
  minted: number;
  // Rune transfers
  transferredRunes: { key: string; etching: Etching; txid: string }[] = [];

  constructor() { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.runestone && this.runestone) {
      if (this.runestone.mint && this.runeInfo[this.runestone.mint.toString()]) {
        const mint = this.runestone.mint.toString();
        const terms = this.runeInfo[mint].etching.terms;
        const amount = terms?.amount;
        const divisibility = this.runeInfo[mint].etching.divisibility;
        if (amount) {
          this.minted = this.getAmount(amount, divisibility);
        }
      }

      this.runestone.edicts.forEach(edict => {
        if (this.runeInfo[edict.id.toString()]) {
          this.transferredRunes.push({ key: edict.id.toString(), ...this.runeInfo[edict.id.toString()] });
        }
      });
    }

    if (changes.inscriptions && this.inscriptions) {

      if (this.inscriptions?.length) {
        this.inscriptionsData = {};
        this.inscriptions.forEach((inscription) => {
          // General: count, total size, delegate
          const key = inscription.content_type_str || 'undefined';
          if (!this.inscriptionsData[key]) {
            this.inscriptionsData[key] = { count: 0, totalSize: 0 };
          }
          this.inscriptionsData[key].count++;
          this.inscriptionsData[key].totalSize += inscription.body_length;
          if (inscription.delegate_txid && !this.inscriptionsData[key].delegate) {
            this.inscriptionsData[key].delegate = inscription.delegate_txid;
          }

          // Text / JSON data
          if ((key.includes('text') || key.includes('json')) && !inscription.is_cropped && !this.inscriptionsData[key].text && !this.inscriptionsData[key].json) {
            const decoder = new TextDecoder('utf-8');
            const text = decoder.decode(inscription.body);
            try {
              this.inscriptionsData[key].json = JSON.parse(text);
              if (this.inscriptionsData[key].json['p']) {
                this.inscriptionsData[key].tag = this.inscriptionsData[key].json['p'].toUpperCase();
              }
            } catch (e) {
              this.inscriptionsData[key].text = text;
            }
          }
        });
      }
    }
  }

  getAmount(amount: bigint, divisibility: number): number {
    const divisor = BigInt(10) ** BigInt(divisibility);
    const result = amount / divisor;

    return result <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(result) : Number.MAX_SAFE_INTEGER;
  }
}
