import { Component, OnInit, OnDestroy } from '@angular/core';
import { IBlock } from '../blockchain/interfaces';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { BlockModalComponent } from './block-modal/block-modal.component';
import { MemPoolService } from '../services/mem-pool.service';
import { Subscription } from 'rxjs';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-blockchain-blocks',
  templateUrl: './blockchain-blocks.component.html',
  styleUrls: ['./blockchain-blocks.component.scss']
})
export class BlockchainBlocksComponent implements OnInit, OnDestroy {
  blocks: IBlock[] = [];
  blocksSubscription: Subscription;
  interval: any;
  trigger = 0;
  isElectrsEnabled = !!environment.electrs;

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

    this.interval = setInterval(() => this.trigger++, 10 * 1000);
  }

  ngOnDestroy() {
    this.blocksSubscription.unsubscribe();
    clearInterval(this.interval);
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
