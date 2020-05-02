import { Component, OnInit } from '@angular/core';
import { AssetsService } from '../services/assets.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-assets',
  templateUrl: './assets.component.html',
  styleUrls: ['./assets.component.scss']
})
export class AssetsComponent implements OnInit {
  nativeAssetId = environment.nativeAssetId;

  isLoading = true;
  error: any;

  assets: any;

  constructor(
    private assetsService: AssetsService,
  ) { }

  ngOnInit() {
    this.assetsService.getAssetsJson$()
      .subscribe((assets) => {
        this.assets = Object.values(assets);
        this.assets.push({
          name: 'Liquid Bitcoin',
          ticker: 'L-BTC',
          asset_id: this.nativeAssetId,
        });
        this.assets = this.assets.sort((a: any, b: any) => a.name.localeCompare(b.name));
        this.isLoading = false;
      },
      (error) => {
        console.log(error);
        this.error = error;
        this.isLoading = false;
      });
  }

}
