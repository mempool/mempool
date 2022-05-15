import { Component, OnInit, ChangeDetectionStrategy, EventEmitter, Output, ViewChild, HostListener } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AssetsService } from 'src/app/services/assets.service';
import { StateService } from 'src/app/services/state.service';
import { Observable, of, Subject, merge, zip } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, filter, catchError, map } from 'rxjs/operators';
import { ElectrsApiService } from 'src/app/services/electrs-api.service';
import { RelativeUrlPipe } from 'src/app/shared/pipes/relative-url/relative-url.pipe';
import { ApiService } from 'src/app/services/api.service';
import { SearchResultsComponent } from './search-results/search-results.component';

@Component({
  selector: 'app-search-form',
  templateUrl: './search-form.component.html',
  styleUrls: ['./search-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchFormComponent implements OnInit {
  network = '';
  assets: object = {};
  isSearching = false;
  typeAhead$: Observable<any>;
  searchForm: FormGroup;

  regexAddress = /^([a-km-zA-HJ-NP-Z1-9]{26,35}|[a-km-zA-HJ-NP-Z1-9]{80}|[a-z]{2,5}1[ac-hj-np-z02-9]{8,100}|[A-Z]{2,5}1[AC-HJ-NP-Z02-9]{8,100})$/;
  regexBlockhash = /^[0]{8}[a-fA-F0-9]{56}$/;
  regexTransaction = /^([a-fA-F0-9]{64}):?(\d+)?$/;
  regexBlockheight = /^[0-9]+$/;
  focus$ = new Subject<string>();
  click$ = new Subject<string>();

  @Output() searchTriggered = new EventEmitter();
  @ViewChild('searchResults') searchResults: SearchResultsComponent;
  @HostListener('keydown', ['$event']) keydown($event) {
    this.handleKeyDown($event);
  }

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private assetsService: AssetsService,
    private stateService: StateService,
    private electrsApiService: ElectrsApiService,
    private apiService: ApiService,
    private relativeUrlPipe: RelativeUrlPipe,
  ) { }

  ngOnInit() {
    this.stateService.networkChanged$.subscribe((network) => this.network = network);

    this.searchForm = this.formBuilder.group({
      searchText: ['', Validators.required],
    });

    if (this.network === 'liquid' || this.network === 'liquidtestnet') {
      this.assetsService.getAssetsMinimalJson$
        .subscribe((assets) => {
          this.assets = assets;
        });
    }

    this.typeAhead$ = this.searchForm.get('searchText').valueChanges
      .pipe(
        map((text) => {
          if (this.network === 'bisq' && text.match(/^(b)[^c]/i)) {
            return text.substr(1);
          }
          return text.trim();
        }),
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((text) => {
          if (!text.length) {
            return of([
              [],
              {
                nodes: [],
                channels: [],
              }
            ]);
          }
          return zip(
            this.electrsApiService.getAddressesByPrefix$(text).pipe(catchError(() => of([]))),
            this.apiService.lightningSearch$(text).pipe(catchError(() => of({
              nodes: [],
              channels: [],
            }))),
          );
        }),
        map((result: any[]) => {
          if (this.network === 'bisq') {
            return result[0].map((address: string) => 'B' + address);
          }
          return {
            addresses: result[0],
            nodes: result[1].nodes,
            channels: result[1].channels,
            totalResults: result[0].length + result[1].nodes.length + result[1].channels.length,
          };
        })
      );
  }
  handleKeyDown($event) {
    this.searchResults.handleKeyDown($event);
  }

  itemSelected() {
    setTimeout(() => this.search());
  }

  selectedResult(result: any) {
    if (typeof result === 'string') {
      this.navigate('/address/', result);
    } else if (result.alias) {
      this.navigate('/lightning/node/', result.public_key);
    } else if (result.short_id) {
      this.navigate('/lightning/channel/', result.id);
    }
  }

  search() {
    const searchText = this.searchForm.value.searchText.trim();
    if (searchText) {
      this.isSearching = true;
      if (this.regexAddress.test(searchText)) {
        this.navigate('/address/', searchText);
      } else if (this.regexBlockhash.test(searchText) || this.regexBlockheight.test(searchText)) {
        this.navigate('/block/', searchText);
      } else if (this.regexTransaction.test(searchText)) {
        const matches = this.regexTransaction.exec(searchText);
        if (this.network === 'liquid' || this.network === 'liquidtestnet') {
          if (this.assets[matches[1]]) {
            this.navigate('/assets/asset/', matches[1]);
          }
          this.electrsApiService.getAsset$(matches[1])
            .subscribe(
              () => { this.navigate('/assets/asset/', matches[1]); },
              () => {
                this.electrsApiService.getBlock$(matches[1])
                  .subscribe(
                    (block) => { this.navigate('/block/', matches[1], { state: { data: { block } } }); },
                    () => { this.navigate('/tx/', matches[0]); });
              }
            );
        } else {
          this.navigate('/tx/', matches[0]);
        }
      } else {
        this.isSearching = false;
      }
    }
  }

  navigate(url: string, searchText: string, extras?: any) {
    this.router.navigate([this.relativeUrlPipe.transform(url), searchText], extras);
    this.searchTriggered.emit();
    this.searchForm.setValue({
      searchText: '',
    });
    this.isSearching = false;
  }
}
