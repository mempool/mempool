import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { StateService } from '@app/services/state.service';
import { Address, AddressTxSummary } from '@interfaces/electrs.interface';
import { ElectrsApiService } from '@app/services/electrs-api.service';
import { Observable, catchError, of } from 'rxjs';

@Component({
  selector: 'app-balance-widget',
  templateUrl: './balance-widget.component.html',
  styleUrls: ['./balance-widget.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BalanceWidgetComponent implements OnInit, OnChanges {
  @Input() address: string;
  @Input() addressInfo: Address;
  @Input() addressSummary$: Observable<AddressTxSummary[]> | null;
  @Input() isPubkey: boolean = false;

  isLoading: boolean = true;
  error: any;

  total: number = 0;
  delta7d: number = 0;
  delta30d: number = 0;

  constructor(
    public stateService: StateService,
    private electrsApiService: ElectrsApiService,
    private cd: ChangeDetectorRef,
  ) { }

  ngOnInit(): void {
    
  }

  ngOnChanges(changes: SimpleChanges): void {
    this.isLoading = true;
    if (!this.addressSummary$ && (!this.address || !this.addressInfo)) {
      return;
    }
    (this.addressSummary$ || (this.isPubkey
      ? this.electrsApiService.getScriptHashSummary$((this.address.length === 66 ? '21' : '41') + this.address + 'ac')
      : this.electrsApiService.getAddressSummary$(this.address)).pipe(
      catchError(e => {
        this.error = `Failed to fetch address balance history: ${e?.status || ''} ${e?.statusText || 'unknown error'}`;
        return of(null);
      }),
    )).subscribe(addressSummary => {
      if (addressSummary) {
        this.error = null;
        this.calculateStats(addressSummary);
      }
      this.isLoading = false;
      this.cd.markForCheck();
    });
  }

  calculateStats(summary: AddressTxSummary[]): void {
    let weekTotal = 0;
    let monthTotal = 0;
    this.total = this.addressInfo ? this.addressInfo.chain_stats.funded_txo_sum - this.addressInfo.chain_stats.spent_txo_sum : summary.reduce((acc, tx) => acc + tx.value, 0);

    const weekAgo = (new Date(new Date().setHours(0, 0, 0, 0) - (7 * 24 * 60 * 60 * 1000)).getTime()) / 1000;
    const monthAgo = (new Date(new Date().setHours(0, 0, 0, 0) - (30 * 24 * 60 * 60 * 1000)).getTime()) / 1000;
    for (let i = 0; i < summary.length && summary[i].time >= monthAgo; i++) {
      monthTotal += summary[i].value;
      if (summary[i].time >= weekAgo) {
        weekTotal += summary[i].value;
      }
    }
    this.delta7d = weekTotal;
    this.delta30d = monthTotal;
  }
}
