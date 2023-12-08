import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { SeoService } from '../../../services/seo.service';
import { WebsocketService } from '../../../services/websocket.service';
import { Acceleration, BlockExtended } from '../../../interfaces/node-api.interface';
import { StateService } from '../../../services/state.service';
import { Observable, Subject, catchError, combineLatest, distinctUntilChanged, interval, map, of, share, startWith, switchMap, tap } from 'rxjs';
import { ApiService } from '../../../services/api.service';
import { Color } from '../../block-overview-graph/sprite-types';
import { hexToColor } from '../../block-overview-graph/utils';
import TxView from '../../block-overview-graph/tx-view';
import { feeLevels, mempoolFeeColors } from '../../../app.constants';

const acceleratedColor: Color = hexToColor('8F5FF6');
const normalColors = mempoolFeeColors.map(hex => hexToColor(hex + '5F'));

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

  constructor(
    private seoService: SeoService,
    private websocketService: WebsocketService,
    private apiService: ApiService,
    private stateService: StateService,
  ) {
    this.seoService.setTitle($localize`:@@a681a4e2011bb28157689dbaa387de0dd0aa0c11:Accelerator Dashboard`);
  }

  ngOnInit(): void {
    this.websocketService.want(['blocks', 'mempool-blocks', 'stats']);

    this.pendingAccelerations$ = interval(30000).pipe(
      startWith(true),
      switchMap(() => {
        return this.apiService.getAccelerations$();
      }),
      catchError((e) => {
        return of([]);
      }),
      share(),
    );

    this.accelerations$ = this.stateService.chainTip$.pipe(
      distinctUntilChanged(),
      switchMap((chainTip) => {
        return this.apiService.getAccelerationHistory$({ timeframe: '1m' });
      }),
      catchError((e) => {
        return of([]);
      }),
      share(),
    );

    this.minedAccelerations$ = this.accelerations$.pipe(
      map(accelerations => {
        return accelerations.filter(acc => ['mined', 'completed'].includes(acc.status))
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
          if (['mined', 'completed'].includes(acceleration.status) && acceleration.pools.includes(blockMap[acceleration.blockHash]?.extras.pool.id)) {
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
      return normalColors[feeLevelIndex] || normalColors[mempoolFeeColors.length - 1];
    }
  }
}
