import { Component, OnInit } from '@angular/core';
import { StateService } from 'src/app/services/state.service';

@Component({
  selector: 'app-blockchain',
  templateUrl: './blockchain.component.html',
  styleUrls: ['./blockchain.component.scss']
})
export class BlockchainComponent implements OnInit {
  txTrackingLoading = false;
  txShowTxNotFound = false;
  isLoading = true;

  constructor(
    private stateService: StateService,
  ) {}

  ngOnInit() {
    this.stateService.blocks$.subscribe(() => this.isLoading = false);
  }
}
