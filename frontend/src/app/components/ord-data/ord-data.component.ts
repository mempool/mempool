import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Runestone } from '../../shared/ord/rune/runestone';
import { Etching } from '../../shared/ord/rune/etching';
import { u128, u32, u8 } from '../../shared/ord/rune/integer';
import { HttpErrorResponse } from '@angular/common/http';
import { SpacedRune } from '../../shared/ord/rune/spacedrune';

export interface Inscription {
  body?: Uint8Array;
  body_length?: number;
  content_type?: Uint8Array;
  content_type_str?: string;
  delegate_txid?: string;
}

@Component({
  selector: 'app-ord-data',
  templateUrl: './ord-data.component.html',
  styleUrls: ['./ord-data.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrdDataComponent implements OnChanges {
  @Input() inscriptions: Inscription[];
  @Input() runestone: Runestone;
  @Input() runeInfo: { [id: string]: { etching: Etching; txid: string; name?: string; } };
  @Input() error: HttpErrorResponse;
  @Input() type: 'vin' | 'vout';

  // Inscriptions
  inscriptionsData: { [key: string]: { count: number, totalSize: number, text?: string; json?: JSON; tag?: string; delegate?: string } };
  // Rune mints
  minted: number;
  // Rune etching
  premined: number = -1;
  totalSupply: number = -1;
  etchedName: string;
  etchedSymbol: string;
  // Rune transfers
  transferredRunes: { key: string; etching: Etching; txid: string; name?: string; }[] = [];

  constructor() { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.runestone && this.runestone) {

      Object.keys(this.runeInfo).forEach((key) => {
        const rune = this.runeInfo[key].etching.rune.isSome() ? this.runeInfo[key].etching.rune.unwrap() : null;
        const spacers = this.runeInfo[key].etching.spacers.isSome() ? this.runeInfo[key].etching.spacers.unwrap() : u32(0);
        if (rune) {
          this.runeInfo[key].name = new SpacedRune(rune, Number(spacers)).toString();
        }
        this.transferredRunes.push({ key, ...this.runeInfo[key] });
      });


      if (this.runestone.mint.isSome() && this.runeInfo[this.runestone.mint.unwrap().toString()]) {
        const mint = this.runestone.mint.unwrap().toString();
        this.transferredRunes = this.transferredRunes.filter(rune => rune.key !== mint);
        const terms = this.runeInfo[mint].etching.terms.isSome() ? this.runeInfo[mint].etching.terms.unwrap() : null;
        let amount: u128;
        if (terms) {
          amount = terms.amount.isSome() ? terms.amount.unwrap() : u128(0);
        }
        const divisibility = this.runeInfo[mint].etching.divisibility.isSome() ? this.runeInfo[mint].etching.divisibility.unwrap() : u8(0);
        if (amount) {
          this.minted = this.getAmount(amount, divisibility);
        }
      }

      if (this.runestone.etching.isSome()) {
        const etching = this.runestone.etching.unwrap();
        const rune = etching.rune.isSome() ? etching.rune.unwrap() : null;
        const spacers = etching.spacers.isSome() ? etching.spacers.unwrap() : u32(0);
        if (rune) {
          this.etchedName = new SpacedRune(rune, Number(spacers)).toString();
        }
        this.etchedSymbol = etching.symbol.isSome() ? etching.symbol.unwrap() : '';

        const divisibility = etching.divisibility.isSome() ? etching.divisibility.unwrap() : u8(0);
        const premine = etching.premine.isSome() ? etching.premine.unwrap() : u128(0);
        if (premine) {
          this.premined = this.getAmount(premine, divisibility);
        } else {
          this.premined = 0;
        }
        const terms = etching.terms.isSome() ? etching.terms.unwrap() : null;
        let amount: u128;
        if (terms) {
          amount = terms.amount.isSome() ? terms.amount.unwrap() : u128(0);
          if (amount) {
            const cap = terms.cap.isSome() ? terms.cap.unwrap() : u128(0);
            this.totalSupply = this.premined + this.getAmount(amount, divisibility) * Number(cap);
          }
        } else {
          this.totalSupply = this.premined;
        }
      }
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
          if ((key.includes('text') || key.includes('json')) && inscription.body?.length && !this.inscriptionsData[key].text && !this.inscriptionsData[key].json) {
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

  getAmount(amount: u128 | bigint, divisibility: u8): number {
    const divisor = BigInt(10) ** BigInt(divisibility);
    const result = amount / divisor;

    return result <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(result) : Number.MAX_SAFE_INTEGER;
  }
}
