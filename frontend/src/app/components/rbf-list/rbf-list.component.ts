import { Component, OnInit, ChangeDetectionStrategy, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject, EMPTY, merge, Observable, Subscription } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { WebsocketService } from '../../services/websocket.service';
import { RbfTree } from '../../interfaces/node-api.interface';
import { ApiService } from '../../services/api.service';
import { StateService } from '../../services/state.service';

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
  fullRbfEnabled: boolean;
  fullRbf: boolean;
  isLoading = true;

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
      this.nextRbfSubject.next(null);
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
  }

  toggleFullRbf(event) {
    this.router.navigate([], {
      relativeTo: this.route,
      fragment: this.fullRbf ? null : 'fullrbf'
    });
  }

  isFullRbf(tree: RbfTree): boolean {
    return tree.fullRbf;
  }

  isMined(tree: RbfTree): boolean {
    return tree.mined;
  }

  // pageChange(page: number) {
  //   this.fromTreeSubject.next(this.lastTreeId);
  // }

  ngOnDestroy(): void {
    this.websocketService.stopTrackRbf();
  }
}