import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { SeoService } from '../../../services/seo.service';
import { WebsocketService } from '../../../services/websocket.service';
import { StateService } from '../../../services/state.service';
import { Observable, combineLatest, concat, delay, filter, interval, map, mergeMap, of, share, skip, startWith, switchMap, tap, throttleTime } from 'rxjs';
import { ApiService } from '../../../services/api.service';
import { AuditStatus, CurrentPegs, FederationAddress, FederationUtxo, LiquidPegs } from '../../../interfaces/node-api.interface';

@Component({
  selector: 'app-reserves-audit-dashboard',
  templateUrl: './reserves-audit-dashboard.component.html',
  styleUrls: ['./reserves-audit-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReservesAuditDashboardComponent implements OnInit {
  auditStatus$: Observable<AuditStatus>;
  auditUpdated$: Observable<boolean>;
  currentPeg$: Observable<CurrentPegs>;
  currentReserves$: Observable<CurrentPegs>;
  federationUtxos$: Observable<FederationUtxo[]>;
  federationUtxosOneMonthAgo$: Observable<any>;
  federationAddresses$: Observable<FederationAddress[]>;
  federationAddressesOneMonthAgo$: Observable<any>;
  liquidPegsMonth$: Observable<any>;
  liquidReservesMonth$: Observable<any>;
  fullHistory$: Observable<any>;
  private lastPegBlockUpdate: number = 0;
  private lastPegAmount: string = '';
  private lastReservesBlockUpdate: number = 0;


  constructor(
    private seoService: SeoService,
    private websocketService: WebsocketService,
    private apiService: ApiService,
    private stateService: StateService,
  ) {
    this.seoService.setTitle($localize`:@@liquid.reserves-audit:Reserves Audit Dashboard`);
  }

  ngOnInit(): void {
    this.websocketService.want(['blocks', 'mempool-blocks']);

    this.auditStatus$ = concat(
      this.apiService.federationAuditSynced$().pipe(share()),
      this.stateService.blocks$.pipe(
        skip(1),
        throttleTime(40000),
        delay(2000),
        switchMap(() => this.apiService.federationAuditSynced$()),
        share()
      )
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
        this.lastPegAmount = currentPegAmount;
        return of(blockAuditCheck || amountCheck);
      }),
      share()
    );

    this.currentReserves$ = this.auditUpdated$.pipe(
      filter(auditUpdated => auditUpdated === true),
      throttleTime(40000),
      switchMap(_ =>
        this.apiService.liquidReserves$().pipe(
          filter((currentReserves) => currentReserves.lastBlockUpdate >= this.lastReservesBlockUpdate),
          tap((currentReserves) => {
            this.lastReservesBlockUpdate = currentReserves.lastBlockUpdate;
          })
        )
      ),
      share()
    );

    this.federationUtxos$ = this.auditUpdated$.pipe(
      filter(auditUpdated => auditUpdated === true),
      throttleTime(40000),
      switchMap(_ => this.apiService.federationUtxos$()),
      share()
    );

    this.federationAddresses$ = this.auditUpdated$.pipe(
      filter(auditUpdated => auditUpdated === true),
      throttleTime(40000),
      switchMap(_ => this.apiService.federationAddresses$()),
      share()
    );

    this.federationUtxosOneMonthAgo$ = interval(60 * 60 * 1000)
      .pipe(
        startWith(0),
        switchMap(() => this.apiService.federationUtxosOneMonthAgo$())
      );

    this.federationAddressesOneMonthAgo$ = interval(60 * 60 * 1000)
      .pipe(
        startWith(0),
        switchMap(() => this.apiService.federationAddressesOneMonthAgo$())
      );

    this.liquidPegsMonth$ = interval(60 * 60 * 1000)
      .pipe(
        startWith(0),
        switchMap(() => this.apiService.listLiquidPegsMonth$()),
        map((pegs) => {
          const labels = pegs.map(stats => stats.date);
          const series = pegs.map(stats => parseFloat(stats.amount) / 100000000);
          series.reduce((prev, curr, i) => series[i] = prev + curr, 0);
          return {
            series,
            labels
          };
        }),
        share(),
      );

    this.liquidReservesMonth$ = interval(60 * 60 * 1000).pipe(
      startWith(0),
      switchMap(() => this.apiService.listLiquidReservesMonth$()),
      map(reserves => {
        const labels = reserves.map(stats => stats.date);
        const series = reserves.map(stats => parseFloat(stats.amount) / 100000000);
        return {
          series,
          labels
        };
      }),
      share()
    );

    this.fullHistory$ = combineLatest([this.liquidPegsMonth$, this.currentPeg$, this.liquidReservesMonth$, this.currentReserves$])
      .pipe(
        map(([liquidPegs, currentPeg, liquidReserves, currentReserves]) => {
          liquidPegs.series[liquidPegs.series.length - 1] = parseFloat(currentPeg.amount) / 100000000;

          if (liquidPegs.series.length === liquidReserves?.series.length) {
            liquidReserves.series[liquidReserves.series.length - 1] = parseFloat(currentReserves?.amount) / 100000000;
          } else if (liquidPegs.series.length === liquidReserves?.series.length + 1) {
            liquidReserves.series.push(parseFloat(currentReserves?.amount) / 100000000);
            liquidReserves.labels.push(liquidPegs.labels[liquidPegs.labels.length - 1]);
          } else {
            liquidReserves = {
              series: [],
              labels: []
            };
          }

          return {
            liquidPegs,
            liquidReserves
          };
        }),
        share()
      );
  }

}
