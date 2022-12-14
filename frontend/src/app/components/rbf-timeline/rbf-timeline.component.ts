import { Component, Input, OnInit, OnChanges, Inject, LOCALE_ID } from '@angular/core';
import { Router } from '@angular/router';
import { RbfInfo } from '../../interfaces/node-api.interface';
import { StateService } from '../../services/state.service';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-rbf-timeline',
  templateUrl: './rbf-timeline.component.html',
  styleUrls: ['./rbf-timeline.component.scss'],
})
export class RbfTimelineComponent implements OnInit, OnChanges {
  @Input() replacements: RbfInfo[];
  @Input() txid: string;
  mined: boolean;

  dir: 'rtl' | 'ltr' = 'ltr';

  constructor(
    private router: Router,
    private stateService: StateService,
    private apiService: ApiService,
    @Inject(LOCALE_ID) private locale: string,
  ) {
    if (this.locale.startsWith('ar') || this.locale.startsWith('fa') || this.locale.startsWith('he')) {
      this.dir = 'rtl';
    }
  }

  ngOnInit(): void {
    this.mined = this.replacements.some(entry => entry.mined);
  }

  ngOnChanges(): void {
    this.mined = this.replacements.some(entry => entry.mined);
  }
}
