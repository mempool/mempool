import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from 'src/app/services/api.service';

@Component({
  selector: 'app-reward-stats',
  templateUrl: './reward-stats.component.html',
  styleUrls: ['./reward-stats.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RewardStatsComponent implements OnInit {
  public $rewardStats: Observable<any>;

  constructor(private apiService: ApiService) { }

  ngOnInit(): void {
    this.$rewardStats = this.apiService.getRewardStats$()
      .pipe(
        map((res) => {
          return {
            totalReward: res.totalReward,
            rewardPerTx: res.totalReward / res.totalTx,
            feePerTx: res.totalFee / res.totalTx,
          };
        })
      );
  }
}
