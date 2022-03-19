import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { map } from 'rxjs/operators';
import { SeoService } from 'src/app/services/seo.service';
import { StateService } from 'src/app/services/state.service';
import { Observable } from 'rxjs';
import { WebsocketService } from 'src/app/services/websocket.service';

@Component({
  selector: 'app-mining-dashboard',
  templateUrl: './mining-dashboard.component.html',
  styleUrls: ['./mining-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MiningDashboardComponent implements OnInit {
  private blocks = [];

  public $rewardStats: Observable<any>;
  public totalReward = 0;
  public rewardPerTx = '~';
  public feePerTx = '~';

  constructor(
    private seoService: SeoService,
    public stateService: StateService,
    private websocketService: WebsocketService,
  ) {
    this.seoService.setTitle($localize`:@@mining.mining-dashboard:Mining Dashboard`);
  }

  ngOnInit(): void {
    this.websocketService.want(['blocks', 'mempool-blocks']);

    this.$rewardStats = this.stateService.blocks$.pipe(
      map(([block]) => {
        this.blocks.unshift(block);
        this.blocks = this.blocks.slice(0, 8);
        const totalTx = this.blocks.reduce((acc, b) => acc + b.tx_count, 0);
        const totalFee = this.blocks.reduce((acc, b) => acc + b.extras?.totalFees ?? 0, 0);
        const totalReward = this.blocks.reduce((acc, b) => acc + b.extras?.reward ?? 0, 0);

        return {
          'totalReward': totalReward,
          'rewardPerTx': Math.round(totalReward / totalTx),
          'feePerTx': Math.round(totalFee / totalTx),
        };
      })
    );
  }
}
