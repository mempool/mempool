import { Component, OnInit, ChangeDetectionStrategy, Input, ChangeDetectorRef } from '@angular/core';
import { BehaviorSubject, combineLatest, Observable, timer, of } from 'rxjs';
import { delayWhen, map, retryWhen, scan, switchMap, tap } from 'rxjs/operators';
import { BlockExtended } from '../../interfaces/node-api.interface';
import { ApiService } from '../../services/api.service';
import { StateService } from '../../services/state.service';
import { WebsocketService } from '../../services/websocket.service';
import { SeoService } from '../../services/seo.service';
import { seoDescriptionNetwork } from '../../shared/common.utils';

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
    private cd: ChangeDetectorRef,
    private seoService: SeoService,
  ) {
    this.isMempoolModule = this.stateService.env.BASE_MODULE === 'mempool';
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

    if (!this.widget) {
      this.seoService.setTitle($localize`:@@m8a7b4bd44c0ac71b2e72de0398b303257f7d2f54:Blocks`);
    }
    if( this.stateService.network==='liquid'||this.stateService.network==='liquidtestnet' ) {
      this.seoService.setDescription($localize`:@@meta.description.liquid.blocks:See the most recent Liquid${seoDescriptionNetwork(this.stateService.network)} blocks along with basic stats such as block height, block size, and more.`);
    } else {
      this.seoService.setDescription($localize`:@@meta.description.bitcoin.blocks:See the most recent Bitcoin${seoDescriptionNetwork(this.stateService.network)} blocks along with basic stats such as block height, block reward, block size, and more.`);
    }


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
          if (blocks[1]) {
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
    this.fromHeightSubject.next((this.blocksCount - 1) - (page - 1) * 15);
  }

  trackByBlock(index: number, block: BlockExtended): number {
    return block.height;
  }

  isEllipsisActive(e): boolean {
    return (e.offsetWidth < e.scrollWidth);
  }
}
