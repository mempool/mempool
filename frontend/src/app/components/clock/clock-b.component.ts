import { ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { StateService } from '../../services/state.service';
import { BlockExtended } from '../../interfaces/node-api.interface';
import { WebsocketService } from '../../services/websocket.service';

@Component({
  selector: 'app-clock-b',
  templateUrl: './clock-b.component.html',
  styleUrls: ['./clock.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClockBComponent implements OnInit {
  blocksSubscription: Subscription;
  block: BlockExtended;
  blockSizerStyle;

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
          this.cd.markForCheck();
        }
      });
  }

  @HostListener('window:resize', ['$event'])
  resizeCanvas(): void {
    const clockSize = Math.min(window.innerWidth, 0.78125 * window.innerHeight);
    const size = Math.ceil(clockSize / 75) * 75;
    const margin = (clockSize - size) / 2;
    this.blockSizerStyle = {
      transform: `translate(${margin}px, ${margin}px)`,
      width: `${size}px`,
      height: `${size}px`,
    };
    this.cd.markForCheck();
  }
}
