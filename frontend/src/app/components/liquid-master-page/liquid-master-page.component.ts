import { Component, OnInit } from '@angular/core';
import { Env, StateService } from '../../services/state.service';
import { merge, Observable, of} from 'rxjs';
import { LanguageService } from 'src/app/services/language.service';
import { EnterpriseService } from 'src/app/services/enterprise.service';

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
  network$: Observable<string>;
  urlLanguage: string;

  constructor(
    private stateService: StateService,
    private languageService: LanguageService,
    private enterpriseService: EnterpriseService,
  ) { }

  ngOnInit() {
    this.env = this.stateService.env;
    this.connectionState$ = this.stateService.connectionState$;
    this.network$ = merge(of(''), this.stateService.networkChanged$);
    this.urlLanguage = this.languageService.getLanguageForUrl();
  }

  collapse(): void {
    this.navCollapsed = !this.navCollapsed;
  }

  onResize(event: any) {
    this.isMobile = window.innerWidth <= 767.98;
  }
}
