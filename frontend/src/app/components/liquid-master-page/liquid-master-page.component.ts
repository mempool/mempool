import { Component, OnInit } from '@angular/core';
import { Env, StateService } from '../../services/state.service';
import { Observable} from 'rxjs';

@Component({
  selector: 'app-liquid-master-page',
  templateUrl: './liquid-master-page.component.html',
  styleUrls: ['./liquid-master-page.component.scss'],
})
export class LiquidMasterPageComponent implements OnInit {
  env: Env;
  connectionState$: Observable<number>;
  navCollapsed = false;
  isMobile = window.innerWidth <= 767.98;
  officialMempoolSpace = this.stateService.env.OFFICIAL_MEMPOOL_SPACE;

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
