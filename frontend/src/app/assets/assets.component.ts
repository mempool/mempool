import { Component, OnInit } from '@angular/core';
import { AssetsService } from '../services/assets.service';
import { environment } from 'src/environments/environment';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-assets',
  templateUrl: './assets.component.html',
  styleUrls: ['./assets.component.scss']
})
export class AssetsComponent implements OnInit {
  nativeAssetId = environment.nativeAssetId;
  assets: any[];
  assetsCache: any[];
  filteredAssets: any[];
  searchForm: FormGroup;

  isLoading = true;
  error: any;

  page = 1;
  itemsPerPage: number;
  contentSpace = window.innerHeight - (250 + 200);
  fiveItemsPxSize = 250;

  constructor(
    private assetsService: AssetsService,
    private formBuilder: FormBuilder,
  ) { }

  ngOnInit() {
    this.itemsPerPage = Math.max(Math.round(this.contentSpace / this.fiveItemsPxSize) * 5, 10);

    this.searchForm = this.formBuilder.group({
      searchText: [{ value: '', disabled: true }, Validators.required]
    });

    this.searchForm.get('searchText').valueChanges
      .pipe(
        distinctUntilChanged(),
      )
      .subscribe((searchText) => {
        this.page = 1;
        if (searchText.length ) {
          this.filteredAssets = this.assetsCache.filter((asset) => asset.name.toLowerCase().indexOf(searchText.toLowerCase()) > -1
            || asset.ticker.toLowerCase().indexOf(searchText.toLowerCase()) > -1);
          this.assets = this.filteredAssets;
          this.filteredAssets = this.filteredAssets.slice(0, this.itemsPerPage);
        } else {
          this.assets = this.assetsCache;
          this.filteredAssets = this.assets.slice(0, this.itemsPerPage);
        }
      });

    this.getAssets();
  }

  getAssets() {
    this.assetsService.getAssetsJson$
      .subscribe((assets) => {
        this.assets = Object.values(assets);
        this.assets.push({
          name: 'Liquid Bitcoin',
          ticker: 'L-BTC',
          asset_id: this.nativeAssetId,
        });
        this.assets = this.assets.sort((a: any, b: any) => a.name.localeCompare(b.name));
        this.assetsCache = this.assets;
        this.searchForm.controls['searchText'].enable();
        this.filteredAssets = this.assets.slice(0, this.itemsPerPage);
        this.isLoading = false;
      },
      (error) => {
        console.log(error);
        this.error = error;
        this.isLoading = false;
      });
  }

  pageChange(page: number) {
    const start = (page - 1) * this.itemsPerPage;
    this.filteredAssets = this.assets.slice(start, this.itemsPerPage + start);
  }

  trackByAsset(index: number, asset: any) {
    return asset.asset_id;
  }
}
