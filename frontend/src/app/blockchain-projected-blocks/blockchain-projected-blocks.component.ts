import { Component, Input } from '@angular/core';
import { IProjectedBlock, IBlock } from '../blockchain/interfaces';
import { ProjectedBlockModalComponent } from './projected-block-modal/projected-block-modal.component';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-blockchain-projected-blocks',
  templateUrl: './blockchain-projected-blocks.component.html',
  styleUrls: ['./blockchain-projected-blocks.component.scss']
})
export class BlockchainProjectedBlocksComponent {

  @Input() projectedBlocks: IProjectedBlock[];

  constructor(
    private modalService: NgbModal,
  ) { }

  trackByProjectedFn(index: number) {
    return index;
  }

  openProjectedBlockModal(block: IBlock, index: number) {
    const modalRef = this.modalService.open(ProjectedBlockModalComponent, { size: 'lg' });
    modalRef.componentInstance.block = block;
    modalRef.componentInstance.index = index;
  }

  getStyleForProjectedBlockAtIndex(index: number) {
    const greenBackgroundHeight = 100 - (this.projectedBlocks[index].blockWeight / 4000000) * 100;
    if (window.innerWidth <= 768) {
      if (index === 3) {
        return {
          'top': 40 + index * 155 + 'px'
        };
      }
      return {
        'top': 40 + index * 155 + 'px',
        'background': `repeating-linear-gradient(#554b45, #554b45 ${greenBackgroundHeight}%,
          #bd7c13 ${Math.max(greenBackgroundHeight, 0)}%, #c5345a 100%)`,
      };
    } else {
      if (index === 3) {
        return {
          'right': 40 + index * 155 + 'px'
        };
      }
      return {
        'right': 40 + index * 155 + 'px',
        'background': `repeating-linear-gradient(#554b45, #554b45 ${greenBackgroundHeight}%,
          #bd7c13 ${Math.max(greenBackgroundHeight, 0)}%, #c5345a 100%)`,
      };
    }
  }

}
