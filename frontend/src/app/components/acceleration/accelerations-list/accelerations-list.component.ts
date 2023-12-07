import { Component, OnInit, ChangeDetectionStrategy, Input, ChangeDetectorRef } from '@angular/core';
import { Observable, catchError, of, switchMap, tap } from 'rxjs';
import { Acceleration, BlockExtended } from '../../../interfaces/node-api.interface';
import { ApiService } from '../../../services/api.service';
import { StateService } from '../../../services/state.service';
import { WebsocketService } from '../../../services/websocket.service';

@Component({
  selector: 'app-accelerations-list',
  templateUrl: './accelerations-list.component.html',
  styleUrls: ['./accelerations-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccelerationsListComponent implements OnInit {
  @Input() widget: boolean = false;
  @Input() pending: boolean = false;
  @Input() accelerations$: Observable<Acceleration[]>;

  accelerationList$: Observable<Acceleration[]> = undefined;

  isLoading = true;
  paginationMaxSize: number;
  page = 1;
  lastPage = 1;
  maxSize = window.innerWidth <= 767.98 ? 3 : 5;
  skeletonLines: number[] = [];

  constructor(
    private apiService: ApiService,
    private websocketService: WebsocketService,
    public stateService: StateService,
    private cd: ChangeDetectorRef,
  ) {
  }

  ngOnInit(): void {
    if (!this.widget) {
      this.websocketService.want(['blocks']);
    }

    this.skeletonLines = this.widget === true ? [...Array(6).keys()] : [...Array(15).keys()];
    this.paginationMaxSize = window.matchMedia('(max-width: 670px)').matches ? 3 : 5;

    const accelerationObservable$ = this.accelerations$ || (this.pending ? this.apiService.getAccelerations$() : this.apiService.getAccelerationHistory$({ timeframe: '1m' }));
    this.accelerationList$ = accelerationObservable$.pipe(
      switchMap(accelerations => {
        if (this.pending) {
          for (const acceleration of accelerations) {
            acceleration.status = acceleration.status || 'accelerating';
          }
        }
        if (this.widget) {
          return of(accelerations.slice(-6).reverse());
        } else {
          return of(accelerations.reverse());
        }
      }),
      catchError((err) => {
        this.isLoading = false;
        return of([]);
      }),
      tap(() => {
        this.isLoading = false;
      })
    );
  }

  trackByBlock(index: number, block: BlockExtended): number {
    return block.height;
  }
}