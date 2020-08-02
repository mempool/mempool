import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { StateService } from '../../services/state.service';
import { env } from 'src/app/app.constants';
import { Observable, merge, of } from 'rxjs';

@Component({
  selector: 'app-master-page',
  templateUrl: './master-page.component.html',
  styleUrls: ['./master-page.component.scss'],
})
export class MasterPageComponent implements OnInit {
  env = env;
  network$: Observable<string>;
  connectionState$: Observable<number>;
  navCollapsed = false;

  constructor(
    private stateService: StateService,
  ) { }

  ngOnInit() {
    this.connectionState$ = this.stateService.connectionState$;
    this.network$ = merge(of(''), this.stateService.networkChanged$);
  }

  collapse(): void {
    this.navCollapsed = !this.navCollapsed;
  }
}
