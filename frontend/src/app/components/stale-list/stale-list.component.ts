import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { StaleTip, BlockExtended } from '@interfaces/node-api.interface';
import { ApiService } from '@app/services/api.service';
import { StateService } from '@app/services/state.service';
import { SeoService } from '@app/services/seo.service';
import { seoDescriptionNetwork } from '@app/shared/common.utils';

@Component({
  selector: 'app-stale-list',
  templateUrl: './stale-list.component.html',
  styleUrls: ['./stale-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StaleList implements OnInit {
  chainTips$: Observable<StaleTip[]>;
  nextChainTipSubject = new BehaviorSubject(null);
  urlFragmentSubscription: Subscription;
  isLoading = true;

  gradientColors = {
    '': ['var(--mainnet-alt)', 'var(--primary)'],
    liquid: ['var(--liquid)', 'var(--testnet-alt)'],
    'liquidtestnet': ['var(--liquidtestnet)', 'var(--liquidtestnet-alt)'],
    testnet: ['var(--testnet)', 'var(--testnet-alt)'],
    testnet4: ['var(--testnet)', 'var(--testnet-alt)'],
    signet: ['var(--signet)', 'var(--signet-alt)'],
  };

  constructor(
    private apiService: ApiService,
    public stateService: StateService,
    private seoService: SeoService,
  ) { }

  ngOnInit(): void {
    this.chainTips$ = this.apiService.getStaleTips$().pipe(
      map((chainTips) => {
        const filtered = chainTips.filter((chainTip) => chainTip.status !== 'active') as StaleTip[];

        filtered.forEach((chainTip) => {
          if (chainTip.stale?.extras) {
            chainTip.stale.extras.minFee = this.getMinBlockFee(chainTip.stale);
            chainTip.stale.extras.maxFee = this.getMaxBlockFee(chainTip.stale);
          }
          if (chainTip.canonical?.extras) {
            chainTip.canonical.extras.minFee = this.getMinBlockFee(chainTip.canonical);
            chainTip.canonical.extras.maxFee = this.getMaxBlockFee(chainTip.canonical);
          }
        });

        return filtered;
      }),
      tap(() => {
        this.isLoading = false;
      })
    );

    this.seoService.setTitle($localize`:@@page.stale-chain-tips:Stale Chain Tips`);
    this.seoService.setDescription($localize`:@@meta.description.stale-chain-tips:See the most recent stale chain tips on the Bitcoin${seoDescriptionNetwork(this.stateService.network)} network.`);
  }

  getBlockGradient(block: BlockExtended): string {
    if (!block || !block.weight) {
      return 'var(--secondary)';
    }

    const backgroundHeight = 100 - (block.weight / this.stateService.env.BLOCK_WEIGHT_UNITS) * 100;
    const network = this.stateService.network || '';

    return `repeating-linear-gradient(
      var(--secondary),
      var(--secondary) ${backgroundHeight}%,
      ${this.gradientColors[network][0]} ${Math.max(backgroundHeight, 0)}%,
      ${this.gradientColors[network][1]} 100%
    )`;
  }

  getMinBlockFee(block: BlockExtended): number {
    if (block?.extras?.feeRange) {
      if (block.extras.medianFee === block.extras.feeRange[3]) {
        return block.extras.feeRange[1];
      } else {
        return block.extras.feeRange[0];
      }
    }
    return 0;
  }

  getMaxBlockFee(block: BlockExtended): number {
    if (block?.extras?.feeRange) {
      return block.extras.feeRange[block.extras.feeRange.length - 1];
    }
    return 0;
  }
}
