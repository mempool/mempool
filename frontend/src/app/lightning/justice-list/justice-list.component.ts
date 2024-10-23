import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { map, Observable, of, Subject, Subscription, switchMap, tap, zip } from 'rxjs';
import { IChannel } from '@interfaces/node-api.interface';
import { LightningApiService } from '@app/lightning/lightning-api.service';
import { Transaction } from '@interfaces/electrs.interface';
import { ElectrsApiService } from '@app/services/electrs-api.service';

@Component({
  selector: 'app-justice-list',
  templateUrl: './justice-list.component.html',
  styleUrls: ['./justice-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JusticeList implements OnInit, OnDestroy {
  justiceChannels$: Observable<any[]>;
  fetchTransactions$: Subject<IChannel> = new Subject();
  transactionsSubscription: Subscription;
  transactions: Transaction[];
  expanded: string = null;
  loadingTransactions: boolean = true;

  constructor(
    private apiService: LightningApiService,
    private electrsApiService: ElectrsApiService,
    private cd: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.justiceChannels$ = this.apiService.getPenaltyClosedChannels$();

    this.transactionsSubscription = this.fetchTransactions$.pipe(
      tap(() => {
        this.loadingTransactions = true;
      }),
      switchMap((channel: IChannel) => {
        return zip([
          channel.transaction_id ? this.electrsApiService.getTransaction$(channel.transaction_id) : of(null),
          channel.closing_transaction_id ? this.electrsApiService.getTransaction$(channel.closing_transaction_id) : of(null),
        ]);
      }),
    ).subscribe((transactions) => {
      this.transactions = transactions;
      this.loadingTransactions = false;
      this.cd.markForCheck();
    });
  }

  toggleDetails(channel: any): void {
    if (this.expanded === channel.short_id) {
      this.expanded = null;
    } else {
      this.expanded = channel.short_id;
      this.fetchTransactions$.next(channel);
    }
  }

  ngOnDestroy(): void {
    this.transactionsSubscription.unsubscribe();
  }
}
