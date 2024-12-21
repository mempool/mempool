import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { combineLatest, Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { ApiService } from '@app/services/api.service';
import { AssetsService } from '@app/services/assets.service';

@Component({
  selector: 'app-asset-group',
  templateUrl: './asset-group.component.html',
  styleUrls: ['./asset-group.component.scss']
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
          return combineLatest([
            this.assetsService.getAssetsJson$,
            this.apiService.getAssetGroup$(params.get('id')),
          ]);
        }),
        map(([assets, group]) => {
          const items = [];
          // @ts-ignore
          for (const item of group.assets) {
            items.push(assets.objects[item]);
          }
          return {
            group: group,
            assets: items
          };
        })
      );
  }
}
