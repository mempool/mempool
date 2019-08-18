import { Component, OnInit, Input } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { IBlock } from '../../blockchain/interfaces';
import { MemPoolService } from '../../services/mem-pool.service';

@Component({
  selector: 'app-block-modal',
  templateUrl: './block-modal.component.html',
  styleUrls: ['./block-modal.component.scss']
})
export class BlockModalComponent implements OnInit {
  @Input() block: IBlock;

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
