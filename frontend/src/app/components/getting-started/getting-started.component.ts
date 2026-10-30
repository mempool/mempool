import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { EMPTY, Subscription, timer } from 'rxjs';
import {
  catchError,
  distinctUntilChanged,
  startWith,
  switchMap,
  tap,
  timeout,
} from 'rxjs/operators';
import { ApiService } from '@app/services/api.service';
import { StateService } from '@app/services/state.service';
import { SyncProgress } from '@interfaces/node-api.interface';

type StageStatus = 'complete' | 'active' | 'waiting' | 'unreachable';

@Component({
  selector: 'app-getting-started',
  templateUrl: './getting-started.component.html',
  styleUrls: ['./getting-started.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GettingStartedComponent implements OnInit, OnDestroy {
  syncProgress: SyncProgress;
  loadError = false;
  syncProgressSubscription: Subscription;

  constructor(
    private apiService: ApiService,
    private stateService: StateService,
    private cd: ChangeDetectorRef
  ) {}

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
    if (this.syncProgress.ibd) {
      return 'waiting';
    }
    return electrs.reachable ? 'active' : 'unreachable';
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
    return mempool.inSync && mempool.indexed ? 'complete' : 'active';
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
      case 'unreachable':
        return $localize`:@@getting-started.electrs.desc.unreachable:Can't reach the server. It does not accept connections until its first index is built, so this is expected during setup — otherwise check that it is running.`;
      default:
        return $localize`:@@getting-started.electrs.desc.waiting:Waiting for Bitcoin Core to finish before transaction indexing can begin.`;
    }
  }

  get mempoolDescription(): string {
    if (this.mempoolStatus === 'active') {
      // Two phases: mempool transaction sync, then heavy block indexing.
      if (this.syncProgress?.mempool && !this.syncProgress.mempool.inSync) {
        return $localize`:@@getting-started.mempool.desc.mempool-sync:Syncing the mempool and preparing the dashboard.`;
      }
      return $localize`:@@getting-started.mempool.desc.block-indexing:Indexing block summaries, CPFP and audits.`;
    }
    if (this.mempoolStatus === 'complete') {
      return $localize`:@@getting-started.mempool.desc.complete:Backend and block indexing complete.`;
    }
    return $localize`:@@getting-started.mempool.desc.waiting:Waiting for blockchain synchronization and transaction indexing to finish.`;
  }

  ngOnInit(): void {
    if (!this.stateService.isBrowser) {
      return;
    }
    this.syncProgressSubscription = this.stateService.networkChanged$
      .pipe(
        startWith(this.stateService.network),
        distinctUntilChanged(),
        tap(() => {
          this.syncProgress = null;
          this.loadError = false;
          this.cd.markForCheck();
        }),
        switchMap(() =>
          timer(0, 30000).pipe(
            switchMap(() =>
              this.apiService.getSyncProgress$().pipe(
                timeout({ first: 10000 }),
                catchError(() => {
                  this.loadError = true;
                  this.cd.markForCheck();
                  return EMPTY;
                })
              )
            )
          )
        )
      )
      .subscribe((progress) => {
        this.loadError = false;
        this.syncProgress = progress;
        this.cd.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.syncProgressSubscription?.unsubscribe();
  }

  formatETA(seconds: number | null): string {
    if (seconds === null || !Number.isFinite(seconds) || seconds < 0) {
      return $localize`:@@getting-started.eta.calculating:Calculating...`;
    }
    if (seconds < 60) {
      return $localize`:@@getting-started.eta.less-than-minute:Less than a minute`;
    }
    if (seconds < 3600) {
      const minutes = Math.round(seconds / 60);
      return minutes === 1
        ? $localize`:@@getting-started.eta.one-minute:~1 minute`
        : $localize`:@@getting-started.eta.minutes:~${minutes}:minutes: minutes`;
    }
    if (seconds < 86400) {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return $localize`:@@getting-started.eta.hours:~${hours}:hours:h ${minutes}:minutes:m`;
    }
    const days = Math.floor(seconds / 86400);
    const remainingHours = Math.floor((seconds % 86400) / 3600);
    return $localize`:@@getting-started.eta.days:~${days}:days:d ${remainingHours}:hours:h`;
  }
}
