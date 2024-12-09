import { Component, OnInit, ChangeDetectionStrategy, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject, EMPTY, merge, Observable, Subscription } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { WebsocketService } from '@app/services/websocket.service';
import { RbfTree } from '@interfaces/node-api.interface';
import { ApiService } from '@app/services/api.service';
import { StateService } from '@app/services/state.service';
import { SeoService } from '@app/services/seo.service';
import { OpenGraphService } from '@app/services/opengraph.service';
import { seoDescriptionNetwork } from '@app/shared/common.utils';

@Component({
  selector: 'app-rbf-list',
  templateUrl: './rbf-list.component.html',
  styleUrls: ['./rbf-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RbfList implements OnInit, OnDestroy {
  rbfTrees$: Observable<RbfTree[]>;
  nextRbfSubject = new BehaviorSubject(null);
  urlFragmentSubscription: Subscription;
  fullRbf: boolean;
  isLoading = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    public stateService: StateService,
    private websocketService: WebsocketService,
    private seoService: SeoService,
    private ogService: OpenGraphService,
  ) { }

  ngOnInit(): void {
    this.urlFragmentSubscription = this.route.fragment.subscribe((fragment) => {
      this.fullRbf = (fragment === 'fullrbf');
      this.websocketService.startTrackRbf(this.fullRbf ? 'fullRbf' : 'all');
      this.nextRbfSubject.next(null);
      this.isLoading = true;
    });

    this.rbfTrees$ = merge(
      this.nextRbfSubject.pipe(
        switchMap(() => {
          return this.apiService.getRbfList$(this.fullRbf);
        }),
        catchError((e) => {
          return EMPTY;
        })
      ),
      this.stateService.rbfLatest$
    )
    .pipe(
      tap(() => {
        this.isLoading = false;
      })
    );

    this.seoService.setTitle($localize`:@@5e3d5a82750902f159122fcca487b07f1af3141f:RBF Replacements`);
    this.seoService.setDescription($localize`:@@meta.description.rbf-list:See the most recent RBF replacements on the Bitcoin${seoDescriptionNetwork(this.stateService.network)} network, updated in real-time.`);
    this.ogService.setManualOgImage('rbf.jpg');
  }

  ngOnDestroy(): void {
    this.websocketService.stopTrackRbf();
  }
}
