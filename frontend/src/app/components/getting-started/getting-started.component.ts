import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Subscription, timer } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ApiService } from '@app/services/api.service';
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
    private cd: ChangeDetectorRef,
  ) { }

  ngOnInit(): void {
    this.syncProgressSubscription = timer(0, 5000).pipe(
      switchMap(() => this.apiService.getSyncProgress$()),
    ).subscribe((progress) => {
      this.syncProgress = progress;
      this.cd.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.syncProgressSubscription?.unsubscribe();
  }
}
