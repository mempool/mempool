import { Component, OnInit, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NgbTypeahead } from '@ng-bootstrap/ng-bootstrap';
import { merge, Observable, of, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, switchMap } from 'rxjs/operators';
import { AssetsService } from '@app/services/assets.service';
import { SeoService } from '@app/services/seo.service';
import { StateService } from '@app/services/state.service';
import { RelativeUrlPipe } from '@app/shared/pipes/relative-url/relative-url.pipe';
import { environment } from '@environments/environment';
import { AssetRegistryItem } from '@interfaces/electrs.interface';

@Component({
  selector: 'app-assets-nav',
  templateUrl: './assets-nav.component.html',
  styleUrls: ['./assets-nav.component.scss'],
  standalone: false,
})
export class AssetsNavComponent implements OnInit {
  @ViewChild('instance', {static: true}) instance: NgbTypeahead;
  nativeAssetId = this.stateService.network === 'liquidtestnet' ? environment.nativeTestAssetId : environment.nativeAssetId;
  searchForm: UntypedFormGroup;
  assetsCache: AssetRegistryItem[];

  typeaheadSearchFn: ((text: Observable<string>) => Observable<readonly any[]>);
  formatterFn = (asset: AssetRegistryItem) => asset.name + ' (' + asset.ticker  + ')';
  focus$ = new Subject<string>();
  click$ = new Subject<string>();

  itemsPerPage = 15;

  constructor(
    private formBuilder: UntypedFormBuilder,
    private seoService: SeoService,
    private router: Router,
    private assetsService: AssetsService,
    private stateService: StateService,
    private relativeUrlPipe: RelativeUrlPipe,
  ) { }

  ngOnInit(): void {
    this.seoService.setTitle($localize`:@@ee8f8008bae6ce3a49840c4e1d39b4af23d4c263:Assets`);
    this.seoService.setDescription($localize`:@@meta.description.liquid.assets:Explore all the assets issued on the Liquid network like LBTC, L-CAD, USDT, and more.`);
    this.typeaheadSearchFn = this.typeaheadSearch;

    this.searchForm = this.formBuilder.group({
      searchText: [{ value: '', disabled: false }, Validators.required]
    });
  }

  typeaheadSearch = (text$: Observable<string>) => {
    const debouncedText$ = text$.pipe(
      debounceTime(200),
      distinctUntilChanged()
    );
    const clicksWithClosedPopup$ = this.click$.pipe(filter(() => !this.instance.isPopupOpen()));
    const inputFocus$ = this.focus$;

    return merge(debouncedText$, inputFocus$, clicksWithClosedPopup$)
      .pipe(
        switchMap((searchText) => {
          if (!searchText.length) {
            return of([]);
          }
          return this.assetsService.searchLiquidAssets$(searchText, this.itemsPerPage);
        }),
      );
  };

  itemSelected() {
    setTimeout(() => this.search());
  }

  search() {
    const searchText = this.searchForm.value.searchText;
    this.navigate('/assets/asset/', searchText.asset_id);
  }

  navigate(url: string, searchText: string, extras?: any) {
    this.router.navigate([this.relativeUrlPipe.transform(url), searchText], extras);
    this.searchForm.setValue({
      searchText: '',
    });
  }

}
