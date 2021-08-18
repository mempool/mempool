import { Component, OnInit } from '@angular/core';
import { Env, StateService } from '../../services/state.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-bisq-master-page',
  templateUrl: './bisq-master-page.component.html',
  styleUrls: ['./bisq-master-page.component.scss'],
})
export class BisqMasterPageComponent implements OnInit {
  connectionState$: Observable<number>;
  navCollapsed = false;
  env: Env;
  isMobile = window.innerWidth <= 767.98;
  
  constructor(
    private stateService: StateService,
  ) { }

  ngOnInit() {
    this.env = this.stateService.env;
    this.connectionState$ = this.stateService.connectionState$;
  }

  collapse(): void {
    this.navCollapsed = !this.navCollapsed;
  }

  onResize(event: any) {
    this.isMobile = window.innerWidth <= 767.98;
  }
}
