import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { Subscription, filter, map, switchMap, tap } from 'rxjs';
import { StateService } from '@app/services/state.service';
import { WebsocketService } from '@app/services/websocket.service';

function bestFitResolution(min, max, n): number {
  const target = (min + max) / 2;
  let bestScore = Infinity;
  let best = null;
  for (let i = min; i <= max; i++) {
    const remainder = (n % i);
    if (remainder < bestScore || (remainder === bestScore && (Math.abs(i - target) < Math.abs(best - target)))) {
      bestScore = remainder;
      best = i;
    }
  }
  return best;
}

@Component({
  selector: 'app-mempool-block-view',
  templateUrl: './mempool-block-view.component.html',
  styleUrls: ['./mempool-block-view.component.scss']
})
export class MempoolBlockViewComponent implements OnInit, OnDestroy {
  autofit: boolean = false;
  resolution: number = 80;
  index: number = 0;
  filterFlags: bigint | null = 0n;

  routeParamsSubscription: Subscription;
  queryParamsSubscription: Subscription;

  constructor(
    private route: ActivatedRoute,
    private websocketService: WebsocketService,
    public stateService: StateService,
  ) { }

  ngOnInit(): void {
    window['setFlags'] = this.setFilterFlags.bind(this);

    this.websocketService.want(['blocks', 'mempool-blocks']);

    this.routeParamsSubscription = this.route.paramMap
      .pipe(
        switchMap((params: ParamMap) => {
          this.index = parseInt(params.get('index'), 10) || 0;
          return this.stateService.mempoolBlocks$
            .pipe(
              map((blocks) => {
                if (!blocks.length) {
                  return [{ index: 0, blockSize: 0, blockVSize: 0, feeRange: [0, 0], medianFee: 0, nTx: 0, totalFees: 0 }];
                }
                return blocks;
              }),
              filter((mempoolBlocks) => mempoolBlocks.length > 0),
              tap((mempoolBlocks) => {
                while (!mempoolBlocks[this.index]) {
                  this.index--;
                }
              })
            );
        })
      ).subscribe();

    this.queryParamsSubscription = this.route.queryParams.subscribe((params) => {
      this.autofit = params.autofit === 'true';
      if (this.autofit) {
        this.onResize();
      }
    });
  }


  @HostListener('window:resize', ['$event'])
  onResize(): void {
    if (this.autofit) {
      this.resolution = bestFitResolution(64, 96, Math.min(window.innerWidth, window.innerHeight));
    }
  }

  ngOnDestroy(): void {
    this.routeParamsSubscription.unsubscribe();
    this.queryParamsSubscription.unsubscribe();
  }

  setFilterFlags(flags: bigint | null) {
    this.filterFlags = flags;
  }
}
