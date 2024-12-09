import { Component, OnInit, Input, ChangeDetectionStrategy, Output, EventEmitter } from '@angular/core';
import { Transaction } from '@interfaces/electrs.interface';
import { Acceleration, CpfpInfo } from '@interfaces/node-api.interface';
import { Pool, TxAuditStatus } from '@components/transaction/transaction.component';
import { Observable } from 'rxjs';
import { ETA } from '@app/services/eta.service';
import { MiningStats } from '@app/services/mining.service';
import { Filter } from '@app/shared/filters.utils';

@Component({
  selector: 'app-transaction-details',
  templateUrl: './transaction-details.component.html',
  styleUrls: ['./transaction-details.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TransactionDetailsComponent implements OnInit {
  @Input() network: string;
  @Input() tx: Transaction;
  @Input() isLoadingTx: boolean;
  @Input() isMobile: boolean;
  @Input() transactionTime: number;
  @Input() isLoadingFirstSeen: boolean;
  @Input() featuresEnabled: boolean;
  @Input() auditStatus: TxAuditStatus;
  @Input() filters: Filter[];
  @Input() miningStats: MiningStats;
  @Input() pool: Pool | null;
  @Input() isAcceleration: boolean;
  @Input() hasEffectiveFeeRate: boolean;
  @Input() cpfpInfo: CpfpInfo;
  @Input() hasCpfp: boolean;
  @Input() accelerationInfo: Acceleration;
  @Input() acceleratorAvailable: boolean;
  @Input() accelerateCtaType: string;
  @Input() notAcceleratedOnLoad: boolean;
  @Input() showAccelerationSummary: boolean;
  @Input() eligibleForAcceleration: boolean;
  @Input() replaced: boolean;
  @Input() isCached: boolean;
  @Input() ETA$: Observable<ETA>;

  @Output() accelerateClicked = new EventEmitter<boolean>();
  @Output() toggleCpfp$ = new EventEmitter<void>();

  constructor() {}

  ngOnInit(): void {}

  onAccelerateClicked(): void {
    this.accelerateClicked.emit(true);
  }

  toggleCpfp(): void {
    this.toggleCpfp$.emit();
  }
}
