import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { StateService } from 'src/app/services/state.service';
import { Subscription, Observable } from 'rxjs';

@Component({
  selector: 'app-blockchain',
  templateUrl: './blockchain.component.html',
  styleUrls: ['./blockchain.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockchainComponent implements OnInit {
  isLoading$: Observable<boolean>;

  constructor(
    private stateService: StateService,
  ) {}

  ngOnInit() {
    this.isLoading$ = this.stateService.isLoadingWebSocket$;
  }
}
