import { Component, OnInit, ChangeDetectionStrategy, EventEmitter, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AssetsService } from 'src/app/services/assets.service';
import { StateService } from 'src/app/services/state.service';

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

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private assetsService: AssetsService,
    private stateService: StateService,
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
