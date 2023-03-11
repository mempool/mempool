import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, Input } from '@angular/core';
import { BehaviorSubject, combineLatest, concat, Observable, timer, EMPTY, Subscription, of } from 'rxjs';
import { catchError, delayWhen, map, retryWhen, scan, skip, switchMap, tap } from 'rxjs/operators';
import { BlockExtended } from '../../interfaces/node-api.interface';
import { ApiService } from '../../services/api.service';
import { StateService } from '../../services/state.service';
import { WebsocketService } from '../../services/websocket.service';

@Component({
  selector: 'app-blocks-list',
  templateUrl: './blocks-list.component.html',
  styleUrls: ['./blocks-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlocksList implements OnInit, OnDestroy {
  @Input() widget: boolean = false;

  blocks$: Observable<BlockExtended[]> = undefined;
  auditScores: { [hash: string]: number | void } = {};

  auditScoreSubscription: Subscription;
  latestScoreSubscription: Subscription;

  indexingAvailable = false;
  auditAvailable = false;
  isLoading = true;
  loadingScores = true;
  fromBlockHeight = undefined;
  paginationMaxSize: number;
  page = 1;
  lastPage = 1;
  maxSize = window.innerWidth <= 767.98 ? 3 : 5;
  blocksCount: number;
  fromHeightSubject: BehaviorSubject<number> = new BehaviorSubject(this.fromBlockHeight);
  skeletonLines: number[] = [];
  lastBlockHeight = -1;

  constructor(
    private apiService: ApiService,
    private websocketService: WebsocketService,
    public stateService: StateService,
  ) {
  }

  ngOnInit(): void {
    this.indexingAvailable = (this.stateService.env.BASE_MODULE === 'mempool' &&
      this.stateService.env.MINING_DASHBOARD === true);
    this.auditAvailable = this.indexingAvailable && this.stateService.env.AUDIT;

    if (!this.widget) {
      this.websocketService.want(['blocks']);
    }

    this.skeletonLines = this.widget === true ? [...Array(6).keys()] : [...Array(15).keys()];
    this.paginationMaxSize = window.matchMedia('(max-width: 670px)').matches ? 3 : 5;

    this.blocks$ = combineLatest([
      this.fromHeightSubject.pipe(
        switchMap((fromBlockHeight) => {
          this.isLoading = true;
          return this.apiService.getBlocks$(this.page === 1 ? undefined : fromBlockHeight)
            .pipe(
              tap(blocks => {
                if (this.blocksCount === undefined) {
                  this.blocksCount = blocks[0].height + 1;
                }
                this.isLoading = false;
                this.lastBlockHeight = Math.max(...blocks.map(o => o.height))
              }),
              map(blocks => {
                if (this.indexingAvailable) {
                  for (const block of blocks) {
                    // @ts-ignore: Need to add an extra field for the template
                    block.extras.pool.logo = `/resources/mining-pools/` +
                      block.extras.pool.name.toLowerCase().replace(' ', '').replace('.', '') + '.svg';
                  }
                }
                if (this.widget) {
                  return blocks.slice(0, 6);
                }
                return blocks;
              }),
              retryWhen(errors => errors.pipe(delayWhen(() => timer(10000))))
            )
        })
      ),
      this.stateService.blocks$
        .pipe(
          switchMap((block) => {
            if (block[0].height <= this.lastBlockHeight) {
              return [null]; // Return an empty stream so the last pipe is not executed
            }
            this.lastBlockHeight = block[0].height;
            return [block];
          })
        )
    ])
      .pipe(
        scan((acc, blocks) => {
          if (this.page > 1 || acc.length === 0 || (this.page === 1 && this.lastPage !== 1)) {
            this.lastPage = this.page;
            return blocks[0];
          }
          if (blocks[1]) {
            this.blocksCount = Math.max(this.blocksCount, blocks[1][0].height) + 1;
            if (this.stateService.env.MINING_DASHBOARD) {
              // @ts-ignore: Need to add an extra field for the template
              blocks[1][0].extras.pool.logo = `/resources/mining-pools/` +
                blocks[1][0].extras.pool.name.toLowerCase().replace(' ', '').replace('.', '') + '.svg';
            }
            acc.unshift(blocks[1][0]);
            acc = acc.slice(0, this.widget ? 6 : 15);
          }
          return acc;
        }, [])
      );

    if (this.indexingAvailable && this.auditAvailable) {
      this.auditScoreSubscription = this.fromHeightSubject.pipe(
        switchMap((fromBlockHeight) => {
          this.loadingScores = true;
          return this.apiService.getBlockAuditScores$(this.page === 1 ? undefined : fromBlockHeight)
            .pipe(
              catchError(() => {
                return EMPTY;
              })
            );
        })
      ).subscribe((scores) => {
        Object.values(scores).forEach(score => {
          this.auditScores[score.hash] = score?.matchRate != null ? score.matchRate : null;
        });
        this.loadingScores = false;
      });

      this.latestScoreSubscription = this.stateService.blocks$.pipe(
        switchMap((block) => {
          if (block[0]?.extras?.matchRate != null) {
            return of({
              hash: block[0].id,
              matchRate: block[0]?.extras?.matchRate,
            });
          }
          else if (block[0]?.id && this.auditScores[block[0].id] === undefined) {
            return this.apiService.getBlockAuditScore$(block[0].id)
              .pipe(
                catchError(() => {
                  return EMPTY;
                })
              );
          } else {
            return EMPTY;
          }
        }),
      ).subscribe((score) => {
        if (score && score.hash) {
          this.auditScores[score.hash] = score?.matchRate != null ? score.matchRate : null;
        }
      });
    }
  }

  ngOnDestroy(): void {
    this.auditScoreSubscription?.unsubscribe();
    this.latestScoreSubscription?.unsubscribe();
  }

  pageChange(page: number) {
    this.fromHeightSubject.next((this.blocksCount - 1) - (page - 1) * 15);
  }

  trackByBlock(index: number, block: BlockExtended) {
    return block.height;
  }

  isEllipsisActive(e) {
    return (e.offsetWidth < e.scrollWidth);
  }
}