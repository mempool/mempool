import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { StateService } from '../../services/state.service';

@Component({
  selector: 'app-blockchain',
  templateUrl: './blockchain.component.html',
  styleUrls: ['./blockchain.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockchainComponent implements OnInit {
  network: string;

  constructor(
    public stateService: StateService,
  ) {}

  ngOnInit() {
    this.network = this.stateService.network;
  }
}
