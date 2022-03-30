import { Component, Input, OnChanges, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { AssetsService } from 'src/app/services/assets.service';
import { Transaction } from 'src/app/interfaces/electrs.interface';
import { StateService } from 'src/app/services/state.service';
import { RelativeUrlPipe } from 'src/app/shared/pipes/relative-url/relative-url.pipe';

@Component({
  selector: 'app-miner',
  templateUrl: './miner.component.html',
  styleUrls: ['./miner.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MinerComponent implements OnChanges {
  @Input() coinbaseTransaction: Transaction;
  miner = '';
  title = '';
  url = '';
  target = '_blank';
  loading = true;

  constructor(
    private assetsService: AssetsService,
    private cd: ChangeDetectorRef,
    public stateService: StateService,
    private relativeUrlPipe: RelativeUrlPipe,
  ) { }

  ngOnChanges() {
    this.miner = '';
    this.loading = true;
    this.findMinerFromCoinbase();
  }

  findMinerFromCoinbase() {
    if (this.coinbaseTransaction == null || this.coinbaseTransaction.vin == null || this.coinbaseTransaction.vin.length === 0) {
      return null;
    }

    this.assetsService.getMiningPools$.subscribe((pools) => {
      for (const vout of this.coinbaseTransaction.vout) {
        if (!vout.scriptpubkey_address) {
          continue;
        }

        if (pools.payout_addresses[vout.scriptpubkey_address]) {
            this.miner = pools.payout_addresses[vout.scriptpubkey_address].name;
            this.title = $localize`:@@miner-identified-by-payout:Identified by payout address: '${vout.scriptpubkey_address}:PAYOUT_ADDRESS:'`;
            const pool = pools.payout_addresses[vout.scriptpubkey_address];
            if (this.stateService.env.MINING_DASHBOARD && pools.slugs && pools.slugs[pool.name] !== undefined) {
              this.url = this.relativeUrlPipe.transform(`/mining/pool/${pools.slugs[pool.name]}`);
              this.target = '';
            } else {
              this.url = pool.link;
            }
            break;
        }

        for (const tag in pools.coinbase_tags) {
          if (pools.coinbase_tags.hasOwnProperty(tag)) {
            const coinbaseAscii = this.hex2ascii(this.coinbaseTransaction.vin[0].scriptsig);
            if (coinbaseAscii.indexOf(tag) > -1) {
              const pool = pools.coinbase_tags[tag];
              this.miner = pool.name;
              this.title = $localize`:@@miner-identified-by-coinbase:Identified by coinbase tag: '${tag}:TAG:'`;
              if (this.stateService.env.MINING_DASHBOARD && pools.slugs && pools.slugs[pool.name] !== undefined) {
                this.url = this.relativeUrlPipe.transform(`/mining/pool/${pools.slugs[pool.name]}`);
                this.target = '';
              } else {
                this.url = pool.link;
              }
              break;
            }
          }
        }
      }

      this.loading = false;
      this.cd.markForCheck();
    });
  }

  hex2ascii(hex: string) {
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
      str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    }
    return str;
  }
}
