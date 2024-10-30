import { ActivatedRoute, Router } from '@angular/router';
import { Component, OnInit, ChangeDetectionStrategy, Input, Inject, LOCALE_ID, ChangeDetectorRef } from '@angular/core';
import { BehaviorSubject, Observable, Subject, Subscription, combineLatest, of, timer } from 'rxjs';
import { delayWhen, filter, map, share, shareReplay, switchMap, take, takeUntil, tap, throttleTime } from 'rxjs/operators';
import { ApiService } from '@app/services/api.service';
import { Env, StateService } from '@app/services/state.service';
import { AuditStatus, CurrentPegs, RecentPeg } from '@interfaces/node-api.interface';
import { WebsocketService } from '@app/services/websocket.service';
import { SeoService } from '@app/services/seo.service';

@Component({
  selector: 'app-recent-pegs-list',
  templateUrl: './recent-pegs-list.component.html',
  styleUrls: ['./recent-pegs-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecentPegsListComponent implements OnInit {
  @Input() widget: boolean = false;
  @Input() recentPegsList$: Observable<RecentPeg[]>;

  env: Env;
  isLoading = true;
  isPegCountLoading = true;
  page = 1;
  pageSize = 15;
  maxSize = window.innerWidth <= 767.98 ? 3 : 5;
  skeletonLines: number[] = [];
  auditStatus$: Observable<AuditStatus>;
  auditUpdated$: Observable<boolean>;
  lastReservesBlockUpdate: number = 0;
  currentPeg$: Observable<CurrentPegs>;
  pegsCount$: Observable<number>;
  pegsCount: number;
  startingIndexSubject: BehaviorSubject<number> = new BehaviorSubject(0);
  currentIndex: number = 0;
  lastPegBlockUpdate: number = 0;
  lastPegAmount: string = '';
  isLoad: boolean = true;
  paramSubscription: Subscription;
  keyNavigationSubscription: Subscription;
  dir: 'rtl' | 'ltr' = 'ltr';

  private destroy$ = new Subject();

  constructor(
    private apiService: ApiService,
    private cd: ChangeDetectorRef,
    public stateService: StateService,
    private websocketService: WebsocketService,
    private seoService: SeoService,
    private route: ActivatedRoute,
    private router: Router,
    @Inject(LOCALE_ID) private locale: string,
  ) {
    if (this.locale.startsWith('ar') || this.locale.startsWith('fa') || this.locale.startsWith('he')) {
      this.dir = 'rtl';
    }
  }

  ngOnInit(): void {
    this.isLoading = !this.widget;
    this.env = this.stateService.env;
    this.skeletonLines = this.widget === true ? [...Array(5).keys()] : [...Array(15).keys()];

    if (!this.widget) {
      this.seoService.setTitle($localize`:@@a8b0889ea1b41888f1e247f2731cc9322198ca04:Recent Peg-In / Out's`);
      this.websocketService.want(['blocks']);

      this.paramSubscription = this.route.params.pipe(
        tap((params) => {
          this.page = +params['page'] || 1;
          this.startingIndexSubject.next((this.page - 1) * 15);
        }),
      ).subscribe();

      const prevKey = this.dir === 'ltr' ? 'ArrowLeft' : 'ArrowRight';
      const nextKey = this.dir === 'ltr' ? 'ArrowRight' : 'ArrowLeft';

      this.keyNavigationSubscription = this.stateService.keyNavigation$
      .pipe(
        filter((event) => event.key === prevKey || event.key === nextKey),
        tap((event) => {
          if (event.key === prevKey && this.page > 1) {
            this.page--;
            this.isLoading = true;
            this.cd.markForCheck();
          }
          if (event.key === nextKey && this.page < this.pegsCount / this.pageSize) {
            this.page++;
            this.isLoading = true;
            this.cd.markForCheck();
          }
        }),
        throttleTime(1000, undefined, { leading: true, trailing: true }),
      ).subscribe(() => {
        this.pageChange(this.page);
      });

      this.auditStatus$ = this.stateService.blocks$.pipe(
        takeUntil(this.destroy$),
        throttleTime(40000),
        delayWhen(_ => this.isLoad ? timer(0) : timer(2000)),
        tap(() => this.isLoad = false),
        switchMap(() => this.apiService.federationAuditSynced$()),
        shareReplay(1)
      );

      this.currentPeg$ = this.auditStatus$.pipe(
        filter(auditStatus => auditStatus.isAuditSynced === true),
        switchMap(_ =>
          this.apiService.liquidPegs$().pipe(
            filter((currentPegs) => currentPegs.lastBlockUpdate >= this.lastPegBlockUpdate),
            tap((currentPegs) => {
              this.lastPegBlockUpdate = currentPegs.lastBlockUpdate;
            })
          )
        ),
        share()
      );

      this.auditUpdated$ = combineLatest([
        this.auditStatus$,
        this.currentPeg$
      ]).pipe(
        filter(([auditStatus, _]) => auditStatus.isAuditSynced === true),
        map(([auditStatus, currentPeg]) => ({
          lastBlockAudit: auditStatus.lastBlockAudit,
          currentPegAmount: currentPeg.amount
        })),
        switchMap(({ lastBlockAudit, currentPegAmount }) => {
          const blockAuditCheck = lastBlockAudit > this.lastReservesBlockUpdate;
          const amountCheck = currentPegAmount !== this.lastPegAmount;
          this.lastReservesBlockUpdate = lastBlockAudit;
          this.lastPegAmount = currentPegAmount;
          return of(blockAuditCheck || amountCheck);
        }),
        share()
      );

      this.pegsCount$ = this.auditUpdated$.pipe(
        filter(auditUpdated => auditUpdated === true),
        tap(() => this.isPegCountLoading = true),
        switchMap(_ => this.apiService.pegsCount$()),
        map((data) => data.pegs_count),
        tap((pegsCount) => {
          this.isPegCountLoading = false;
          this.pegsCount = pegsCount;
        }),
        share()
      );

      this.recentPegsList$ = combineLatest([
        this.auditStatus$,
        this.auditUpdated$,
        this.startingIndexSubject
      ]).pipe(
        filter(([auditStatus, auditUpdated, startingIndex]) => {
          const auditStatusCheck = auditStatus.isAuditSynced === true;
          const auditUpdatedCheck = auditUpdated === true;
          const startingIndexCheck = startingIndex !== this.currentIndex;
          return auditStatusCheck && (auditUpdatedCheck || startingIndexCheck);
        }),
        tap(([_, __, startingIndex]) => {
          this.currentIndex = startingIndex;
          this.isLoading = true;
        }),
        switchMap(([_, __, startingIndex]) => this.apiService.recentPegsList$(startingIndex)),
        tap(() => this.isLoading = false),
        share()
      );

    }
  }

  ngOnDestroy(): void {
    this.destroy$.next(1);
    this.destroy$.complete();
    this.paramSubscription?.unsubscribe();
    this.keyNavigationSubscription?.unsubscribe();
  }

  pageChange(page: number): void {
    this.router.navigate(['audit', 'pegs', page]);
  }

}
