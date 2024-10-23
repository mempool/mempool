import { Component, OnInit, ChangeDetectionStrategy, Input } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject, Observable, Subject, combineLatest, of, timer } from 'rxjs';
import { delayWhen, filter, map, share, shareReplay, switchMap, takeUntil, tap, throttleTime } from 'rxjs/operators';
import { ApiService } from '@app/services/api.service';
import { Env, StateService } from '@app/services/state.service';
import { AuditStatus, CurrentPegs, FederationUtxo } from '@interfaces/node-api.interface';
import { WebsocketService } from '@app/services/websocket.service';

@Component({
  selector: 'app-federation-utxos-list',
  templateUrl: './federation-utxos-list.component.html',
  styleUrls: ['./federation-utxos-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FederationUtxosListComponent implements OnInit {
  @Input() widget: boolean = false;
  @Input() federationUtxos$: Observable<FederationUtxo[]>;

  env: Env;
  isLoading = true;
  page = 1;
  pageSize = 15;
  maxSize = window.innerWidth <= 767.98 ? 3 : 5;
  skeletonLines: number[] = [];
  auditStatus$: Observable<AuditStatus>;
  auditUpdated$: Observable<boolean>;
  showExpiredUtxos: boolean = false;
  showExpiredUtxosToggleSubject: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(this.showExpiredUtxos);
  showExpiredUtxosToggle$: Observable<boolean> = this.showExpiredUtxosToggleSubject.asObservable();
  lastReservesBlockUpdate: number = 0;
  currentPeg$: Observable<CurrentPegs>;
  lastPegBlockUpdate: number = 0;
  lastPegAmount: string = '';
  isLoad: boolean = true;

  private destroy$ = new Subject();
  
  constructor(
    private apiService: ApiService,
    public stateService: StateService,
    private websocketService: WebsocketService,
    private route: ActivatedRoute,
    private router: Router
  ) {
  }

  ngOnInit(): void {
    this.isLoading = !this.widget;
    this.env = this.stateService.env;
    this.skeletonLines = this.widget === true ? [...Array(6).keys()] : [...Array(15).keys()];

    if (!this.widget) {
      this.route.fragment.subscribe((fragment) => {
        this.showExpiredUtxosToggleSubject.next(['expired'].indexOf(fragment) > -1);
      });

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
        this.currentPeg$,
        this.showExpiredUtxosToggle$
      ]).pipe(
        filter(([auditStatus, _, __]) => auditStatus.isAuditSynced === true),
        map(([auditStatus, currentPeg, showExpiredUtxos]) => ({
          lastBlockAudit: auditStatus.lastBlockAudit,
          currentPegAmount: currentPeg.amount,
          showExpiredUtxos: showExpiredUtxos
        })),
        switchMap(({ lastBlockAudit, currentPegAmount, showExpiredUtxos }) => {
          const blockAuditCheck = lastBlockAudit > this.lastReservesBlockUpdate;
          const amountCheck = currentPegAmount !== this.lastPegAmount;
          const expiredCheck = showExpiredUtxos !== this.showExpiredUtxos;
          this.lastReservesBlockUpdate = lastBlockAudit;
          this.lastPegAmount = currentPegAmount;
          this.showExpiredUtxos = showExpiredUtxos;
          return of(blockAuditCheck || amountCheck || expiredCheck);
        }),
        share()
      );

      this.federationUtxos$ = this.auditUpdated$.pipe(
        filter(auditUpdated => auditUpdated === true),
        switchMap(_ => this.showExpiredUtxos ? this.apiService.expiredUtxos$() : this.apiService.federationUtxos$()),
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

  getGradientColor(value: number): string {
    const distanceToGreen = Math.abs(4032 - value);
    const green = '#3bcc49';
    const red = '#dc3545';
  
    if (value < 0) {
      return red;
    } else if (value >= 4032) {
      return green;
    } else {
      const scaleFactor = 1 - distanceToGreen / 4032;
      const r = parseInt(red.slice(1, 3), 16);
      const g = parseInt(green.slice(1, 3), 16);
      const b = parseInt(red.slice(5, 7), 16);
      
      const newR = Math.floor(r + (g - r) * scaleFactor);
      const newG = Math.floor(g - (g - r) * scaleFactor);
      const newB = b;
      
      return '#' + this.componentToHex(newR) + this.componentToHex(newG) + this.componentToHex(newB);
    }
  }

  componentToHex(c: number): string {
    const hex = c.toString(16);
    return hex.length == 1 ? '0' + hex : hex;
  }

}
