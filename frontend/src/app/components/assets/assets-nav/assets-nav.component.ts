import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-assets-nav',
  templateUrl: './assets-nav.component.html',
  styleUrls: ['./assets-nav.component.scss']
})
export class AssetsNavComponent implements OnInit {
  activeTab = 0;
  searchForm: FormGroup;

  constructor(
    private formBuilder: FormBuilder,
  ) { }

  ngOnInit(): void {
    this.searchForm = this.formBuilder.group({
      searchText: [{ value: '', disabled: true }, Validators.required]
    });
  }

}
