import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { Subscription, timer } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ApiService } from '@app/services/api.service';
import { StateService } from '@app/services/state.service';
import { SyncProgress } from '@interfaces/node-api.interface';

type StageStatus = 'complete' | 'active' | 'waiting';

@Component({
  selector: 'app-getting-started',
  templateUrl: './getting-started.component.html',
  styleUrls: ['./getting-started.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GettingStartedComponent implements OnInit, OnDestroy {
  syncProgress: SyncProgress;
  syncProgressSubscription: Subscription;

  constructor(
    private apiService: ApiService,
    private stateService: StateService,
    private cd: ChangeDetectorRef
  ) {}

  get networkDisplayName(): string {
    return this.stateService.networkDisplayName;
  }

  get bitcoinStatus(): StageStatus {
    return this.syncProgress?.ibd ? 'active' : 'complete';
  }

  get electrsStatus(): StageStatus {
    const electrs = this.syncProgress?.electrs;
    if (!electrs) {
      return 'waiting';
    }
    if (electrs.indexed) {
      return 'complete';
    }
    return this.syncProgress.ibd ? 'waiting' : 'active';
  }

  get mempoolStatus(): StageStatus {
    const mempool = this.syncProgress?.mempool;
    if (!mempool) {
      return 'waiting';
    }
    // Pipeline order: mempool cannot start until Core and Electrs are complete.
    const coreDone = !this.syncProgress.ibd;
    const electrsDone =
      !this.syncProgress.electrs || this.syncProgress.electrs.indexed;
    if (!coreDone || !electrsDone) {
      return 'waiting';
    }
    return mempool.inSync ? 'complete' : 'active';
  }

  get bitcoinDescription(): string {
    if (this.bitcoinStatus === 'complete') {
      return $localize`:@@getting-started.bitcoin-core.desc.complete:Blockchain download and validation complete.`;
    }
    return $localize`:@@getting-started.bitcoin-core.desc.active:Downloading and validating blocks.`;
  }

  get electrsDescription(): string {
    switch (this.electrsStatus) {
      case 'active':
        return $localize`:@@getting-started.electrs.desc.active:Building the transaction index from the synced blockchain data.`;
      case 'complete':
        return $localize`:@@getting-started.electrs.desc.complete:Transaction indexing complete.`;
      default:
        return $localize`:@@getting-started.electrs.desc.waiting:Waiting for Bitcoin Core to finish before transaction indexing can begin.`;
    }
  }

  get mempoolDescription(): string {
    switch (this.mempoolStatus) {
      case 'active':
        return $localize`:@@getting-started.mempool.desc.active:Indexing backend data and preparing the dashboard.`;
      case 'complete':
        return $localize`:@@getting-started.mempool.desc.complete:Backend indexing complete.`;
      default:
        return $localize`:@@getting-started.mempool.desc.waiting:Waiting for the transaction indexer before backend indexing can begin.`;
    }
  }

  ngOnInit(): void {
    this.syncProgressSubscription = timer(0, 30000)
      .pipe(switchMap(() => this.apiService.getSyncProgress$()))
      .subscribe((progress) => {
        this.syncProgress = progress;
        this.cd.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.syncProgressSubscription?.unsubscribe();
  }

  formatETA(seconds: number | null): string {
    if (seconds === null) {
      return $localize`:@@getting-started.eta.calculating:Calculating...`;
    }
    if (seconds < 60) {
      return $localize`:@@getting-started.eta.less-than-minute:Less than a minute`;
    }
    if (seconds < 3600) {
      return $localize`:@@getting-started.eta.minutes:~${Math.round(
        seconds / 60
      )}:minutes: minutes`;
    }
    if (seconds < 86400) {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.round((seconds % 3600) / 60);
      return $localize`:@@getting-started.eta.hours:~${hours}:hours:h ${minutes}:minutes:m`;
    }
    const days = Math.floor(seconds / 86400);
    const remainingHours = Math.round((seconds % 86400) / 3600);
    return $localize`:@@getting-started.eta.days:~${days}:days:d ${remainingHours}:hours:h`;
  }
}
