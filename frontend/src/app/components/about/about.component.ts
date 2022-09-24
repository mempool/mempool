import { ChangeDetectionStrategy, Component, Inject, LOCALE_ID, OnInit } from '@angular/core';
import { WebsocketService } from '../../services/websocket.service';
import { SeoService } from '../../services/seo.service';
import { StateService } from '../../services/state.service';
import { Observable } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { IBackendInfo } from '../../interfaces/websocket.interface';
import { Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { ITranslators } from '../../interfaces/node-api.interface';

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AboutComponent implements OnInit {
  backendInfo$: Observable<IBackendInfo>;
  sponsors$: Observable<any>;
  translators$: Observable<ITranslators>;
  allContributors$: Observable<any>;
  frontendGitCommitHash = this.stateService.env.GIT_COMMIT_HASH;
  packetJsonVersion = this.stateService.env.PACKAGE_JSON_VERSION;
  officialMempoolSpace = this.stateService.env.OFFICIAL_MEMPOOL_SPACE;
  showNavigateToSponsor = false;

  constructor(
    private websocketService: WebsocketService,
    private seoService: SeoService,
    public stateService: StateService,
    private apiService: ApiService,
    private router: Router,
    @Inject(LOCALE_ID) public locale: string,
  ) { }

  ngOnInit() {
    this.backendInfo$ = this.stateService.backendInfo$;
    this.seoService.setTitle($localize`:@@004b222ff9ef9dd4771b777950ca1d0e4cd4348a:About`);
    this.websocketService.want(['blocks']);

    this.sponsors$ = this.apiService.getDonation$();
    this.translators$ = this.apiService.getTranslators$()
      .pipe(
        map((translators) => {
          for (const t in translators) {
            if (translators[t] === '') {
              delete translators[t]
            }
          }
          return translators;
        })
      );
    this.allContributors$ = this.apiService.getContributor$().pipe(
      map((contributors) => {
        return {
          regular: contributors.filter((user) => !user.core_constributor),
          core: contributors.filter((user) => user.core_constributor),
        };
      })
    );
  }

  sponsor(): void {
    if (this.officialMempoolSpace && this.stateService.env.BASE_MODULE === 'mempool') {
      this.router.navigateByUrl('/enterprise');
    } else {
      this.showNavigateToSponsor = true;
    }
  }
}
