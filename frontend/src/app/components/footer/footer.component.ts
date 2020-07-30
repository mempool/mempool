import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { StateService } from 'src/app/services/state.service';
import { MemPoolState } from 'src/app/interfaces/websocket.interface';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

interface MempoolBlocksData {
  blocks: number;
  size: number;
}

interface MempoolInfoData {
  memPoolInfo: MemPoolState;
  progressWidth: string;
  progressClass: string;
}

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FooterComponent implements OnInit {
  mempoolBlocksData$: Observable<MempoolBlocksData>;
  mempoolInfoData$: Observable<MempoolInfoData>;

  constructor(
    private stateService: StateService,
  ) { }

  ngOnInit() {
    this.mempoolInfoData$ = this.stateService.mempoolStats$
      .pipe(
        map((mempoolState) => {
          const vBytesPerSecondLimit = 1667;
          let vBytesPerSecond = mempoolState.vBytesPerSecond;
          if (vBytesPerSecond > 1667) {
            vBytesPerSecond = 1667;
          }

          const percent = Math.round((vBytesPerSecond / vBytesPerSecondLimit) * 100);

          let progressClass = 'bg-danger';
          if (percent <= 75) {
            progressClass = 'bg-success';
          } else if (percent <= 99) {
            progressClass = 'bg-warning';
          }

          return {
            memPoolInfo: mempoolState,
            progressWidth: percent + '%',
            progressClass: progressClass,
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
            blocks: Math.ceil(vsize / 1000000)
          };
        })
      );
  }
}
