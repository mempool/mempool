import { Component, OnInit } from '@angular/core';
import { StateService } from '../../services/state.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-bisq-master-page',
  templateUrl: './bisq-master-page.component.html',
  styleUrls: ['./bisq-master-page.component.scss'],
})
export class BisqMasterPageComponent implements OnInit {
  connectionState$: Observable<number>;
  navCollapsed = false;
  isMobile = window.innerWidth <= 767.98;

  constructor(
    private stateService: StateService,
  ) { }

  ngOnInit() {
    this.connectionState$ = this.stateService.connectionState$;
  }

  collapse(): void {
    this.navCollapsed = !this.navCollapsed;
  }
}
