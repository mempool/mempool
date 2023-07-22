import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { SeoService } from '../../services/seo.service';
import { WebsocketService } from '../../services/websocket.service';
import { Acceleration, BlockExtended } from '../../interfaces/node-api.interface';
import { StateService } from '../../services/state.service';
import { Observable, catchError, combineLatest, of, switchMap } from 'rxjs';
import { ApiService } from '../../services/api.service';

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

    this.blocks$ = combineLatest([
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
        })
      ),
      this.apiService.getAccelerationHistory$('24h').pipe(
        catchError((err) => {
          this.loadingBlocks = false;
          return of([]);
        })
      )
    ]).pipe(
      switchMap(([blocks, accelerations]) => {
        const accelerationsByBlock: { [ hash: string ]: Acceleration[] } = {};
        for (const acceleration of accelerations) {
          if (acceleration.mined && !accelerationsByBlock[acceleration.blockHash]) {
            accelerationsByBlock[acceleration.blockHash] = [];
          }
          if (acceleration.mined) {
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
}
