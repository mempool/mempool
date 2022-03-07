import { ChangeDetectionStrategy, Component, Inject, LOCALE_ID, OnDestroy, OnInit } from '@angular/core';
import { map } from 'rxjs/operators';
import { SeoService } from 'src/app/services/seo.service';
import { StateService } from 'src/app/services/state.service';
import { formatNumber } from '@angular/common';
import { WebsocketService } from 'src/app/services/websocket.service';
import { Observable } from 'rxjs';

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

  constructor(private seoService: SeoService,
    public stateService: StateService,
    private websocketService: WebsocketService,
    @Inject(LOCALE_ID) private locale: string,
  ) {
    this.seoService.setTitle($localize`:@@mining.mining-dashboard:Mining Dashboard`);
  }

  ngOnInit(): void {
    this.$rewardStats = this.stateService.blocks$.pipe(
      map(([block]) => {
        this.blocks.unshift(block);
        this.blocks = this.blocks.slice(0, 8);
        const totalTx = this.blocks.reduce((acc, block) => acc + block.tx_count, 0);
        const totalFee = this.blocks.reduce((acc, block) => acc + block.extras?.totalFees ?? 0, 0);
        const totalReward = this.blocks.reduce((acc, block) => acc + block.extras?.reward ?? 0, 0);

        return {
          'totalReward': totalReward,
          'rewardPerTx': formatNumber(totalReward / totalTx, this.locale, '1.0-0'),
          'feePerTx': formatNumber(totalFee / totalTx, this.locale, '1.0-0'),
        }
      })
    );
  }
}
