import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { Env, StateService } from '@app/services/state.service';
import { CurrentPegs } from '@interfaces/node-api.interface';

@Component({
  selector: 'app-reserves-supply-stats',
  templateUrl: './reserves-supply-stats.component.html',
  styleUrls: ['./reserves-supply-stats.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReservesSupplyStatsComponent implements OnInit {
  @Input() currentReserves$: Observable<CurrentPegs>;
  @Input() currentPeg$: Observable<CurrentPegs>;

  env: Env;

  constructor(private stateService: StateService) { }

  ngOnInit(): void {
    this.env = this.stateService.env;
  }

}
