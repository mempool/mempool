import { Component, OnInit, ChangeDetectionStrategy, Input, ChangeDetectorRef } from '@angular/core';
import { BehaviorSubject, combineLatest, Observable, timer, of, concat } from 'rxjs';
import { delay, delayWhen, filter, map, retryWhen, scan, share, skip, switchMap, tap } from 'rxjs/operators';
import { ApiService } from '../../../services/api.service';
import { Env, StateService } from '../../../services/state.service';
import { AuditStatus, FederationUtxo } from '../../../interfaces/node-api.interface';
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

  constructor(
    private apiService: ApiService,
    public stateService: StateService,
    private websocketService: WebsocketService,
    private cd: ChangeDetectorRef,
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
          delay(2000),
          switchMap(() => this.apiService.federationAuditSynced$()),
          share()
        )
      );

      this.federationUtxos$ = this.auditStatus$.pipe(
        filter(auditStatus => auditStatus.isAuditSynced === true),
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
