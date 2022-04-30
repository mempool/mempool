import { Component, Input, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { StateService } from '../../../services/state.service';

@Component({
  selector: 'app-sats',
  templateUrl: './sats.component.html',
  styleUrls: ['./sats.component.scss']
})
export class SatsComponent implements OnInit {
  @Input() satoshis: number;
  @Input() digitsInfo = 0;
  @Input() addPlus = false;

  network = '';
  stateSubscription: Subscription;

  constructor(
    private stateService: StateService,
  ) { }

  ngOnInit() {
    this.stateSubscription = this.stateService.networkChanged$.subscribe((network) => this.network = network);
  }

  ngOnDestroy() {
    if (this.stateSubscription) {
      this.stateSubscription.unsubscribe();
    }
  }

}
