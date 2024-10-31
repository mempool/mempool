import { ChangeDetectionStrategy, Component, Inject, Input, LOCALE_ID, OnInit } from '@angular/core';
import { combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { moveDec } from '@app/bitcoin.utils';
import { AssetsService } from '@app/services/assets.service';
import { ElectrsApiService } from '@app/services/electrs-api.service';
import { environment } from '@environments/environment';

@Component({
  selector: 'app-asset-circulation',
  templateUrl: './asset-circulation.component.html',
  styleUrls: ['./asset-circulation.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssetCirculationComponent implements OnInit {
  @Input() assetId: string;

  circulatingAmount$: Observable<{ amount: number, ticker: string}>;

  constructor(
    private electrsApiService: ElectrsApiService,
    private assetsService: AssetsService,
    @Inject(LOCALE_ID) private locale: string,
  ) { }

  ngOnInit(): void {
    this.circulatingAmount$ = combineLatest([
      this.electrsApiService.getAsset$(this.assetId),
      this.assetsService.getAssetsMinimalJson$]
    )
    .pipe(
      map(([asset, assetsMinimal]) => {
        const assetData = assetsMinimal[asset.asset_id];
        if (!asset.chain_stats.has_blinded_issuances) {
          if (asset.asset_id === environment.nativeAssetId) {
            return {
              amount: this.formatAmount(asset.chain_stats.peg_in_amount - asset.chain_stats.burned_amount - asset.chain_stats.peg_out_amount, assetData[3]),
              ticker: assetData[1]
            };
          } else {
            return {
              amount: this.formatAmount(asset.chain_stats.issued_amount - asset.chain_stats.burned_amount, assetData[3]),
              ticker: assetData[1]
            };
          }
        } else {
          return {
            amount: -1,
            ticker: '',
          };
        }
      }),
    );
  }

  formatAmount(value: number, precision = 0): number {
    return parseFloat(moveDec(value, -precision));
  }
}
