import { ChangeDetectionStrategy, Component, Inject, LOCALE_ID, OnInit } from '@angular/core';
import { WebsocketService } from '../../services/websocket.service';
import { SeoService } from 'src/app/services/seo.service';
import { StateService } from 'src/app/services/state.service';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from 'src/app/services/api.service';
import { IBackendInfo } from 'src/app/interfaces/websocket.interface';
import { Router } from '@angular/router';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AboutComponent implements OnInit {
  backendInfo$: Observable<IBackendInfo>;
  sponsors$: Observable<any>;
  thirdPartyLicenses$: Observable<string>;
  allContributors$: Observable<any>;
  frontendGitCommitHash = this.stateService.env.GIT_COMMIT_HASH;
  packetJsonVersion = this.stateService.env.PACKAGE_JSON_VERSION;
  officialMempoolSpace = this.stateService.env.OFFICIAL_MEMPOOL_SPACE;
  showNavigateToSponsor = false;

  constructor(
    private websocketService: WebsocketService,
    private seoService: SeoService,
    public stateService: StateService,
    private httpClient: HttpClient,
    private apiService: ApiService,
    private router: Router,
    @Inject(LOCALE_ID) public locale: string,
  ) { }

  ngOnInit() {
    this.backendInfo$ = this.stateService.backendInfo$;
    this.seoService.setTitle($localize`:@@004b222ff9ef9dd4771b777950ca1d0e4cd4348a:About`);
    this.websocketService.want(['blocks']);

    this.sponsors$ = this.apiService.getDonation$();
    this.thirdPartyLicenses$ = this.getThirdPartyLicenses$();
    this.allContributors$ = this.apiService.getContributor$().pipe(
      map((contributors) => {
        return {
          regular: contributors.filter((user) => !user.core_constributor),
          core: contributors.filter((user) => user.core_constributor),
        };
      })
    );
  }

  getThirdPartyLicenses$(): Observable<string> {
    return this.httpClient.get<string>('/3rdpartylicenses.txt', { responseType: 'text' as 'json' });
  }

  sponsor() {
    if (this.officialMempoolSpace && this.stateService.env.BASE_MODULE === 'mempool') {
      this.router.navigateByUrl('/sponsor');
    } else {
      this.showNavigateToSponsor = true;
    }
  }
}
