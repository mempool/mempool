import { Component, OnInit, ChangeDetectionStrategy, Input, ChangeDetectorRef } from '@angular/core';
import { combineLatest, BehaviorSubject, Observable, catchError, of, switchMap, tap } from 'rxjs';
import { Acceleration, BlockExtended } from '../../../interfaces/node-api.interface';
import { StateService } from '../../../services/state.service';
import { WebsocketService } from '../../../services/websocket.service';
import { ServicesApiServices } from '../../../services/services-api.service';

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
  accelerationCount: number;
  maxSize = window.innerWidth <= 767.98 ? 3 : 5;
  skeletonLines: number[] = [];
  pageSubject: BehaviorSubject<number> = new BehaviorSubject(this.page);

  constructor(
    private servicesApiService: ServicesApiServices,
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
    
    this.accelerationList$ = this.pageSubject.pipe(
      switchMap((page) => {
        const accelerationObservable$ = this.accelerations$ || (this.pending ? this.servicesApiService.getAccelerations$() : this.servicesApiService.getAccelerationHistoryObserveResponse$({ page: page }));
        return accelerationObservable$.pipe(
          switchMap(response => {
            let accelerations = response;
            if (response.body) {
              accelerations = response.body;
              this.accelerationCount = parseInt(response.headers.get('x-total-count'), 10);
            }
            if (this.pending) {
              for (const acceleration of accelerations) {
                acceleration.status = acceleration.status || 'accelerating';
              }
            }
            for (const acc of accelerations) {
              acc.boost = acc.feePaid - acc.baseFee - acc.vsizeFee;
            }
            if (this.widget) {
              return of(accelerations.slice(0, 6));
            } else {
              return of(accelerations);
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
      })
    );
  }

  pageChange(page: number): void {
    this.pageSubject.next(page);
  }

  trackByBlock(index: number, block: BlockExtended): number {
    return block.height;
  }
}