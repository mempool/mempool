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
      } else {
        this.router.navigate(['/tx/', searchText]);
      }
      this.searchForm.setValue({
        searchText: '',
      });
    }
  }
}
