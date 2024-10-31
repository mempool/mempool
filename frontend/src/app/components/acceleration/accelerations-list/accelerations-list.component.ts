import { Component, OnInit, ChangeDetectionStrategy, Input, ChangeDetectorRef, OnDestroy, Inject, LOCALE_ID } from '@angular/core';
import { BehaviorSubject, Observable, Subscription, catchError, combineLatest, filter, of, switchMap, tap, throttleTime, timer } from 'rxjs';
import { Acceleration, BlockExtended, SinglePoolStats } from '@interfaces/node-api.interface';
import { StateService } from '@app/services/state.service';
import { WebsocketService } from '@app/services/websocket.service';
import { ServicesApiServices } from '@app/services/services-api.service';
import { SeoService } from '@app/services/seo.service';
import { ActivatedRoute, Router } from '@angular/router';
import { MiningService } from '@app/services/mining.service';

@Component({
  selector: 'app-accelerations-list',
  templateUrl: './accelerations-list.component.html',
  styleUrls: ['./accelerations-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccelerationsListComponent implements OnInit, OnDestroy {
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
  keyNavigationSubscription: Subscription;
  dir: 'rtl' | 'ltr' = 'ltr';
  paramSubscription: Subscription;
  pools: { [id: number]: SinglePoolStats } = {};
  nonEmptyAccelerations: boolean = true;

  constructor(
    private servicesApiService: ServicesApiServices,
    private websocketService: WebsocketService,
    public stateService: StateService,
    private miningService: MiningService,
    private cd: ChangeDetectorRef,
    private seoService: SeoService,
    private route: ActivatedRoute,
    private router: Router,
    @Inject(LOCALE_ID) private locale: string,
  ) {
    if (this.locale.startsWith('ar') || this.locale.startsWith('fa') || this.locale.startsWith('he')) {
      this.dir = 'rtl';
    }
  }

  ngOnInit(): void {
    this.miningService.getPools().subscribe(pools => {
      for (const pool of pools) {
        this.pools[pool.unique_id] = pool;
      }
    });

    if (!this.widget) {
      this.websocketService.want(['blocks']);
      this.seoService.setTitle($localize`:@@02573b6980a2d611b4361a2595a4447e390058cd:Accelerations`);

      this.paramSubscription = combineLatest([
        this.route.params,
        timer(0),
      ]).pipe(
        tap(([params]) => {
          this.page = +params['page'] || 1;
          this.pageSubject.next(this.page);
        })
      ).subscribe();

      const prevKey = this.dir === 'ltr' ? 'ArrowLeft' : 'ArrowRight';
      const nextKey = this.dir === 'ltr' ? 'ArrowRight' : 'ArrowLeft';

      this.keyNavigationSubscription = this.stateService.keyNavigation$.pipe(
        filter((event) => event.key === prevKey || event.key === nextKey),
        tap((event) => {
          if (event.key === prevKey && this.page > 1) {
            this.page--;
            this.isLoading = true;
            this.cd.markForCheck();
          }
          if (event.key === nextKey && this.page * 15 < this.accelerationCount) {
            this.page++;
            this.isLoading = true;
            this.cd.markForCheck();
          }
        }),
        throttleTime(1000, undefined, { leading: true, trailing: true }),
      ).subscribe(() => {
        this.pageChange(this.page);
      });
    }

    this.skeletonLines = this.widget === true ? [...Array(6).keys()] : [...Array(15).keys()];
    this.paginationMaxSize = window.matchMedia('(max-width: 670px)').matches ? 3 : 5;

    this.accelerationList$ = this.pageSubject.pipe(
      switchMap((page) => {
        this.isLoading = true;
        const accelerationObservable$ = this.accelerations$ || (this.pending ? this.stateService.liveAccelerations$ : this.servicesApiService.getAccelerationHistoryObserveResponse$({ page: page }));
        if (!this.accelerations$ && this.pending) {
          this.websocketService.ensureTrackAccelerations();
        }
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
              acc.boost = acc.boostCost != null ? acc.boostCost : acc.bidBoost;
            }
            this.nonEmptyAccelerations = accelerations.length > 0;
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
    this.router.navigate(['acceleration', 'list', page]);
  }

  trackByBlock(index: number, block: BlockExtended): number {
    return block.height;
  }

  ngOnDestroy(): void {
    this.websocketService.stopTrackAccelerations();
    this.paramSubscription?.unsubscribe();
    this.keyNavigationSubscription?.unsubscribe();
  }
}
