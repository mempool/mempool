import { Component, OnInit } from '@angular/core';
import { StateService } from 'src/app/services/state.service';
import { MemPoolState } from 'src/app/interfaces/websocket.interface';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss']
})
export class FooterComponent implements OnInit {
  memPoolInfo: MemPoolState | undefined;
  mempoolBlocks = 0;
  progressWidth = '';
  progressClass: string;
  mempoolSize = 0;

  constructor(
    private stateService: StateService,
  ) { }

  ngOnInit() {
    this.stateService.mempoolStats$
      .subscribe((mempoolState) => {
        this.memPoolInfo = mempoolState;
        this.updateProgress();
      });

    this.stateService.mempoolBlocks$
      .subscribe((mempoolBlocks) => {
        if (!mempoolBlocks.length) { return; }
        const size = mempoolBlocks.map((m) => m.blockSize).reduce((a, b) => a + b);
        const vsize = mempoolBlocks.map((m) => m.blockVSize).reduce((a, b) => a + b);
        this.mempoolSize = size;
        this.mempoolBlocks = Math.ceil(vsize / 1000000);
      });
  }

  updateProgress() {
    if (!this.memPoolInfo) {
      return;
    }

    const vBytesPerSecondLimit = 1667;

    let vBytesPerSecond = this.memPoolInfo.vBytesPerSecond;
    if (vBytesPerSecond > 1667) {
      vBytesPerSecond = 1667;
    }

    const percent = Math.round((vBytesPerSecond / vBytesPerSecondLimit) * 100);
    this.progressWidth = percent + '%';

    if (percent <= 75) {
      this.progressClass = 'bg-success';
    } else if (percent <= 99) {
      this.progressClass = 'bg-warning';
    } else {
      this.progressClass = 'bg-danger';
    }
  }
}
