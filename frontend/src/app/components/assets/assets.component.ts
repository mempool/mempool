import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { AssetsService } from 'src/app/services/assets.service';
import { environment } from 'src/environments/environment';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { distinctUntilChanged, map, filter, mergeMap, tap, take } from 'rxjs/operators';
import { ActivatedRoute, Router } from '@angular/router';
import { merge, combineLatest, Observable } from 'rxjs';
import { AssetExtended } from 'src/app/interfaces/electrs.interface';
import { SeoService } from 'src/app/services/seo.service';
import { StateService } from 'src/app/services/state.service';

@Component({
  selector: 'app-assets',
  templateUrl: './assets.component.html',
  styleUrls: ['./assets.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssetsComponent implements OnInit {
  nativeAssetId = this.stateService.network === 'liquidtestnet' ? environment.nativeTestAssetId : environment.nativeAssetId;

  assets: AssetExtended[];
  assetsCache: AssetExtended[];
  searchForm: FormGroup;
  assets$: Observable<AssetExtended[]>;

  page = 1;
  error: any;

  itemsPerPage: number;
  contentSpace = window.innerHeight - (250 + 200);
  fiveItemsPxSize = 250;

  constructor(
    private assetsService: AssetsService,
    private formBuilder: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private seoService: SeoService,
    private stateService: StateService,
  ) { }

  ngOnInit() {
    this.seoService.setTitle($localize`:@@ee8f8008bae6ce3a49840c4e1d39b4af23d4c263:Assets`);
    this.itemsPerPage = Math.max(Math.round(this.contentSpace / this.fiveItemsPxSize) * 5, 10);

    this.searchForm = this.formBuilder.group({
      searchText: [{ value: '', disabled: true }, Validators.required]
    });

    this.assets$ = combineLatest([
      this.assetsService.getAssetsJson$,
      this.route.queryParams,
    ])
    .pipe(
      take(1),
      mergeMap(([assets, qp]) => {
        this.assets = Object.values(assets);
        if (this.stateService.network === 'liquid') {
          // @ts-ignore
          this.assets.push({
            name: 'Liquid Bitcoin',
            ticker: 'L-BTC',
            asset_id: this.nativeAssetId,
          });
        } else if (this.stateService.network === 'liquidtestnet') {
          // @ts-ignore
          this.assets.push({
            name: 'Test Liquid Bitcoin',
            ticker: 'tL-BTC',
            asset_id: this.nativeAssetId,
          });
        }

        this.assets = this.assets.sort((a: any, b: any) => a.name.localeCompare(b.name));
        this.assetsCache = this.assets;
        this.searchForm.get('searchText').enable();

        if (qp.search) {
          this.searchForm.get('searchText').setValue(qp.search, { emitEvent: false });
        }

        return merge(
          this.searchForm.get('searchText').valueChanges
            .pipe(
              distinctUntilChanged(),
              tap((text) => {
                this.page = 1;
                this.searchTextChanged(text);
              })
            ),
          this.route.queryParams
            .pipe(
              filter((queryParams) => {
                const newPage = parseInt(queryParams.page, 10);
                if (newPage !== this.page || queryParams.search !== this.searchForm.get('searchText').value) {
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
                if (this.searchForm.get('searchText').value !== (queryParams.search || '')) {
                  this.searchTextChanged(queryParams.search);
                }
                if (queryParams.search) {
                  this.searchForm.get('searchText').setValue(queryParams.search, { emitEvent: false });
                  return queryParams.search;
                }
                return '';
              })
            ),
        );
      }),
      map((searchText) => {
        const start = (this.page - 1) * this.itemsPerPage;
        if (searchText.length ) {
          const filteredAssets = this.assetsCache.filter((asset) => asset.name.toLowerCase().indexOf(searchText.toLowerCase()) > -1
            || (asset.ticker || '').toLowerCase().indexOf(searchText.toLowerCase()) > -1);
          this.assets = filteredAssets;
          return filteredAssets.slice(start, this.itemsPerPage + start);
        } else {
          this.assets = this.assetsCache;
          return this.assets.slice(start, this.itemsPerPage + start);
        }
      })
    );
  }

  pageChange(page: number) {
    const queryParams = { page: page, search: this.searchForm.get('searchText').value };
    if (queryParams.search === '') {
      queryParams.search = null;
    }
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

  searchTextChanged(text: string) {
    const queryParams = { search: text, page: 1 };
    if (queryParams.search === '') {
      queryParams.search = null;
    }
    if (queryParams.page === 1) {
      queryParams.page = null;
    }
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
