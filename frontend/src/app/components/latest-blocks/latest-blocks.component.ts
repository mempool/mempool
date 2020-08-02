import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { ElectrsApiService } from '../../services/electrs-api.service';
import { StateService } from '../../services/state.service';
import { Block } from '../../interfaces/electrs.interface';
import { Subscription, Observable, merge, of } from 'rxjs';
import { SeoService } from 'src/app/services/seo.service';

@Component({
  selector: 'app-latest-blocks',
  templateUrl: './latest-blocks.component.html',
  styleUrls: ['./latest-blocks.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LatestBlocksComponent implements OnInit, OnDestroy {
  network$: Observable<string>;

  blocks: any[] = [];
  blockSubscription: Subscription;
  isLoading = true;
  interval: any;

  latestBlockHeight: number;

  heightOfPageUntilBlocks = 430;
  heightOfBlocksTableChunk = 470;

  constructor(
    private electrsApiService: ElectrsApiService,
    private stateService: StateService,
    private seoService: SeoService,
    private cd: ChangeDetectorRef,
  ) { }

  ngOnInit() {
    this.seoService.resetTitle();
    this.network$ = merge(of(''), this.stateService.networkChanged$);

    this.blockSubscription = this.stateService.blocks$
      .subscribe(([block]) => {
        if (block === null || !this.blocks.length) {
          return;
        }

        this.latestBlockHeight = block.height;

        if (block.height === this.blocks[0].height) {
          return;
        }

        // If we are out of sync, reload the blocks instead
        if (block.height > this.blocks[0].height + 1) {
          this.loadInitialBlocks();
          return;
        }

        if (block.height <= this.blocks[0].height) {
          return;
        }

        this.blocks.pop();
        this.blocks.unshift(block);
        this.cd.markForCheck();
      });

    this.loadInitialBlocks();
  }

  ngOnDestroy() {
    clearInterval(this.interval);
    this.blockSubscription.unsubscribe();
  }

  loadInitialBlocks() {
    this.electrsApiService.listBlocks$()
      .subscribe((blocks) => {
        this.blocks = blocks;
        this.isLoading = false;

        this.latestBlockHeight = blocks[0].height;

        const spaceForBlocks = window.innerHeight - this.heightOfPageUntilBlocks;
        const chunks = Math.ceil(spaceForBlocks / this.heightOfBlocksTableChunk) - 1;
        if (chunks > 0) {
          this.loadMore(chunks);
        }
        this.cd.markForCheck();
      });
  }

  loadMore(chunks = 0) {
    if (this.isLoading) {
      return;
    }
    this.isLoading = true;
    this.electrsApiService.listBlocks$(this.blocks[this.blocks.length - 1].height - 1)
      .subscribe((blocks) => {
        this.blocks = this.blocks.concat(blocks);
        this.isLoading = false;

        const chunksLeft = chunks - 1;
        if (chunksLeft > 0) {
          this.loadMore(chunksLeft);
        }
        this.cd.markForCheck();
      });
  }

  trackByBlock(index: number, block: Block) {
    return block.height;
  }
}
