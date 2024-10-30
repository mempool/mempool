import { Component, OnInit } from '@angular/core';
import { StateService } from '@app/services/state.service';
import { Observable, merge, of } from 'rxjs';

@Component({
  selector: 'app-preview-title',
  templateUrl: './preview-title.component.html',
  styleUrls: [],
})
export class PreviewTitleComponent implements OnInit {
  network$: Observable<string>;

  constructor(
    public stateService: StateService,
  ) { }

  ngOnInit() {
    this.network$ = merge(of(''), this.stateService.networkChanged$);
  }
}
