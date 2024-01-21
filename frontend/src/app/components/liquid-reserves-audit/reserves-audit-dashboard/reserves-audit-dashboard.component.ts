import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { SeoService } from '../../../services/seo.service';
import { WebsocketService } from '../../../services/websocket.service';
import { StateService } from '../../../services/state.service';
import { Observable, concat, delay, filter, share, skip, switchMap, tap } from 'rxjs';
import { ApiService } from '../../../services/api.service';
import { AuditStatus, CurrentPegs, FederationAddress, FederationUtxo } from '../../../interfaces/node-api.interface';

@Component({
  selector: 'app-reserves-audit-dashboard',
  templateUrl: './reserves-audit-dashboard.component.html',
  styleUrls: ['./reserves-audit-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReservesAuditDashboardComponent implements OnInit {
  auditStatus$: Observable<AuditStatus>;
  currentPeg$: Observable<CurrentPegs>;
  currentReserves$: Observable<CurrentPegs>;
  federationUtxos$: Observable<FederationUtxo[]>;
  federationAddresses$: Observable<FederationAddress[]>;
  private lastPegBlockUpdate: number = 0;
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
        delay(2000),
        switchMap(() => this.apiService.federationAuditSynced$()),
        share()
      )
    );

    this.currentReserves$ = this.auditStatus$.pipe(
      filter(auditStatus => auditStatus.isAuditSynced === true),
      switchMap(_ =>
        this.apiService.liquidReserves$().pipe(
          filter((currentReserves) => currentReserves.lastBlockUpdate > this.lastReservesBlockUpdate),
          tap((currentReserves) => {
            this.lastReservesBlockUpdate = currentReserves.lastBlockUpdate;
          })
        )
      ),
      share()
    );

    this.currentPeg$ = this.auditStatus$.pipe(
      filter(auditStatus => auditStatus.isAuditSynced === true),
      switchMap(_ =>
        this.apiService.liquidPegs$().pipe(
          filter((currentPegs) => currentPegs.lastBlockUpdate > this.lastPegBlockUpdate),
          tap((currentPegs) => {
            this.lastPegBlockUpdate = currentPegs.lastBlockUpdate;
          })
        )
      ),
      share()
    );

    this.federationUtxos$ = this.auditStatus$.pipe(
      filter(auditStatus => auditStatus.isAuditSynced === true),
      switchMap(_ => this.apiService.federationUtxos$()),
      share()
    );

    this.federationAddresses$ = this.auditStatus$.pipe(
      filter(auditStatus => auditStatus.isAuditSynced === true),
      switchMap(_ => this.apiService.federationAddresses$()),
      share()
    );
  }

}
