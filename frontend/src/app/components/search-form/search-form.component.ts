import { Component, OnInit, ChangeDetectionStrategy, EventEmitter, Output, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AssetsService } from 'src/app/services/assets.service';
import { StateService } from 'src/app/services/state.service';
import { Observable, of, Subject, merge } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, filter } from 'rxjs/operators';
import { ElectrsApiService } from 'src/app/services/electrs-api.service';
import { NgbTypeahead } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-search-form',
  templateUrl: './search-form.component.html',
  styleUrls: ['./search-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SearchFormComponent implements OnInit {
  network = '';
  assets: object = {};

  searchForm: FormGroup;
  @Output() searchTriggered = new EventEmitter();

  regexAddress = /^([a-km-zA-HJ-NP-Z1-9]{26,35}|[a-km-zA-HJ-NP-Z1-9]{80}|[a-z]{2,5}1[ac-hj-np-z02-9]{8,87})$/;
  regexBlockhash = /^[0]{8}[a-fA-F0-9]{56}$/;
  regexTransaction = /^[a-fA-F0-9]{64}$/;
  regexBlockheight = /^[0-9]+$/;

  @ViewChild('instance', {static: true}) instance: NgbTypeahead;
  focus$ = new Subject<string>();
  click$ = new Subject<string>();

  typeaheadSearch = (text$: Observable<string>) => {
    const debouncedText$ = text$.pipe(debounceTime(200), distinctUntilChanged());
    const clicksWithClosedPopup$ = this.click$.pipe(filter(() => !this.instance.isPopupOpen()));
    const inputFocus$ = this.focus$;

    return merge(debouncedText$, inputFocus$, clicksWithClosedPopup$)
      .pipe(
        switchMap((text) => {
          if (!text.length) { return of([]); }
          return this.electrsApiService.getAddressesByPrefix$(text);
        })
      );
    }

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private assetsService: AssetsService,
    private stateService: StateService,
    private electrsApiService: ElectrsApiService,
  ) { }

  ngOnInit() {
    this.stateService.networkChanged$.subscribe((network) => this.network = network);

    this.searchForm = this.formBuilder.group({
      searchText: ['', Validators.required],
    });
    if (this.network === 'liquid') {
      this.assetsService.getAssetsMinimalJson$
        .subscribe((assets) => {
          this.assets = assets;
        });
    }
  }

  itemSelected() {
    setTimeout(() => this.search());
  }

  search() {
    const searchText = this.searchForm.value.searchText.trim();
    if (searchText) {
      if (this.regexAddress.test(searchText)) {
        this.router.navigate([(this.network ? '/' + this.network : '') + '/address/', searchText]);
        this.searchTriggered.emit();
      } else if (this.regexBlockhash.test(searchText) || this.regexBlockheight.test(searchText)) {
        this.router.navigate([(this.network ? '/' + this.network : '') + '/block/', searchText]);
        this.searchTriggered.emit();
      } else if (this.regexTransaction.test(searchText)) {
        if (this.network === 'liquid' && this.assets[searchText]) {
          this.router.navigate([(this.network ? '/' + this.network : '') + '/asset/', searchText]);
        } else {
          this.router.navigate([(this.network ? '/' + this.network : '') + '/tx/', searchText]);
        }
        this.searchTriggered.emit();
      } else {
        return;
      }
      this.searchForm.setValue({
        searchText: '',
      });
    }
  }
}
