import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { from, Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { ApiService } from '@app/services/api.service';
import { AssetsService } from '@app/services/assets.service';

@Component({
  selector: 'app-asset-group',
  templateUrl: './asset-group.component.html',
  styleUrls: ['./asset-group.component.scss'],
  standalone: false,
})
export class AssetGroupComponent implements OnInit {
  group$: Observable<any>;

  constructor(
    private route: ActivatedRoute,
    private apiService: ApiService,
    private assetsService: AssetsService,
  ) { }

  ngOnInit(): void {
    this.group$ = this.route.paramMap
      .pipe(
        switchMap((params: ParamMap) => {
          return this.apiService.getAssetGroup$(params.get('id'));
        }),
        switchMap((group) => {
          return from(Promise.all(group.assets.map((assetId) => this.assetsService.getLiquidAssetData(assetId).catch(() => ({ asset_id: assetId })))))
            .pipe(
              map((assets) => ({
                group: group,
                assets: assets,
              }))
            );
        }),
      );
  }
}
