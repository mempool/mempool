import { Component, OnInit } from '@angular/core';
import { StateService } from '@app/services/state.service';
import { Observable, Subscription, merge, of } from 'rxjs';
import { LanguageService } from '@app/services/language.service';
import { EnterpriseService } from '@app/services/enterprise.service';

@Component({
  selector: 'app-master-page-preview',
  templateUrl: './master-page-preview.component.html',
  styleUrls: ['./master-page-preview.component.scss'],
})
export class MasterPagePreviewComponent implements OnInit {
  network$: Observable<string>;
  lightning$: Observable<boolean>;
  officialMempoolSpace = this.stateService.env.OFFICIAL_MEMPOOL_SPACE;
  urlLanguage: string;
  subdomain = '';
  enterpriseInfo: any;
  enterpriseInfo$: Subscription;

  constructor(
    public stateService: StateService,
    private languageService: LanguageService,
    private enterpriseService: EnterpriseService,
  ) { }

  ngOnInit() {
    this.network$ = merge(of(''), this.stateService.networkChanged$);
    this.lightning$ = this.stateService.lightningChanged$;
    this.urlLanguage = this.languageService.getLanguageForUrl();
    this.subdomain = this.enterpriseService.getSubdomain();
    this.enterpriseInfo$ = this.enterpriseService.info$.subscribe(info => {
      this.enterpriseInfo = info;
    });
  }
}
