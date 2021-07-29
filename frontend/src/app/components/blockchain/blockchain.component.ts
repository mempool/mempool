import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { StateService } from 'src/app/services/state.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-blockchain',
  templateUrl: './blockchain.component.html',
  styleUrls: ['./blockchain.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockchainComponent implements OnInit {
  isLoading$: Observable<boolean>;
  network: string;

  constructor(
    private stateService: StateService,
  ) {}

  ngOnInit() {
    this.isLoading$ = this.stateService.isLoadingWebSocket$;
    this.network = this.stateService.network;
  }
}
