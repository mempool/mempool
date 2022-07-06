import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { concat, Observable } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
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
  private lastBlockHeight: number;

  constructor(private apiService: ApiService, private stateService: StateService) { }

  ngOnInit(): void {
    this.$rewardStats = concat(
      // We fetch the latest reward stats when the page load and
      // wait for the API response before listening to websocket blocks
      this.apiService.getRewardStats$()
        .pipe(
          tap((stats) => {
            this.lastBlockHeight = stats.endBlock;
          })
        ),
      // Or when we receive a newer block, newer than the latest reward stats api call
      this.stateService.blocks$
        .pipe(
          switchMap((block) => {
            if (block[0].height <= this.lastBlockHeight) {
              return []; // Return an empty stream so the last pipe is not executed
            }
            this.lastBlockHeight = block[0].height;
            return this.apiService.getRewardStats$();
          })
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

  isEllipsisActive(e) {
    return (e.offsetWidth < e.scrollWidth);
  }
}
