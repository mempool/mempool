import { Component, OnInit, ChangeDetectionStrategy, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject, EMPTY, merge, Observable, Subscription } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { WebsocketService } from 'src/app/services/websocket.service';
import { RbfInfo } from '../../interfaces/node-api.interface';
import { ApiService } from '../../services/api.service';
import { StateService } from '../../services/state.service';

@Component({
  selector: 'app-rbf-list',
  templateUrl: './rbf-list.component.html',
  styleUrls: ['./rbf-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RbfList implements OnInit, OnDestroy {
  rbfChains$: Observable<RbfInfo[][]>;
  fromChainSubject = new BehaviorSubject(null);
  urlFragmentSubscription: Subscription;
  fullRbfEnabled: boolean;
  fullRbf: boolean;
  isLoading = true;
  firstChainId: string;
  lastChainId: string;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    public stateService: StateService,
    private websocketService: WebsocketService,
  ) {
    this.fullRbfEnabled = stateService.env.FULL_RBF_ENABLED;
  }

  ngOnInit(): void {
    this.urlFragmentSubscription = this.route.fragment.subscribe((fragment) => {
      this.fullRbf = (fragment === 'fullrbf');
      this.websocketService.startTrackRbf(this.fullRbf ? 'fullRbf' : 'all');
      this.fromChainSubject.next(this.firstChainId);
    });

    this.rbfChains$ = merge(
      this.fromChainSubject.pipe(
        switchMap((fromChainId) => {
          return this.apiService.getRbfList$(this.fullRbf, fromChainId || undefined)
        }),
        catchError((e) => {
          return EMPTY;
        })
      ),
      this.stateService.rbfLatest$
    )
    .pipe(
      tap((result: RbfInfo[][]) => {
        this.isLoading = false;
        if (result && result.length && result[0].length) {
          this.lastChainId = result[result.length - 1][0].tx.txid;
        }
      })
    );
  }

  toggleFullRbf(event) {
    this.router.navigate([], {
      relativeTo: this.route,
      fragment: this.fullRbf ? null : 'fullrbf'
    });
  }

  isFullRbf(chain: RbfInfo[]): boolean {
    return chain.slice(0, -1).some(entry => !entry.tx.rbf);
  }

  isMined(chain: RbfInfo[]): boolean {
    return chain.some(entry => entry.mined);
  }

  // pageChange(page: number) {
  //   this.fromChainSubject.next(this.lastChainId);
  // }

  ngOnDestroy(): void {
    this.websocketService.stopTrackRbf();
  }
}