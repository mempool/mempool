import { Component, OnInit, ChangeDetectionStrategy, Input } from '@angular/core';
import { Observable, combineLatest, concat, of } from 'rxjs';
import { delay, filter, map, share, skip, switchMap, tap, throttleTime } from 'rxjs/operators';
import { ApiService } from '../../../services/api.service';
import { Env, StateService } from '../../../services/state.service';
import { AuditStatus, CurrentPegs, FederationUtxo } from '../../../interfaces/node-api.interface';
import { WebsocketService } from '../../../services/websocket.service';

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
  lastReservesBlockUpdate: number = 0;
  currentPeg$: Observable<CurrentPegs>;
  lastPegBlockUpdate: number = 0;
  lastPegAmount: string = '';

  constructor(
    private apiService: ApiService,
    public stateService: StateService,
    private websocketService: WebsocketService,
  ) {
  }

  ngOnInit(): void {
    this.isLoading = !this.widget;
    this.env = this.stateService.env;
    this.skeletonLines = this.widget === true ? [...Array(5).keys()] : [...Array(15).keys()];
    if (!this.widget) {
      this.websocketService.want(['blocks']);
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
        tap(_ => this.isLoading = false),
        share()
      );
    }


  }

  pageChange(page: number): void {
    this.page = page;
  }

}
