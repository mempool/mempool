import { Component, OnInit, Input } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { IBlock } from '../../blockchain/interfaces';
import { MemPoolService } from '../../services/mem-pool.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-block-modal',
  templateUrl: './block-modal.component.html',
  styleUrls: ['./block-modal.component.scss']
})
export class BlockModalComponent implements OnInit {
  @Input() block: IBlock;
  blockSubsidy = 50;
  isEsploraEnabled = !!environment.esplora;
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

    let halvenings = Math.floor(this.block.height / 210000);
    while (halvenings > 0) {
      this.blockSubsidy = this.blockSubsidy / 2;
      halvenings--;
    }
  }
}
