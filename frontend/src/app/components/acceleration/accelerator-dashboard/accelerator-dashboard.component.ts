import { ChangeDetectionStrategy, Component, HostListener, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { SeoService } from '../../../services/seo.service';
import { OpenGraphService } from '../../../services/opengraph.service';
import { WebsocketService } from '../../../services/websocket.service';
import { Acceleration, BlockExtended } from '../../../interfaces/node-api.interface';
import { StateService } from '../../../services/state.service';
import { Observable, catchError, combineLatest, distinctUntilChanged, interval, map, of, share, startWith, switchMap, tap } from 'rxjs';
import { Color } from '../../block-overview-graph/sprite-types';
import { hexToColor } from '../../block-overview-graph/utils';
import TxView from '../../block-overview-graph/tx-view';
import { feeLevels, defaultMempoolFeeColors, contrastMempoolFeeColors } from '../../../app.constants';
import { ServicesApiServices } from '../../../services/services-api.service';
import { detectWebGL } from '../../../shared/graphs.utils';
import { AudioService } from '../../../services/audio.service';
import { ThemeService } from '../../../services/theme.service';

const acceleratedColor: Color = hexToColor('8F5FF6');
const normalColors = defaultMempoolFeeColors.map(hex => hexToColor(hex.slice(0,6) + '5F'));
const contrastColors = contrastMempoolFeeColors.map(hex => hexToColor(hex.slice(0,6).slice(0,6) + '5F'));

interface AccelerationBlock extends BlockExtended {
  accelerationCount: number,
}

@Component({
  selector: 'app-accelerator-dashboard',
  templateUrl: './accelerator-dashboard.component.html',
  styleUrls: ['./accelerator-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AcceleratorDashboardComponent implements OnInit {
  blocks$: Observable<AccelerationBlock[]>;
  accelerations$: Observable<Acceleration[]>;
  pendingAccelerations$: Observable<Acceleration[]>;
  minedAccelerations$: Observable<Acceleration[]>;
  loadingBlocks: boolean = true;
  webGlEnabled = true;
  seen: Set<string> = new Set();
  firstLoad = true;

  graphHeight: number = 300;
  theme: ThemeService;

  constructor(
    private seoService: SeoService,
    private ogService: OpenGraphService,
    private websocketService: WebsocketService,
    private serviceApiServices: ServicesApiServices,
    private audioService: AudioService,
    private stateService: StateService,
    @Inject(PLATFORM_ID) private platformId: Object,
  ) {
    this.webGlEnabled = this.stateService.isBrowser && detectWebGL();
    this.seoService.setTitle($localize`:@@6b867dc61c6a92f3229f1950f9f2d414790cce95:Accelerator Dashboard`);
    this.ogService.setManualOgImage('accelerator.jpg');
  }

  ngOnInit(): void {
    this.onResize();
    this.websocketService.want(['blocks', 'mempool-blocks', 'stats']);

    this.pendingAccelerations$ = (this.stateService.isBrowser ? interval(30000) : of(null)).pipe(
      startWith(true),
      switchMap(() => {
        return this.serviceApiServices.getAccelerations$().pipe(
          catchError(() => {
            return of([]);
          }),
        );
      }),
      tap(accelerations => {
        if (!this.firstLoad && accelerations.some(acc => !this.seen.has(acc.txid))) {
          this.audioService.playSound('bright-harmony');
        }
        for(const acc of accelerations) {
          this.seen.add(acc.txid);
        }
        this.firstLoad = false;
      }),
      share(),
    );

    this.accelerations$ = this.stateService.chainTip$.pipe(
      distinctUntilChanged(),
      switchMap(() => {
        return this.serviceApiServices.getAccelerationHistory$({}).pipe(
          catchError(() => {
            return of([]);
          }),
        );
      }),
      share(),
    );

    this.minedAccelerations$ = this.accelerations$.pipe(
      map(accelerations => {
        return accelerations.filter(acc => ['completed_provisional', 'completed'].includes(acc.status));
      })
    );

    this.blocks$ = combineLatest([
      this.accelerations$,
      this.stateService.blocks$.pipe(
        switchMap((blocks) => {
          if (this.stateService.env.MINING_DASHBOARD === true) {
            for (const block of blocks) {
              // @ts-ignore: Need to add an extra field for the template
              block.extras.pool.logo = `/resources/mining-pools/` +
                block.extras.pool.name.toLowerCase().replace(' ', '').replace('.', '') + '.svg';
            }
          }
          return of(blocks as AccelerationBlock[]);
        }),
        tap(() => {
          this.loadingBlocks = false;
        })
      )
    ]).pipe(
      switchMap(([accelerations, blocks]) => {
        const blockMap = {};
        for (const block of blocks) {
          blockMap[block.id] = block;
        }
        const accelerationsByBlock: { [ hash: string ]: Acceleration[] } = {};
        for (const acceleration of accelerations) {
          if (['completed_provisional', 'failed_provisional', 'completed'].includes(acceleration.status) && acceleration.pools.includes(blockMap[acceleration.blockHash]?.extras.pool.id)) {
            if (!accelerationsByBlock[acceleration.blockHash]) {
              accelerationsByBlock[acceleration.blockHash] = [];
            }
            accelerationsByBlock[acceleration.blockHash].push(acceleration);
          }
        }
        return of(blocks.slice(0, 6).map(block => {
          block.accelerationCount = (accelerationsByBlock[block.id] || []).length;
          return block;
        }));
      })
    );
  }

  getAcceleratorColor(tx: TxView): Color {
    if (tx.status === 'accelerated' || tx.acc) {
      return acceleratedColor;
    } else {
      const rate = tx.fee / tx.vsize; // color by simple single-tx fee rate
      const feeLevelIndex = feeLevels.findIndex((feeLvl) => Math.max(1, rate) < feeLvl) - 1;
      return this.theme.theme === 'contrast' ? contrastColors[feeLevelIndex] || contrastColors[contrastColors.length - 1] : normalColors[feeLevelIndex] || normalColors[normalColors.length - 1];
    }
  }

  @HostListener('window:resize', ['$event'])
  onResize(): void {
    if (window.innerWidth >= 992) {
      this.graphHeight = 380;
    } else if (window.innerWidth >= 768) {
      this.graphHeight = 300;
    } else {
      this.graphHeight = 270;
    }
  }
}
