import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { StateService } from 'src/app/services/state.service';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { switchMap, map, tap, filter } from 'rxjs/operators';
import { MempoolBlock } from 'src/app/interfaces/websocket.interface';
import { Observable, BehaviorSubject } from 'rxjs';
import { SeoService } from 'src/app/services/seo.service';
import { WebsocketService } from 'src/app/services/websocket.service';

@Component({
  selector: 'app-mempool-block',
  templateUrl: './mempool-block.component.html',
  styleUrls: ['./mempool-block.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MempoolBlockComponent implements OnInit, OnDestroy {
  network$: Observable<string>;
  mempoolBlockIndex: number;
  mempoolBlock$: Observable<MempoolBlock>;
  ordinal$: BehaviorSubject<string> = new BehaviorSubject('');

  constructor(
    private route: ActivatedRoute,
    public stateService: StateService,
    private seoService: SeoService,
    private websocketService: WebsocketService,
  ) { }

  ngOnInit(): void {
    this.websocketService.want(['blocks', 'mempool-blocks']);

    this.mempoolBlock$ = this.route.paramMap
      .pipe(
        switchMap((params: ParamMap) => {
          this.mempoolBlockIndex = parseInt(params.get('id'), 10) || 0;
          return this.stateService.mempoolBlocks$
            .pipe(
              map((blocks) => {
                if (!blocks.length) {
                  return [{ index: 0, blockSize: 0, blockVSize: 0, feeRange: [0, 0], medianFee: 0, nTx: 0, totalFees: 0 }];
                }
                return blocks;
              }),
              filter((mempoolBlocks) => mempoolBlocks.length > 0),
              map((mempoolBlocks) => {
                while (!mempoolBlocks[this.mempoolBlockIndex]) {
                  this.mempoolBlockIndex--;
                }
                const ordinal = this.getOrdinal(mempoolBlocks[this.mempoolBlockIndex]);
                this.ordinal$.next(ordinal);
                this.seoService.setTitle(ordinal);
                return mempoolBlocks[this.mempoolBlockIndex];
              })
            );
        }),
        tap(() => {
          this.stateService.markBlock$.next({ mempoolBlockIndex: this.mempoolBlockIndex });
        })
      );

    this.network$ = this.stateService.networkChanged$;
  }

  ngOnDestroy(): void {
    this.stateService.markBlock$.next({});
  }

  getOrdinal(mempoolBlock: MempoolBlock): string {
    const blocksInBlock = Math.ceil(mempoolBlock.blockVSize / this.stateService.blockVSize);
    if (this.mempoolBlockIndex === 0) {
      return $localize`:@@bdf0e930eb22431140a2eaeacd809cc5f8ebd38c:Next Block`;
    } else if (this.mempoolBlockIndex === this.stateService.env.KEEP_BLOCKS_AMOUNT - 1 && blocksInBlock > 1) {
      return $localize`:@@mempool-block.stack.of.blocks:Stack of ${blocksInBlock}:INTERPOLATION: mempool blocks`;
    } else {
      return $localize`:@@mempool-block.block.no:Mempool block ${this.mempoolBlockIndex + 1}:INTERPOLATION:`;
    }
 }
}
