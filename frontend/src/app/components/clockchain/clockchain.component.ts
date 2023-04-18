import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, Input } from '@angular/core';
import { firstValueFrom, Subscription } from 'rxjs';
import { StateService } from '../../services/state.service';

@Component({
  selector: 'app-clockchain',
  templateUrl: './clockchain.component.html',
  styleUrls: ['./clockchain.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClockchainComponent implements OnInit, OnDestroy {
  network: string;
  timeLtrSubscription: Subscription;
  timeLtr: boolean = this.stateService.timeLtr.value;
  ltrTransitionEnabled = false;
  connectionStateSubscription: Subscription;
  loadingTip: boolean = true;
  connected: boolean = true;

  constructor(
    public stateService: StateService,
  ) {}

  ngOnInit() {
    this.network = this.stateService.network;
    this.timeLtrSubscription = this.stateService.timeLtr.subscribe((ltr) => {
      this.timeLtr = !!ltr;
    });
    this.connectionStateSubscription = this.stateService.connectionState$.subscribe(state => {
      this.connected = (state === 2);
    })
    firstValueFrom(this.stateService.chainTip$).then(tip => {
      this.loadingTip = false;
    });
  }

  ngOnDestroy() {
    this.timeLtrSubscription.unsubscribe();
    this.connectionStateSubscription.unsubscribe();
  }

  trackByPageFn(index: number, item: { index: number }) {
    return item.index;
  }

  toggleTimeDirection() {
    this.ltrTransitionEnabled = true;
    this.stateService.timeLtr.next(!this.timeLtr);
  }
}
