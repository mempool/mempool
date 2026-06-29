import { Component, OnChanges, SimpleChanges, Input, ChangeDetectionStrategy, ChangeDetectorRef, Output, EventEmitter } from '@angular/core';
import { Transaction } from '@interfaces/electrs.interface';
import { Acceleration, BlockExtended, CpfpInfo } from '@interfaces/node-api.interface';
import { Pool, TxAuditStatus } from '@components/transaction/transaction.component';
import { Observable } from 'rxjs';
import { first, timeout } from 'rxjs/operators';
import { ETA } from '@app/services/eta.service';
import { MiningStats } from '@app/services/mining.service';
import { Filter, TransactionFlags } from '@app/shared/filters.utils';
import { StateService } from '@app/services/state.service';
import { CacheService } from '@app/services/cache.service';

@Component({
  selector: 'app-transaction-details',
  templateUrl: './transaction-details.component.html',
  styleUrls: ['./transaction-details.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TransactionDetailsComponent implements OnChanges {
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
  @Input() unbroadcasted: boolean;
  @Input() cpfpMode: boolean = false;

  @Output() accelerateClicked = new EventEmitter<boolean>();
  @Output() toggleCpfp$ = new EventEmitter<void>();

  acceleratorSavingsSats = 0;
  officialMempoolSpace: boolean;

  constructor(
    private stateService: StateService,
    private cacheService: CacheService,
    private cd: ChangeDetectorRef,
  ) {
    this.officialMempoolSpace = this.stateService.env.OFFICIAL_MEMPOOL_SPACE;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes.tx) {
      return;
    }
    this.acceleratorSavingsSats = 0;
    const hasIneligibleFlags = ((this.tx?.flags ?? 0n) & (TransactionFlags.inscription | TransactionFlags.sighash_none | TransactionFlags.sighash_single | TransactionFlags.sighash_acp)) > 0n;
    if (this.officialMempoolSpace
      && this.tx?.status?.confirmed
      && !this.tx.acceleration && !this.accelerationInfo
      && this.tx.weight <= 4000
      && !hasIneligibleFlags
      && Math.min(...this.tx.vout.map(o => o.value)) <= 1000000
    ) {
      const block = this.cacheService.getCachedBlock(this.tx.status.block_height);
      if (block) {
        this.calculateAcceleratorSavings(block);
      } else {
        const txid = this.tx.txid;
        this.cacheService.loadBlock(this.tx.status.block_height);
        this.cacheService.loadedBlocks$.pipe(
          first(b => b.height === this.tx.status.block_height),
          timeout({ each: 30000, with: () => [] }),
        ).subscribe((block) => {
          if (this.tx?.txid === txid) {
            this.calculateAcceleratorSavings(block);
            this.cd.markForCheck();
          }
        });
      }
    }
  }

  calculateAcceleratorSavings(block: BlockExtended): void {
    if (this.network !== '') {
      this.acceleratorSavingsSats = 0;
      return;
    }
    const minBlockRate = block?.extras?.feeRange?.[0];
    if (minBlockRate !== undefined) {
      const vsize = this.tx.weight / 4;
      this.acceleratorSavingsSats = Math.max(0, this.tx.fee - Math.ceil(minBlockRate * vsize) - 75000);
    }
  }

  get showAcceleratorSavingsMsg(): boolean {
    return this.network === '' && this.acceleratorSavingsSats > 0 && this.cpfpInfo !== null && this.cpfpInfo !== undefined && !this.hasCpfp;
  }

  onAccelerateClicked(): void {
    this.accelerateClicked.emit(true);
  }

  toggleCpfp(): void {
    this.toggleCpfp$.emit();
  }

  get clusterPreviewStats(): { chunkSize: number; chunkFeerate: number; otherChunks: number } {
    const cluster = this.cpfpInfo?.cluster;
    const chunk = cluster?.chunks[cluster.chunkIndex];
    return {
      chunkSize: chunk?.txs.length ?? 0,
      chunkFeerate: chunk?.feerate ?? 0,
      otherChunks: Math.max(0, (cluster?.chunks.length ?? 0) - 1),
    };
  }
}
