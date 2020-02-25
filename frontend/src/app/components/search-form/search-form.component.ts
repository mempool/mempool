import { Component, OnInit, Input, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-search-form',
  templateUrl: './search-form.component.html',
  styleUrls: ['./search-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SearchFormComponent implements OnInit {
  searchForm: FormGroup;

  searchButtonText = 'Search';
  searchBoxPlaceholderText = 'Transaction, address, block hash...';

  regexAddress = /^([a-km-zA-HJ-NP-Z1-9]{26,35}|[a-km-zA-HJ-NP-Z1-9]{80}|[a-z]{2,5}1[ac-hj-np-z02-9]{8,87})$/;
  regexBlockhash = /^[0]{8}[a-fA-F0-9]{56}$/;
  regexTransaction = /^[a-fA-F0-9]{64}$/;

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
  ) { }

  ngOnInit() {
    this.searchForm = this.formBuilder.group({
      searchText: ['', Validators.required],
    });
  }

  search() {
    const searchText = this.searchForm.value.searchText.trim();
    if (searchText) {
      if (this.regexAddress.test(searchText)) {
        this.router.navigate(['/address/', searchText]);
      } else if (this.regexBlockhash.test(searchText)) {
        this.router.navigate(['/block/', searchText]);
      } else if (this.regexTransaction.test(searchText)) {
        this.router.navigate(['/tx/', searchText]);
      } else {
        return;
      }
      this.searchForm.setValue({
        searchText: '',
      });
    }
  }
}
