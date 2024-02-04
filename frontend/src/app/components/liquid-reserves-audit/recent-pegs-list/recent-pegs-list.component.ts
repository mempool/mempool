import { Component, OnInit, ChangeDetectionStrategy, Input } from '@angular/core';
import { Observable, Subject, combineLatest, of, timer } from 'rxjs';
import { delayWhen, filter, map, share, shareReplay, switchMap, takeUntil, tap, throttleTime } from 'rxjs/operators';
import { ApiService } from '../../../services/api.service';
import { Env, StateService } from '../../../services/state.service';
import { AuditStatus, CurrentPegs, FederationUtxo, RecentPeg } from '../../../interfaces/node-api.interface';
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
  @Input() recentPegIns$: Observable<RecentPeg[]> = of([]);
  @Input() recentPegOuts$: Observable<RecentPeg[]> = of([]);

  env: Env;
  isLoading = true;
  page = 1;
  pageSize = 15;
  maxSize = window.innerWidth <= 767.98 ? 3 : 5;
  skeletonLines: number[] = [];
  auditStatus$: Observable<AuditStatus>;
  auditUpdated$: Observable<boolean>;
  federationUtxos$: Observable<FederationUtxo[]>;
  recentPegs$: Observable<RecentPeg[]>;
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
    private seoService: SeoService
  ) {
  }

  ngOnInit(): void {
    this.isLoading = !this.widget;
    this.env = this.stateService.env;
    this.skeletonLines = this.widget === true ? [...Array(6).keys()] : [...Array(15).keys()];

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

      this.federationUtxos$ = this.auditUpdated$.pipe(
        filter(auditUpdated => auditUpdated === true),
        throttleTime(40000),
        switchMap(_ => this.apiService.federationUtxos$()),
        share()
      );

      this.recentPegIns$ = this.federationUtxos$.pipe(
        map(federationUtxos => federationUtxos.filter(utxo => utxo.pegtxid).map(utxo => {
          return {
            txid: utxo.pegtxid,
            txindex: utxo.pegindex,
            amount: utxo.amount,
            bitcoinaddress: utxo.bitcoinaddress,
            bitcointxid: utxo.txid,
            bitcoinindex: utxo.txindex,
            blocktime: utxo.pegblocktime,
          }
        })),
        share()
      );

      this.recentPegOuts$ = this.auditUpdated$.pipe(
        filter(auditUpdated => auditUpdated === true),
        throttleTime(40000),
        switchMap(_ => this.apiService.recentPegOuts$()),
        share()
      );
  
    }

    this.recentPegs$ = combineLatest([
      this.recentPegIns$,
      this.recentPegOuts$
    ]).pipe(
      map(([recentPegIns, recentPegOuts]) => {
        return [
          ...recentPegIns,
          ...recentPegOuts
        ].sort((a, b) => {
          return b.blocktime - a.blocktime;
        });
      }),
      filter(recentPegs => recentPegs.length > 0),
      tap(_ => this.isLoading = false),
      share()
    );
  }

  ngOnDestroy(): void {
    this.destroy$.next(1);
    this.destroy$.complete();
  }

  pageChange(page: number): void {
    this.page = page;
  }

}
