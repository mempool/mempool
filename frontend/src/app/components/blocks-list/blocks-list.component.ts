import { Component, OnInit, ChangeDetectionStrategy, Input, ChangeDetectorRef, Inject, LOCALE_ID } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject, combineLatest, Observable, timer, of, Subscription } from 'rxjs';
import { debounceTime, delayWhen, filter, map, retryWhen, scan, skip, switchMap, tap, throttleTime } from 'rxjs/operators';
import { BlockExtended } from '@interfaces/node-api.interface';
import { ApiService } from '@app/services/api.service';
import { StateService } from '@app/services/state.service';
import { WebsocketService } from '@app/services/websocket.service';
import { SeoService } from '@app/services/seo.service';
import { OpenGraphService } from '@app/services/opengraph.service';
import { seoDescriptionNetwork } from '@app/shared/common.utils';
import { RelativeUrlPipe } from '@app/shared/pipes/relative-url/relative-url.pipe';

@Component({
  selector: 'app-blocks-list',
  templateUrl: './blocks-list.component.html',
  styleUrls: ['./blocks-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlocksList implements OnInit {
  @Input() widget: boolean = false;

  blocks$: Observable<BlockExtended[]> = undefined;

  isMempoolModule = false;
  indexingAvailable = false;
  auditAvailable = false;
  isLoading = true;
  fromBlockHeight = undefined;
  lastBlockHeightFetched = -1;
  paginationMaxSize: number;
  page = 1;
  lastPage = 1;
  maxSize = window.innerWidth <= 767.98 ? 3 : 5;
  blocksCount: number;
  fromHeightSubject: BehaviorSubject<number> = new BehaviorSubject(this.fromBlockHeight);
  skeletonLines: number[] = [];
  lastBlockHeight = -1;
  blocksCountInitialized$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  blocksCountInitializedSubscription: Subscription;
  keyNavigationSubscription: Subscription;
  dir: 'rtl' | 'ltr' = 'ltr';

  constructor(
    private apiService: ApiService,
    private websocketService: WebsocketService,
    public stateService: StateService,
    private cd: ChangeDetectorRef,
    private seoService: SeoService,
    private ogService: OpenGraphService,
    private route: ActivatedRoute,
    private router: Router,
    private relativeUrlPipe: RelativeUrlPipe,
    @Inject(LOCALE_ID) private locale: string,
  ) {
    this.isMempoolModule = this.stateService.env.BASE_MODULE === 'mempool';
    if (this.locale.startsWith('ar') || this.locale.startsWith('fa') || this.locale.startsWith('he')) {
      this.dir = 'rtl';
    }
  }

  ngOnInit(): void {
    this.indexingAvailable = (this.stateService.env.BASE_MODULE === 'mempool' &&
      this.stateService.env.MINING_DASHBOARD === true);
    this.auditAvailable = this.indexingAvailable && this.stateService.env.AUDIT;

    if (!this.widget) {
      this.websocketService.want(['blocks']);
      
      this.seoService.setTitle($localize`:@@8a7b4bd44c0ac71b2e72de0398b303257f7d2f54:Blocks`);
      this.ogService.setManualOgImage('recent-blocks.jpg');
      if( this.stateService.network==='liquid'||this.stateService.network==='liquidtestnet' ) {
        this.seoService.setDescription($localize`:@@meta.description.liquid.blocks:See the most recent Liquid${seoDescriptionNetwork(this.stateService.network)} blocks along with basic stats such as block height, block size, and more.`);
      } else {
        this.seoService.setDescription($localize`:@@meta.description.bitcoin.blocks:See the most recent Bitcoin${seoDescriptionNetwork(this.stateService.network)} blocks along with basic stats such as block height, block reward, block size, and more.`);
      }

      this.blocksCountInitializedSubscription = combineLatest([this.blocksCountInitialized$, this.route.params]).pipe(
        filter(([blocksCountInitialized, _]) => blocksCountInitialized),
        tap(([_, params]) => {
          this.page = +params['page'] || 1;
          this.page === 1 ? this.fromHeightSubject.next(undefined) : this.fromHeightSubject.next((this.blocksCount - 1) - (this.page - 1) * 15);
        })
      ).subscribe();

      const prevKey = this.dir === 'ltr' ? 'ArrowLeft' : 'ArrowRight';
      const nextKey = this.dir === 'ltr' ? 'ArrowRight' : 'ArrowLeft';

      this.keyNavigationSubscription = this.stateService.keyNavigation$
      .pipe(
        filter((event) => event.key === prevKey || event.key === nextKey),
        tap((event) => {
          if (event.key === prevKey && this.page > 1) {
            this.page--;
            this.isLoading = true;
            this.cd.markForCheck();
          }
          if (event.key === nextKey && this.page * 15 < this.blocksCount) {
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
    
    this.blocks$ = combineLatest([
      this.fromHeightSubject.pipe(
        filter(fromBlockHeight => fromBlockHeight !== this.lastBlockHeightFetched),
        switchMap((fromBlockHeight) => {
          this.isLoading = true;
          this.lastBlockHeightFetched = fromBlockHeight;
          return this.apiService.getBlocks$(this.page === 1 ? undefined : fromBlockHeight)
            .pipe(
              tap(blocks => {
                if (this.blocksCount === undefined) {
                  this.blocksCount = blocks[0].height + 1;
                  this.blocksCountInitialized$.next(true);
                  this.blocksCountInitialized$.complete();
                }
                this.isLoading = false;
                this.lastBlockHeight = Math.max(...blocks.map(o => o.height));
              }),
              map(blocks => {
                if (this.stateService.env.BASE_MODULE === 'mempool') {
                  for (const block of blocks) {
                    // @ts-ignore: Need to add an extra field for the template
                    block.extras.pool.logo = `/resources/mining-pools/` + block.extras.pool.slug + '.svg';
                  }
                }
                if (this.widget) {
                  return blocks.slice(0, 6);
                }
                return blocks;
              }),
              retryWhen(errors => errors.pipe(delayWhen(() => timer(10000))))
            );
        })
      ),
      this.stateService.blocks$
        .pipe(
          switchMap((blocks) => {
            if (blocks[0].height <= this.lastBlockHeight) {
              return of([]); // Return an empty stream so the last pipe is not executed
            }
            this.lastBlockHeight = blocks[0].height;
            return of(blocks);
          })
        )
    ])
      .pipe(
        scan((acc, blocks) => {
          if (this.page > 1 || acc.length === 0 || (this.page === 1 && this.lastPage !== 1)) {
            this.lastPage = this.page;
            return blocks[0];
          }
          if (blocks[1] && blocks[1].length) {
            this.blocksCount = Math.max(this.blocksCount, blocks[1][0].height) + 1;
            if (this.isMempoolModule) {
              // @ts-ignore: Need to add an extra field for the template
              blocks[1][0].extras.pool.logo = `/resources/mining-pools/` +
                blocks[1][0].extras.pool.slug + '.svg';
            }
            acc.unshift(blocks[1][0]);
            acc = acc.slice(0, this.widget ? 6 : 15);
          }
          return acc;
        }, []),
        switchMap((blocks) => {
          if (this.isMempoolModule && this.auditAvailable) {
            blocks.forEach(block => {
              block.extras.feeDelta = block.extras.expectedFees ? (block.extras.totalFees - block.extras.expectedFees) / block.extras.expectedFees : 0;
            });
          }
          return of(blocks);
        })
      );
  }

  pageChange(page: number): void {
    this.router.navigate([this.relativeUrlPipe.transform('/blocks/'), page]);
  }

  trackByBlock(index: number, block: BlockExtended): number {
    return block.height;
  }

  isEllipsisActive(e): boolean {
    return (e.offsetWidth < e.scrollWidth);
  }

  ngOnDestroy(): void {
    this.blocksCountInitializedSubscription?.unsubscribe();
    this.keyNavigationSubscription?.unsubscribe();
  }
}
