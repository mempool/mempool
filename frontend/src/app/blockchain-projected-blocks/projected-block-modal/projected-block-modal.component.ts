import { Component, OnInit, Input } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { MemPoolService } from '../../services/mem-pool.service';
import { IBlock } from 'src/app/blockchain/interfaces';

@Component({
  selector: 'app-projected-block-modal',
  templateUrl: './projected-block-modal.component.html',
  styleUrls: ['./projected-block-modal.component.scss']
})
export class ProjectedBlockModalComponent implements OnInit {
  @Input() block: IBlock;
  @Input() index: number;

  conversions: any;

  constructor(
    public activeModal: NgbActiveModal,
    private memPoolService: MemPoolService,
  ) { }

  ngOnInit() {
    this.memPoolService.conversions$
      .subscribe((conversions) => {
        this.conversions = conversions;
      });
  }

}
