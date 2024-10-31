import { Component, OnInit, ChangeDetectionStrategy, Input } from '@angular/core';
import { StateService } from '@app/services/state.service';
import { Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { MempoolInfo } from '@interfaces/websocket.interface';

interface MempoolBlocksData {
  blocks: number;
  size: number;
}

interface MempoolInfoData {
  memPoolInfo: MempoolInfo;
  vBytesPerSecond: number;
  progressWidth: string;
  progressColor: string;
}

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FooterComponent implements OnInit {
  @Input() inline = false;

  mempoolBlocksData$: Observable<MempoolBlocksData>;
  mempoolInfoData$: Observable<MempoolInfoData>;
  vBytesPerSecondLimit = 1667;
  isLoadingWebSocket$: Observable<boolean>;
  mempoolLoadingStatus$: Observable<number>;

  constructor(
    private stateService: StateService,
  ) { }

  ngOnInit() {
    this.isLoadingWebSocket$ = this.stateService.isLoadingWebSocket$;
    this.mempoolLoadingStatus$ = this.stateService.loadingIndicators$
      .pipe(
        map((indicators) => indicators.mempool !== undefined ? indicators.mempool : 100)
      );

      this.mempoolInfoData$ = combineLatest([
        this.stateService.mempoolInfo$,
        this.stateService.vbytesPerSecond$
      ])
      .pipe(
        map(([mempoolInfo, vbytesPerSecond]) => {
          const percent = Math.round((Math.min(vbytesPerSecond, this.vBytesPerSecondLimit) / this.vBytesPerSecondLimit) * 100);
  
          let progressColor = '#7CB342';
          if (vbytesPerSecond > 1667) {
            progressColor = '#FDD835';
          }
          if (vbytesPerSecond > 2000) {
            progressColor = '#FFB300';
          }
          if (vbytesPerSecond > 2500) {
            progressColor = '#FB8C00';
          }
          if (vbytesPerSecond > 3000) {
            progressColor = '#F4511E';
          }
          if (vbytesPerSecond > 3500) {
            progressColor = '#D81B60';
          }
  
          const mempoolSizePercentage = (mempoolInfo.usage / mempoolInfo.maxmempool * 100);
          let mempoolSizeProgress = 'bg-danger';
          if (mempoolSizePercentage <= 50) {
            mempoolSizeProgress = 'bg-success';
          } else if (mempoolSizePercentage <= 75) {
            mempoolSizeProgress = 'bg-warning';
          }
  
          return {
            memPoolInfo: mempoolInfo,
            vBytesPerSecond: vbytesPerSecond,
            progressWidth: percent + '%',
            progressColor: progressColor,
            mempoolSizeProgress: mempoolSizeProgress,
          };
        })
      );

    this.mempoolBlocksData$ = this.stateService.mempoolBlocks$
      .pipe(
        map((mempoolBlocks) => {
          const size = mempoolBlocks.map((m) => m.blockSize).reduce((a, b) => a + b, 0);
          const vsize = mempoolBlocks.map((m) => m.blockVSize).reduce((a, b) => a + b, 0);

          return {
            size: size,
            blocks: Math.ceil(vsize / this.stateService.blockVSize)
          };
        })
      );
  }
}
