import { ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, Input, OnInit } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { StateService } from '../../services/state.service';
import { BlockExtended } from '../../interfaces/node-api.interface';
import { WebsocketService } from '../../services/websocket.service';
import { MempoolInfo, Recommendedfees } from '../../interfaces/websocket.interface';

@Component({
  selector: 'app-clock',
  templateUrl: './clock.component.html',
  styleUrls: ['./clock.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClockComponent implements OnInit {
  @Input() mode: 'block' | 'mempool' = 'block';
  blocksSubscription: Subscription;
  recommendedFees$: Observable<Recommendedfees>;
  mempoolInfo$: Observable<MempoolInfo>;
  block: BlockExtended;
  clockSize: number = 300;
  chainWidth: number = 384;
  chainHeight: number = 60;
  blockStyle;
  blockSizerStyle;
  wrapperStyle;

  gradientColors = {
    '': ['#9339f4', '#105fb0'],
    bisq: ['#9339f4', '#105fb0'],
    liquid: ['#116761', '#183550'],
    'liquidtestnet': ['#494a4a', '#272e46'],
    testnet: ['#1d486f', '#183550'],
    signet: ['#6f1d5d', '#471850'],
  };

  constructor(
    public stateService: StateService,
    private websocketService: WebsocketService,
    private cd: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.resizeCanvas();
    this.websocketService.want(['blocks']);
    this.blocksSubscription = this.stateService.blocks$
      .subscribe(([block]) => {
        if (block) {
          this.block = block;
          this.blockStyle = this.getStyleForBlock(this.block);
          this.cd.markForCheck();
        }
      });
    this.recommendedFees$ = this.stateService.recommendedFees$;
    this.mempoolInfo$ = this.stateService.mempoolInfo$;
  }

  getStyleForBlock(block: BlockExtended) {
    const greenBackgroundHeight = 100 - (block.weight / this.stateService.env.BLOCK_WEIGHT_UNITS) * 100;

    return {
      background: `repeating-linear-gradient(
        #2d3348,
        #2d3348 ${greenBackgroundHeight}%,
        ${this.gradientColors[''][0]} ${Math.max(greenBackgroundHeight, 0)}%,
        ${this.gradientColors[''][1]} 100%
      )`,
    };
  }
  
  @HostListener('window:resize', ['$event'])
  resizeCanvas(): void {
    this.chainWidth = window.innerWidth;
    this.chainHeight = Math.max(60, window.innerHeight / 8);
    this.clockSize = Math.min(800, window.innerWidth, window.innerHeight - (1.4 * this.chainHeight));
    const size = Math.ceil(this.clockSize / 75) * 75;
    const margin = (this.clockSize - size) / 2;
    this.blockSizerStyle = {
      transform: `translate(${margin}px, ${margin}px)`,
      width: `${size}px`,
      height: `${size}px`,
    };
    this.wrapperStyle = {
      '--clock-width': `${this.clockSize}px`,
      '--chain-height': `${this.chainHeight}px`
    };
    this.cd.markForCheck();
  }
}
