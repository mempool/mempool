import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { map, skip, switchMap } from 'rxjs/operators';
import { ApiService } from 'src/app/services/api.service';
import { StateService } from 'src/app/services/state.service';

@Component({
  selector: 'app-reward-stats',
  templateUrl: './reward-stats.component.html',
  styleUrls: ['./reward-stats.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RewardStatsComponent implements OnInit {
  public $rewardStats: Observable<any>;

  constructor(private apiService: ApiService, private stateService: StateService) { }

  ngOnInit(): void {
    this.$rewardStats = this.stateService.blocks$
      .pipe(
        // (we always receives some blocks at start so only trigger for the last one)
        skip(this.stateService.env.MEMPOOL_BLOCKS_AMOUNT - 1),
        switchMap(() => {
          return this.apiService.getRewardStats$()
            .pipe(
              map((stats) => {
                return {
                  totalReward: stats.totalReward,
                  rewardPerTx: stats.totalReward / stats.totalTx,
                  feePerTx: stats.totalFee / stats.totalTx,
                };
              })
            );
        })
      );
  }
}
