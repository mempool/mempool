import { Component, OnInit, ChangeDetectionStrategy, Input } from '@angular/core';
import { Observable, concat } from 'rxjs';
import { delay, filter, map, share, skip, switchMap, tap, throttleTime } from 'rxjs/operators';
import { ApiService } from '../../../services/api.service';
import { Env, StateService } from '../../../services/state.service';
import { AuditStatus, FederationAddress } from '../../../interfaces/node-api.interface';
import { WebsocketService } from '../../../services/websocket.service';

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
      this.auditStatus$ = concat(
        this.apiService.federationAuditSynced$(),
        this.stateService.blocks$.pipe(
          skip(1),
          throttleTime(40000),
          delay(2000),
          switchMap(() => this.apiService.federationAuditSynced$()),
          share()
        )
      );

      this.auditUpdated$ = this.auditStatus$.pipe(
        filter(auditStatus => auditStatus.isAuditSynced === true),
        map(auditStatus => {
          const beforeLastBlockAudit = this.lastReservesBlockUpdate;
          this.lastReservesBlockUpdate = auditStatus.lastBlockAudit;
          return auditStatus.lastBlockAudit > beforeLastBlockAudit ? true : false;
        })
      );

      this.federationAddresses$ = this.auditUpdated$.pipe(
        filter(auditUpdated => auditUpdated === true),
        switchMap(_ => this.apiService.federationAddresses$()),
        tap(_ => this.isLoading = false),
        share()
      );
    }


  }

  pageChange(page: number): void {
    this.page = page;
  }

}
