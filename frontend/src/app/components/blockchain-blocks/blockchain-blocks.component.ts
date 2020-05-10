import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Subscription } from 'rxjs';
import { Block } from 'src/app/interfaces/electrs.interface';
import { StateService } from 'src/app/services/state.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-blockchain-blocks',
  templateUrl: './blockchain-blocks.component.html',
  styleUrls: ['./blockchain-blocks.component.scss']
})
export class BlockchainBlocksComponent implements OnInit, OnDestroy {
  network = '';
  blocks: Block[] = [];
  markHeight: number;
  blocksSubscription: Subscription;
  interval: any;

  arrowVisible = false;
  arrowLeftPx = 30;

  transition = '1s';

  gradientColors = {
    '': ['#9339f4', '#105fb0'],
    liquid: ['#116761', '#183550'],
    testnet: ['#1d486f', '#183550'],
  };

  constructor(
    private stateService: StateService,
    private router: Router,
  ) { }

  ngOnInit() {
    this.stateService.networkChanged$.subscribe((network) => this.network = network);

    this.blocksSubscription = this.stateService.blocks$
      .subscribe((block) => {
        if (this.blocks.some((b) => b.height === block.height)) {
          return;
        }
        this.blocks.unshift(block);
        this.blocks = this.blocks.slice(0, 8);

        this.moveArrowToPosition(true);
      });

    this.stateService.markBlock$
      .subscribe((state) => {
        this.markHeight = undefined;
        if (state.blockHeight) {
          this.markHeight = state.blockHeight;
        }
        this.moveArrowToPosition(false);
      });
  }

  ngOnDestroy() {
    this.blocksSubscription.unsubscribe();
    clearInterval(this.interval);
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvents(event: KeyboardEvent) {
    if (!this.markHeight) {
      return;
    }
    if (event.key === 'ArrowRight') {
      const blockindex = this.blocks.findIndex((b) => b.height === this.markHeight);
      if (this.blocks[blockindex + 1]) {
        this.router.navigate([(this.network ? '/' + this.network : '') + '/block/',
          this.blocks[blockindex + 1].id], { state: { data: { block: this.blocks[blockindex + 1] } } });
      }
    } else if (event.key === 'ArrowLeft') {
      const blockindex = this.blocks.findIndex((b) => b.height === this.markHeight);
      if (blockindex === 0) {
        this.router.navigate([(this.network ? '/' + this.network : '') + '/mempool-block/', '0']);
      } else {
        this.router.navigate([(this.network ? '/' + this.network : '') + '/block/',
          this.blocks[blockindex - 1].id], { state: { data: { block: this.blocks[blockindex - 1] }}});
      }
    }
  }

  moveArrowToPosition(animate: boolean) {
    if (!this.markHeight) {
      this.arrowVisible = false;
      return;
    }
    const blockindex = this.blocks.findIndex((b) => b.height === this.markHeight);
    if (blockindex !== -1) {
      if (!animate) {
        this.transition = 'inherit';
      }
      this.arrowVisible = true;
      this.arrowLeftPx = blockindex * 155 + 30;
      if (!animate) {
        setTimeout(() => this.transition = '1s');
      }
    }
  }

  trackByBlocksFn(index: number, item: Block) {
    return item.height;
  }

  getStyleForBlock(block: Block) {
    const greenBackgroundHeight = 100 - (block.weight / 4000000) * 100;
    return {
      left: 155 * this.blocks.indexOf(block) + 'px',
      background: `repeating-linear-gradient(
        #2d3348,
        #2d3348 ${greenBackgroundHeight}%,
        ${this.gradientColors[this.network][0]} ${Math.max(greenBackgroundHeight, 0)}%,
        ${this.gradientColors[this.network][1]} 100%
      )`,
    };
  }

}
