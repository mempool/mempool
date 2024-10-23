import { ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, Input, OnInit } from '@angular/core';
import { Observable, Subscription, of, switchMap, tap } from 'rxjs';
import { StateService } from '@app/services/state.service';
import { BlockExtended } from '@interfaces/node-api.interface';
import { WebsocketService } from '@app/services/websocket.service';
import { MempoolInfo, Recommendedfees } from '@interfaces/websocket.interface';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { RelativeUrlPipe } from '@app/shared/pipes/relative-url/relative-url.pipe';

@Component({
  selector: 'app-clock',
  templateUrl: './clock.component.html',
  styleUrls: ['./clock.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClockComponent implements OnInit {
  hideStats: boolean = false;
  mode: 'mempool' | 'mined' = 'mined';
  blockIndex: number;
  pageSubscription: Subscription;
  blocksSubscription: Subscription;
  recommendedFees$: Observable<Recommendedfees>;
  mempoolInfo$: Observable<MempoolInfo>;
  blocks: BlockExtended[] = [];
  clockSize: number = 300;
  chainWidth: number = 384;
  chainHeight: number = 60;
  blockStyle;
  blockSizerStyle;
  wrapperStyle;
  limitWidth: number;
  limitHeight: number;

  gradientColors = {
    '': ['var(--mainnet-alt)', 'var(--primary)'],
    liquid: ['var(--liquid)', 'var(--testnet-alt)'],
    'liquidtestnet': ['var(--liquidtestnet)', 'var(--liquidtestnet-alt)'],
    testnet: ['var(--testnet)', 'var(--testnet-alt)'],
    testnet4: ['var(--testnet)', 'var(--testnet-alt)'],
    signet: ['var(--signet)', 'var(--signet-alt)'],
  };

  constructor(
    public stateService: StateService,
    private websocketService: WebsocketService,
    private route: ActivatedRoute,
    private router: Router,
    private relativeUrlPipe: RelativeUrlPipe,
    private cd: ChangeDetectorRef,
  ) {
    this.route.queryParams.subscribe((params) => {
      this.hideStats = params && params.stats === 'false';
      this.limitWidth = Number.parseInt(params.width) || null;
      this.limitHeight = Number.parseInt(params.height) || null;
    });
  }

  ngOnInit(): void {
    this.resizeCanvas();
    this.websocketService.want(['blocks', 'stats', 'mempool-blocks']);

    this.blocksSubscription = this.stateService.blocks$
      .subscribe((blocks) => {
        this.blocks = blocks.slice(0, 16);
        if (this.blocks[this.blockIndex]) {
          this.blockStyle = this.getStyleForBlock(this.blocks[this.blockIndex]);
          this.cd.markForCheck();
        }
      });

    this.recommendedFees$ = this.stateService.recommendedFees$;
    this.mempoolInfo$ = this.stateService.mempoolInfo$;

    this.pageSubscription = this.route.paramMap.pipe(
      switchMap((params: ParamMap) => {
        const rawMode: string = params.get('mode');
        const mode = rawMode === 'mempool' ? 'mempool' : 'mined';
        const index: number = Number.parseInt(params.get('index'));
        if (mode !== rawMode || index < 0 || isNaN(index)) {
          this.router.navigate([this.relativeUrlPipe.transform('/clock'), mode, index || 0]);
        }
        return of({
          mode,
          index,
        });
      }),
      tap((page: { mode: 'mempool' | 'mined', index: number }) => {
        this.mode = page.mode;
        this.blockIndex = page.index || 0;
        if (this.blocks[this.blockIndex]) {
          this.blockStyle = this.getStyleForBlock(this.blocks[this.blockIndex]);
          this.cd.markForCheck();
        }
      })
    ).subscribe();
  }

  getStyleForBlock(block: BlockExtended) {
    const greenBackgroundHeight = 100 - (block.weight / this.stateService.env.BLOCK_WEIGHT_UNITS) * 100;

    return {
      background: `repeating-linear-gradient(
        var(--secondary),
        var(--secondary) ${greenBackgroundHeight}%,
        ${this.gradientColors[''][0]} ${Math.max(greenBackgroundHeight, 0)}%,
        ${this.gradientColors[''][1]} 100%
      )`,
    };
  }
  
  @HostListener('window:resize', ['$event'])
  resizeCanvas(): void {
    const windowWidth = this.limitWidth || window.innerWidth || 800;
    const windowHeight = this.limitHeight || window.innerHeight || 800;
    this.chainWidth = windowWidth;
    this.chainHeight = Math.max(60, windowHeight / 8);
    this.clockSize = Math.min(800, windowWidth, windowHeight - (1.4 * this.chainHeight));
    const size = Math.ceil(this.clockSize / 75) * 75;
    const margin = (this.clockSize - size) / 2;
    this.blockSizerStyle = {
      transform: `translate(${margin}px, ${margin}px)`,
      width: `${size}px`,
      height: `${size}px`,
    };
    this.wrapperStyle = {
      '--clock-width': `${this.clockSize}px`,
      '--chain-height': `${this.chainHeight}px`,
      'width': this.limitWidth ? `${this.limitWidth}px` : undefined,
      'height': this.limitHeight ? `${this.limitHeight}px` : undefined,
    };
    this.cd.markForCheck();
  }
}
