import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { concat, Observable } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { ApiService } from '@app/services/api.service';
import { StateService } from '@app/services/state.service';

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
          switchMap((blocks) => {
            const maxHeight = blocks.reduce((max, block) => Math.max(max, block.height), 0);
            if (maxHeight <= this.lastBlockHeight) {
              return []; // Return an empty stream so the last pipe is not executed
            }
            this.lastBlockHeight = maxHeight;
            return this.apiService.getRewardStats$();
          })
        )
      )
      .pipe(
        map((stats) => {
          return {
            totalReward: stats.totalReward,
            feePerTx: stats.totalFee / stats.totalTx,
            feePerBlock: stats.totalFee / 144,
          };
        })
      );
  }

  isEllipsisActive(e) {
    return (e.offsetWidth < e.scrollWidth);
  }
}
