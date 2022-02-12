import { ChangeDetectionStrategy, Component, Inject, Input, LOCALE_ID, OnInit } from '@angular/core';
import { combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { moveDec } from 'src/app/bitcoin.utils';
import { AssetsService } from 'src/app/services/assets.service';
import { ElectrsApiService } from 'src/app/services/electrs-api.service';
import { formatNumber } from '@angular/common';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-asset-circulation',
  templateUrl: './asset-circulation.component.html',
  styleUrls: ['./asset-circulation.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssetCirculationComponent implements OnInit {
  @Input() assetId: string;

  circulatingAmount$: Observable<string>;

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
            return formatNumber(this.formatAmount(asset.chain_stats.peg_in_amount - asset.chain_stats.burned_amount
              - asset.chain_stats.peg_out_amount, assetData[3]), this.locale, '1.2-2');
          } else {
            return formatNumber(this.formatAmount(asset.chain_stats.issued_amount
              - asset.chain_stats.burned_amount, assetData[3]), this.locale, '1.2-2');
          }
        } else {
          return $localize`:@@shared.confidential:Confidential`;
        }
      }),
    );
  }

  formatAmount(value: number, precision = 0): number {
    return parseFloat(moveDec(value, -precision));
  }
}
