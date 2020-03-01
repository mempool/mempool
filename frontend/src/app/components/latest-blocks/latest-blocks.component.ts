import { Component, OnInit, OnDestroy } from '@angular/core';
import { ElectrsApiService } from '../../services/electrs-api.service';
import { StateService } from '../../services/state.service';
import { Block } from '../../interfaces/electrs.interface';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-latest-blocks',
  templateUrl: './latest-blocks.component.html',
  styleUrls: ['./latest-blocks.component.scss'],
})
export class LatestBlocksComponent implements OnInit, OnDestroy {
  blocks: any[] = [];
  blockSubscription: Subscription;
  isLoading = true;
  interval: any;

  constructor(
    private electrsApiService: ElectrsApiService,
    private stateService: StateService,
  ) { }

  ngOnInit() {
    this.blockSubscription = this.stateService.blocks$
      .subscribe((block) => {
        if (block === null || !this.blocks.length) {
          return;
        }

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
      });
  }

  loadMore() {
    if (this.isLoading) {
      return;
    }
    this.isLoading = true;
    this.electrsApiService.listBlocks$(this.blocks[this.blocks.length - 1].height - 1)
      .subscribe((blocks) => {
        this.blocks = this.blocks.concat(blocks);
        this.isLoading = false;
      });
  }

  trackByBlock(index: number, block: Block) {
    return block.height;
  }
}
