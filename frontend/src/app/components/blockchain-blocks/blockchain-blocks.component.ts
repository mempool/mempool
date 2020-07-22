import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { Block } from 'src/app/interfaces/electrs.interface';
import { StateService } from 'src/app/services/state.service';
import { Router } from '@angular/router';
import { AudioService } from 'src/app/services/audio.service';
import { env } from 'src/app/app.constants';

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
  blockStyles = [];
  interval: any;
  tabHidden = true;

  arrowVisible = false;
  arrowLeftPx = 30;
  blocksFilled = false;
  transition = '1s';

  gradientColors = {
    '': ['#9339f4', '#105fb0'],
    bisq: ['#9339f4', '#105fb0'],
    liquid: ['#116761', '#183550'],
    testnet: ['#1d486f', '#183550'],
  };

  constructor(
    private stateService: StateService,
    private router: Router,
  ) { }

  ngOnInit() {
    this.stateService.networkChanged$.subscribe((network) => this.network = network);
    this.stateService.isTabHidden$.subscribe((tabHidden) => this.tabHidden = tabHidden);

    this.blocksSubscription = this.stateService.blocks$
      .subscribe(([block, txConfirmed]) => {
        if (this.blocks.some((b) => b.height === block.height)) {
          return;
        }

        if (this.blocks.length && block.height !== this.blocks[0].height + 1) {
          this.blocks = [];
          this.blocksFilled = false;
        }

        this.blocks.unshift(block);
        this.blocks = this.blocks.slice(0, 8);

        if (this.blocksFilled && !this.tabHidden) {
          block.stage = block.matchRate >= 66 ? 1 : 2;
        }

        if (txConfirmed) {
          this.markHeight = block.height;
          this.moveArrowToPosition(true, true);
        } else {
          this.moveArrowToPosition(true, false);
        }

        this.blockStyles = [];
        this.blocks.forEach((b) => this.blockStyles.push(this.getStyleForBlock(b)));
        setTimeout(() => {
          this.blockStyles = [];
          this.blocks.forEach((b) => this.blockStyles.push(this.getStyleForBlock(b)));
        }, 50);

        if (this.blocks.length === env.KEEP_BLOCKS_AMOUNT) {
          this.blocksFilled = true;
        }
      });

    this.stateService.markBlock$
      .subscribe((state) => {
        this.markHeight = undefined;
        if (state.blockHeight) {
          this.markHeight = state.blockHeight;
        }
        this.moveArrowToPosition(false);
      });

    this.stateService.keyNavigation$.subscribe((event) => {
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
    });
  }

  ngOnDestroy() {
    this.blocksSubscription.unsubscribe();
    clearInterval(this.interval);
  }

  moveArrowToPosition(animate: boolean, newBlockFromLeft = false) {
    if (!this.markHeight) {
      this.arrowVisible = false;
      return;
    }
    const blockindex = this.blocks.findIndex((b) => b.height === this.markHeight);
    if (blockindex > -1) {
      if (!animate) {
        this.transition = 'inherit';
      }
      this.arrowVisible = true;
      if (newBlockFromLeft) {
        this.arrowLeftPx = blockindex * 155 + 30 - 205;
        setTimeout(() => {
          this.transition = '2s';
          this.arrowLeftPx = blockindex * 155 + 30;
        }, 50);
      } else {
        this.arrowLeftPx = blockindex * 155 + 30;
        if (!animate) {
          setTimeout(() => this.transition = '2s');
        }
      }
    }
  }

  trackByBlocksFn(index: number, item: Block) {
    return item.height;
  }

  getStyleForBlock(block: Block) {
    const greenBackgroundHeight = 100 - (block.weight / 4000000) * 100;
    let addLeft = 0;

    if (block.stage === 1) {
      block.stage = 2;
      addLeft = -205;
    }

    return {
      left: addLeft + 155 * this.blocks.indexOf(block) + 'px',
      background: `repeating-linear-gradient(
        #2d3348,
        #2d3348 ${greenBackgroundHeight}%,
        ${this.gradientColors[this.network][0]} ${Math.max(greenBackgroundHeight, 0)}%,
        ${this.gradientColors[this.network][1]} 100%
      )`,
    };
  }

}
