import { ChangeDetectionStrategy, Component, ElementRef, Inject, LOCALE_ID, OnInit, ViewChild } from '@angular/core';
import { WebsocketService } from '@app/services/websocket.service';
import { SeoService } from '@app/services/seo.service';
import { OpenGraphService } from '@app/services/opengraph.service';
import { StateService } from '@app/services/state.service';
import { Observable } from 'rxjs';
import { ApiService } from '@app/services/api.service';
import { IBackendInfo } from '@interfaces/websocket.interface';
import { Router, ActivatedRoute } from '@angular/router';
import { map, share, tap } from 'rxjs/operators';
import { ITranslators } from '@interfaces/node-api.interface';
import { DOCUMENT } from '@angular/common';
import { EnterpriseService } from '@app/services/enterprise.service';

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AboutComponent implements OnInit {
  @ViewChild('promoVideo') promoVideo: ElementRef;
  backendInfo$: Observable<IBackendInfo>;
  frontendGitCommitHash = this.stateService.env.GIT_COMMIT_HASH;
  packetJsonVersion = this.stateService.env.PACKAGE_JSON_VERSION;
  officialMempoolSpace = this.stateService.env.OFFICIAL_MEMPOOL_SPACE;
  showNavigateToSponsor = false;

  profiles$: Observable<any>;
  translators$: Observable<ITranslators>;
  allContributors$: Observable<any>;
  ogs$: Observable<any>;

  constructor(
    private websocketService: WebsocketService,
    private seoService: SeoService,
    private ogService: OpenGraphService,
    public stateService: StateService,
    private enterpriseService: EnterpriseService,
    private apiService: ApiService,
    private router: Router,
    private route: ActivatedRoute,
    @Inject(LOCALE_ID) public locale: string,
    @Inject(DOCUMENT) private document: Document,
  ) { }

  ngOnInit() {
    this.backendInfo$ = this.stateService.backendInfo$;
    this.seoService.setTitle($localize`:@@004b222ff9ef9dd4771b777950ca1d0e4cd4348a:About`);
    this.seoService.setDescription($localize`:@@meta.description.about:Learn more about The Mempool Open Source Project®\: enterprise sponsors, individual sponsors, integrations, who contributes, FOSS licensing, and more.`);
    this.ogService.setManualOgImage('about.jpg');
    this.websocketService.want(['blocks']);

    this.profiles$ = this.apiService.getAboutPageProfiles$().pipe(
      tap((profiles: any) => {
        const scrollToSponsors = this.route.snapshot.fragment === 'community-sponsors';
        if (scrollToSponsors && !profiles?.whales?.length && !profiles?.chads?.length) {
          return;
        } else {
          this.goToAnchor(scrollToSponsors)
        }
      }),
      share(),
    )

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

    this.ogs$ = this.apiService.getOgs$();

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

  goToAnchor(scrollToSponsor = false) {
    if (!scrollToSponsor) {
      return;
    }
    setTimeout(() => {
      if (this.route.snapshot.fragment) {
        const el = scrollToSponsor ? this.document.getElementById('community-sponsors-anchor') : this.document.getElementById(this.route.snapshot.fragment);
        if (el) {
          if (scrollToSponsor) {
            el.scrollIntoView({behavior: 'smooth', block: 'center', inline: 'center'});
          } else {
            el.scrollIntoView({behavior: 'smooth'});
          }
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

  showSubtitles(language): boolean {
    return ( this.locale.startsWith( language ) && !this.locale.startsWith('en') );
  }

  unmutePromoVideo(): void {
    this.promoVideo.nativeElement.muted = false;
  }

  onSponsorClick(e): boolean {
    this.enterpriseService.goal(5);
    return true;
  }

  onEnterpriseClick(e): boolean {
    this.enterpriseService.goal(6);
    return true;
  }
}
