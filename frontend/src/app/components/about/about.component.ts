import { ChangeDetectionStrategy, Component, Inject, LOCALE_ID, OnInit } from '@angular/core';
import { WebsocketService } from '../../services/websocket.service';
import { SeoService } from '../../services/seo.service';
import { StateService } from '../../services/state.service';
import { Observable } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { IBackendInfo } from '../../interfaces/websocket.interface';
import { Router, ActivatedRoute } from '@angular/router';
import { map, tap } from 'rxjs/operators';
import { ITranslators } from '../../interfaces/node-api.interface';
import { DOCUMENT } from '@angular/common';

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
    private route: ActivatedRoute,
    @Inject(LOCALE_ID) public locale: string,
    @Inject(DOCUMENT) private document: Document,
  ) { }

  ngOnInit() {
    this.backendInfo$ = this.stateService.backendInfo$;
    this.seoService.setTitle($localize`:@@004b222ff9ef9dd4771b777950ca1d0e4cd4348a:About`);
    this.websocketService.want(['blocks']);

    this.sponsors$ = this.apiService.getDonation$()
      .pipe(
        tap(() => this.goToAnchor())
      );
    this.translators$ = this.apiService.getTranslators$()
      .pipe(
        map((translators) => {
          for (const t in translators) {
            if (translators[t] === '') {
              delete translators[t];
            }
          }
          return translators;
        }),
        tap(() => this.goToAnchor())
      );
    this.allContributors$ = this.apiService.getContributor$().pipe(
      map((contributors) => {
        return {
          regular: contributors.filter((user) => !user.core_constributor),
          core: contributors.filter((user) => user.core_constributor),
        };
      }),
      tap(() => this.goToAnchor())
    );
  }

  ngAfterViewInit() {
    this.goToAnchor();
  }

  goToAnchor() {
    setTimeout(() => {
      if (this.route.snapshot.fragment) {
        if (this.document.getElementById(this.route.snapshot.fragment)) {
          this.document.getElementById(this.route.snapshot.fragment).scrollIntoView({behavior: 'smooth'});
        }
      }
    }, 1);
  }

  sponsor(): void {
    if (this.officialMempoolSpace && this.stateService.env.BASE_MODULE === 'mempool') {
      this.router.navigateByUrl('/enterprise');
    } else {
      this.showNavigateToSponsor = true;
    }
  }

  showSubtitles(language) {
    return ( this.locale.startsWith( language ) && !this.locale.startsWith('en') );
  }
}
