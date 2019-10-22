import { Component, OnInit, OnDestroy } from '@angular/core';
import { IBlock } from '../blockchain/interfaces';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { BlockModalComponent } from './block-modal/block-modal.component';
import { MemPoolService } from '../services/mem-pool.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-blockchain-blocks',
  templateUrl: './blockchain-blocks.component.html',
  styleUrls: ['./blockchain-blocks.component.scss']
})
export class BlockchainBlocksComponent implements OnInit, OnDestroy {
  blocks: IBlock[] = [];
  blocksSubscription: Subscription;

  constructor(
    private modalService: NgbModal,
    private memPoolService: MemPoolService,
  ) { }

  ngOnInit() {
    this.blocksSubscription = this.memPoolService.blocks$
      .subscribe((block) => {
        if (this.blocks.some((b) => b.height === block.height)) {
          return;
        }
        this.blocks.unshift(block);
        this.blocks = this.blocks.slice(0, 8);
      });
  }

  ngOnDestroy() {
    this.blocksSubscription.unsubscribe();
  }

  getTimeSinceMined(block: IBlock): string {
    const minutes = ((new Date().getTime()) - (new Date(block.time * 1000).getTime())) / 1000 / 60;
    if (minutes >= 120) {
      return Math.floor(minutes / 60) + ' hours';
    }
    if (minutes >= 60) {
      return Math.floor(minutes / 60) + ' hour';
    }
    if (minutes <= 1) {
      return '< 1 minute';
    }
    if (minutes === 1) {
      return '1 minute';
    }
    return Math.round(minutes) + ' minutes';
  }

  trackByBlocksFn(index: number, item: IBlock) {
    return item.height;
  }

  openBlockModal(block: IBlock) {
    const modalRef = this.modalService.open(BlockModalComponent, { size: 'lg' });
    modalRef.componentInstance.block = block;
  }

  getStyleForBlock(block: IBlock) {
    const greenBackgroundHeight = 100 - (block.weight / 4000000) * 100;
    if (window.innerWidth <= 768) {
      return {
        'top': 155 * this.blocks.indexOf(block) + 'px',
        'background': `repeating-linear-gradient(#2d3348, #2d3348 ${greenBackgroundHeight}%,
          #9339f4 ${Math.max(greenBackgroundHeight, 0)}%, #105fb0 100%)`,
      };
    } else {
      return {
        'left': 155 * this.blocks.indexOf(block) + 'px',
        'background': `repeating-linear-gradient(#2d3348, #2d3348 ${greenBackgroundHeight}%,
          #9339f4 ${Math.max(greenBackgroundHeight, 0)}%, #105fb0 100%)`,
      };
    }
  }

}
