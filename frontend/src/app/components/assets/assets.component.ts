import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { AssetsService } from '@app/services/assets.service';
import { environment } from '@environments/environment';
import { UntypedFormGroup } from '@angular/forms';
import { filter, map, switchMap, take } from 'rxjs/operators';
import { ActivatedRoute, Router } from '@angular/router';
import { combineLatest, Observable } from 'rxjs';
import { AssetExtended } from '@interfaces/electrs.interface';
import { SeoService } from '@app/services/seo.service';
import { StateService } from '@app/services/state.service';

@Component({
  selector: 'app-assets',
  templateUrl: './assets.component.html',
  styleUrls: ['./assets.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssetsComponent implements OnInit {
  nativeAssetId = this.stateService.network === 'liquidtestnet' ? environment.nativeTestAssetId : environment.nativeAssetId;
  paginationMaxSize = window.matchMedia('(max-width: 670px)').matches ? 4 : 6;
  ellipses = window.matchMedia('(max-width: 670px)').matches ? false : true;

  assets: AssetExtended[];
  assetsCache: AssetExtended[];
  searchForm: UntypedFormGroup;
  assets$: Observable<AssetExtended[]>;

  page = 1;
  error: any;

  itemsPerPage: number;
  contentSpace = window.innerHeight - (250 + 200);
  fiveItemsPxSize = 250;

  constructor(
    private assetsService: AssetsService,
    private route: ActivatedRoute,
    private router: Router,
    private seoService: SeoService,
    private stateService: StateService,
  ) { }

  ngOnInit() {
    this.seoService.setTitle($localize`:@@ee8f8008bae6ce3a49840c4e1d39b4af23d4c263:Assets`);
    this.itemsPerPage = Math.max(Math.round(this.contentSpace / this.fiveItemsPxSize) * 5, 10);

    this.assets$ = combineLatest([
      this.assetsService.getAssetsJson$,
      this.route.queryParams,
    ])
      .pipe(
        take(1),
        switchMap(([assets, qp]) => {
          this.assets = assets.array;

          return this.route.queryParams
            .pipe(
              filter((queryParams) => {
                const newPage = parseInt(queryParams.page, 10);
                if (newPage !== this.page) {
                  return true;
                }
                return false;
              }),
              map((queryParams) => {
                if (queryParams.page) {
                  const newPage = parseInt(queryParams.page, 10);
                  this.page = newPage;
                } else {
                  this.page = 1;
                }
                return '';
              })
            );
        }),
        map(() => {
          const start = (this.page - 1) * this.itemsPerPage;
          return this.assets.slice(start, this.itemsPerPage + start);
        })
      );
  }

  pageChange(page: number) {
    const queryParams = { page: page };
    if (queryParams.page === 1) {
      queryParams.page = null;
    }
    this.page = -1;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: queryParams,
      queryParamsHandling: 'merge',
    });
  }

  trackByAsset(index: number, asset: any) {
    return asset.asset_id;
  }
}
