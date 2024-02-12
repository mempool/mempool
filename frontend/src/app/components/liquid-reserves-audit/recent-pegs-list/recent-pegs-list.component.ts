import { Component, OnInit, ChangeDetectionStrategy, Input } from '@angular/core';
import { BehaviorSubject, Observable, Subject, combineLatest, of, timer } from 'rxjs';
import { delayWhen, filter, map, share, shareReplay, switchMap, takeUntil, tap, throttleTime } from 'rxjs/operators';
import { ApiService } from '../../../services/api.service';
import { Env, StateService } from '../../../services/state.service';
import { AuditStatus, CurrentPegs, RecentPeg } from '../../../interfaces/node-api.interface';
import { WebsocketService } from '../../../services/websocket.service';
import { SeoService } from '../../../services/seo.service';

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
  startingIndexSubject: BehaviorSubject<number> = new BehaviorSubject(0);
  currentIndex: number = 0;
  lastPegBlockUpdate: number = 0;
  lastPegAmount: string = '';
  isLoad: boolean = true;

  private destroy$ = new Subject();
  
  constructor(
    private apiService: ApiService,
    public stateService: StateService,
    private websocketService: WebsocketService,
    private seoService: SeoService
  ) {
  }

  ngOnInit(): void {
    this.isLoading = !this.widget;
    this.env = this.stateService.env;
    this.skeletonLines = this.widget === true ? [...Array(5).keys()] : [...Array(15).keys()];

    if (!this.widget) {
      this.seoService.setTitle($localize`:@@a8b0889ea1b41888f1e247f2731cc9322198ca04:Recent Peg-In / Out's`);
      this.websocketService.want(['blocks']);
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
        tap(() => this.isPegCountLoading = false),
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
  }

  pageChange(page: number): void {
    this.startingIndexSubject.next((page - 1) * 15);
    this.page = page;
  }

}
