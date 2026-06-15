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
