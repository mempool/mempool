import { Component, OnInit } from '@angular/core';
import { combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from 'src/app/services/api.service';
import { AssetsService } from 'src/app/services/assets.service';

@Component({
  selector: 'app-assets-featured',
  templateUrl: './assets-featured.component.html',
  styleUrls: ['./assets-featured.component.scss']
})
export class AssetsFeaturedComponent implements OnInit {
  featuredAssets$: Observable<any>;

  constructor(
    private apiService: ApiService,
    private assetsService: AssetsService,
  ) { }

  ngOnInit(): void {
    this.featuredAssets$ = combineLatest([
      this.assetsService.getAssetsJson$,
      this.apiService.listFeaturedAssets$(),
    ]).pipe(
      map(([assetsJson, featured]) => {
        return {
          assetsJson: assetsJson,
          featured: featured,
        };
      })
    );
  }

}
