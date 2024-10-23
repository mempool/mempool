import { Component, OnInit, ChangeDetectionStrategy, Input } from '@angular/core';
import { Observable, Subject, combineLatest, of, timer } from 'rxjs';
import { delayWhen, filter, map, share, shareReplay, switchMap, takeUntil, tap, throttleTime } from 'rxjs/operators';
import { ApiService } from '@app/services/api.service';
import { Env, StateService } from '@app/services/state.service';
import { AuditStatus, CurrentPegs, FederationAddress } from '@interfaces/node-api.interface';
import { WebsocketService } from '@app/services/websocket.service';

@Component({
  selector: 'app-federation-addresses-list',
  templateUrl: './federation-addresses-list.component.html',
  styleUrls: ['./federation-addresses-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FederationAddressesListComponent implements OnInit {
  @Input() widget: boolean = false;
  @Input() federationAddresses$: Observable<FederationAddress[]>;

  env: Env;
  isLoading = true;
  page = 1;
  pageSize = 15;
  maxSize = window.innerWidth <= 767.98 ? 3 : 5;
  skeletonLines: number[] = [];
  auditStatus$: Observable<AuditStatus>;
  auditUpdated$: Observable<boolean>;
  lastReservesBlockUpdate: number = 0;
  currentPeg$: Observable<CurrentPegs>;
  lastPegBlockUpdate: number = 0;
  lastPegAmount: string = '';
  isLoad: boolean = true;

  private destroy$ = new Subject();

  constructor(
    private apiService: ApiService,
    public stateService: StateService,
    private websocketService: WebsocketService
  ) {
  }

  ngOnInit(): void {
    this.isLoading = !this.widget;
    this.env = this.stateService.env;
    this.skeletonLines = this.widget === true ? [...Array(5).keys()] : [...Array(15).keys()];
    if (!this.widget) {
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

      this.federationAddresses$ = this.auditUpdated$.pipe(
        filter(auditUpdated => auditUpdated === true),
        throttleTime(40000),
        switchMap(_ => this.apiService.federationAddresses$()),
        tap(_ => this.isLoading = false),
        share()
      );
    }

  }

  ngOnDestroy(): void {
    this.destroy$.next(1);
    this.destroy$.complete();
  }

  pageChange(page: number): void {
    this.page = page;
  }

}
