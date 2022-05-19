import { Component, OnInit, ChangeDetectionStrategy, Input } from '@angular/core';
import { BehaviorSubject, combineLatest, Observable, timer } from 'rxjs';
import { delayWhen, map, retryWhen, scan, skip, switchMap, tap } from 'rxjs/operators';
import { BlockExtended } from 'src/app/interfaces/node-api.interface';
import { ApiService } from 'src/app/services/api.service';
import { StateService } from 'src/app/services/state.service';
import { WebsocketService } from 'src/app/services/websocket.service';

@Component({
  selector: 'app-blocks-list',
  templateUrl: './blocks-list.component.html',
  styleUrls: ['./blocks-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlocksList implements OnInit {
  @Input() widget: boolean = false;

  blocks$: Observable<any[]> = undefined;

  isLoading = true;
  fromBlockHeight = undefined;
  paginationMaxSize: number;
  page = 1;
  lastPage = 1;
  maxSize = window.innerWidth <= 767.98 ? 3 : 5;
  blocksCount: number;
  fromHeightSubject: BehaviorSubject<number> = new BehaviorSubject(this.fromBlockHeight);
  skeletonLines: number[] = [];

  constructor(
    private apiService: ApiService,
    private websocketService: WebsocketService,
    public stateService: StateService,
  ) {
  }

  ngOnInit(): void {
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
              }),
              map(blocks => {
                for (const block of blocks) {
                  // @ts-ignore: Need to add an extra field for the template
                  block.extras.pool.logo = `./resources/mining-pools/` +
                    block.extras.pool.name.toLowerCase().replace(' ', '').replace('.', '') + '.svg';
                }
                if (this.widget) {
                  return blocks.slice(0, 6);
                }
                return blocks;
              }),
              retryWhen(errors => errors.pipe(delayWhen(() => timer(1000))))
            )
          })
      ),
      this.stateService.blocks$
        .pipe(
          skip(this.stateService.env.MEMPOOL_BLOCKS_AMOUNT - 1),
        ),
    ])
      .pipe(
        scan((acc, blocks) => {
          if (this.page > 1 || acc.length === 0 || (this.page === 1 && this.lastPage !== 1)) {
            this.lastPage = this.page;
            return blocks[0];
          }
          this.blocksCount = Math.max(this.blocksCount, blocks[1][0].height) + 1;
          // @ts-ignore: Need to add an extra field for the template
          blocks[1][0].extras.pool.logo = `./resources/mining-pools/` +
            blocks[1][0].extras.pool.name.toLowerCase().replace(' ', '').replace('.', '') + '.svg';
          acc.unshift(blocks[1][0]);
          acc = acc.slice(0, this.widget ? 6 : 15);
          return acc;
        }, [])
      );
  }

  pageChange(page: number) {
    this.fromHeightSubject.next((this.blocksCount - 1) - (page - 1) * 15);
  }

  trackByBlock(index: number, block: BlockExtended) {
    return block.height;
  }
}