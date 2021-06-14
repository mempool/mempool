import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { StateService } from 'src/app/services/state.service';
import { Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { MempoolInfo } from 'src/app/interfaces/websocket.interface';

interface MempoolBlocksData {
  blocks: number;
  size: number;
}

interface MempoolInfoData {
  memPoolInfo: MempoolInfo;
  vBytesPerSecond: number;
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
  vBytesPerSecondLimit = 1667;

  constructor(private stateService: StateService) {}

  ngOnInit() {
    this.mempoolInfoData$ = combineLatest([this.stateService.mempoolInfo$, this.stateService.vbytesPerSecond$]).pipe(
      map(([mempoolInfo, vbytesPerSecond]) => {
        const percent = Math.round(
          (Math.min(vbytesPerSecond, this.vBytesPerSecondLimit) / this.vBytesPerSecondLimit) * 100
        );

        let progressClass = 'bg-danger';
        if (percent <= 75) {
          progressClass = 'bg-success';
        } else if (percent <= 99) {
          progressClass = 'bg-warning';
        }

        return {
          memPoolInfo: mempoolInfo,
          vBytesPerSecond: vbytesPerSecond,
          progressWidth: percent + '%',
          progressClass: progressClass,
        };
      })
    );

    this.mempoolBlocksData$ = this.stateService.mempoolBlocks$.pipe(
      map(mempoolBlocks => {
        const size = mempoolBlocks.map(m => m.blockSize).reduce((a, b) => a + b, 0);
        const vsize = mempoolBlocks.map(m => m.blockVSize).reduce((a, b) => a + b, 0);

        return {
          size: size,
          blocks: Math.ceil(vsize / 1000000),
        };
      })
    );
  }
}
