import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { merge, Observable } from 'rxjs';
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

  constructor(
    private apiService: ApiService,
    private stateService: StateService
    ) { }

  ngOnInit(): void {
    this.$rewardStats = merge(
      // We fetch the latest reward stats when the page load and
      // wait for the API response before listening to websocket blocks
      this.apiService.getRewardStats$(),
      // Or when we receive a newer block, newer than the latest reward stats api call
      this.stateService.blocks$
        .pipe(
          skip(this.stateService.env.KEEP_BLOCKS_AMOUNT),
          switchMap(() => this.apiService.getRewardStats$()),
        )
      )
      .pipe(
        map((stats) => {
          return {
            totalReward: stats.totalReward,
            rewardPerTx: stats.totalReward / stats.totalTx,
            feePerTx: stats.totalFee / stats.totalTx,
          };
        })
      );
  }
}
