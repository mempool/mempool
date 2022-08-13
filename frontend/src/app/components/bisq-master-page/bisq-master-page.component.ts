import { Component, OnInit } from '@angular/core';
import { Env, StateService } from '../../services/state.service';
import { Observable } from 'rxjs';
import { LanguageService } from 'src/app/services/language.service';
import { EnterpriseService } from 'src/app/services/enterprise.service';

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
  urlLanguage: string;

  constructor(
    private stateService: StateService,
    private languageService: LanguageService,
    private enterpriseService: EnterpriseService,
  ) { }

  ngOnInit() {
    this.env = this.stateService.env;
    this.connectionState$ = this.stateService.connectionState$;
    this.urlLanguage = this.languageService.getLanguageForUrl();
  }

  collapse(): void {
    this.navCollapsed = !this.navCollapsed;
  }

  onResize(event: any) {
    this.isMobile = window.innerWidth <= 767.98;
  }
}
