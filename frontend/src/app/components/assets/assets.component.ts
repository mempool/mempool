import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { AssetsService } from '@app/services/assets.service';
import { UntypedFormGroup } from '@angular/forms';
import { map, switchMap } from 'rxjs/operators';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { SeoService } from '@app/services/seo.service';
import { AssetRegistryItem } from '@interfaces/electrs.interface';

@Component({
  selector: 'app-assets',
  templateUrl: './assets.component.html',
  styleUrls: ['./assets.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class AssetsComponent implements OnInit {
  paginationMaxSize = window.matchMedia('(max-width: 670px)').matches ? 4 : 6;
  ellipses = window.matchMedia('(max-width: 670px)').matches ? false : true;

  searchForm: UntypedFormGroup;
  assets$: Observable<AssetRegistryItem[]>;

  page = 1;
  totalAssets = 0;
  error: any;

  itemsPerPage: number;
  contentSpace = window.innerHeight - (250 + 200);
  fiveItemsPxSize = 250;

  constructor(
    private assetsService: AssetsService,
    private route: ActivatedRoute,
    private router: Router,
    private seoService: SeoService,
  ) { }

  ngOnInit() {
    this.seoService.setTitle($localize`:@@ee8f8008bae6ce3a49840c4e1d39b4af23d4c263:Assets`);
    this.itemsPerPage = Math.max(Math.round(this.contentSpace / this.fiveItemsPxSize) * 5, 10);

    this.assets$ = this.route.queryParams
      .pipe(
        switchMap((queryParams) => {
          this.page = queryParams.page ? parseInt(queryParams.page, 10) : 1;
          const start = (this.page - 1) * this.itemsPerPage;
          return this.assetsService.getLiquidAssetsPage$(start, this.itemsPerPage);
        }),
        map((result) => {
          this.totalAssets = result.total;
          return result.assets;
        }),
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
