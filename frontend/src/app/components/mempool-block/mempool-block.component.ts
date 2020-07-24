import { Component, OnInit, OnDestroy } from '@angular/core';
import { StateService } from 'src/app/services/state.service';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { switchMap, map, tap, filter } from 'rxjs/operators';
import { MempoolBlock } from 'src/app/interfaces/websocket.interface';
import { Observable } from 'rxjs';
import { SeoService } from 'src/app/services/seo.service';
import { env } from 'src/app/app.constants';

@Component({
  selector: 'app-mempool-block',
  templateUrl: './mempool-block.component.html',
  styleUrls: ['./mempool-block.component.scss']
})
export class MempoolBlockComponent implements OnInit, OnDestroy {
  network = '';
  mempoolBlockIndex: number;
  mempoolBlock$: Observable<MempoolBlock>;
  ordinal: string;

  constructor(
    private route: ActivatedRoute,
    private stateService: StateService,
    private seoService: SeoService,
  ) { }

  ngOnInit(): void {
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
              this.setOrdinal(mempoolBlocks[this.mempoolBlockIndex]);
              this.seoService.setTitle(this.ordinal);
              return mempoolBlocks[this.mempoolBlockIndex];
            })
          );
        }),
        tap(() => {
          this.stateService.markBlock$.next({ mempoolBlockIndex: this.mempoolBlockIndex });
        })
      );

    this.stateService.networkChanged$
      .subscribe((network) => this.network = network);
  }

  ngOnDestroy(): void {
    this.stateService.markBlock$.next({});
  }

  setOrdinal(mempoolBlock: MempoolBlock) {
    const blocksInBlock = Math.ceil(mempoolBlock.blockVSize / 1000000);
    if (this.mempoolBlockIndex === 0) {
      this.ordinal = 'Next block';
    } else if (this.mempoolBlockIndex === env.KEEP_BLOCKS_AMOUNT - 1 && blocksInBlock > 1 ) {
      this.ordinal = `Stack of ${blocksInBlock} blocks`;
    } else {
      const s = ['th', 'st', 'nd', 'rd'];
      const v = this.mempoolBlockIndex + 1 % 100;
      this.ordinal = this.mempoolBlockIndex + 1 + (s[(v - 20) % 10] || s[v] || s[0]) + ' next block';
    }
 }
}
