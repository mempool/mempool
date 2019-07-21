import { Component, OnInit } from '@angular/core';
import { MemPoolService, MemPoolState } from '../services/mem-pool.service';

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

  constructor(
    private memPoolService: MemPoolService
  ) { }

  ngOnInit() {
    this.memPoolService.loaderSubject
      .subscribe((mempoolState) => {
        this.memPoolInfo = mempoolState;
        this.updateProgress();
      });
    this.memPoolService.mempoolWeight
      .subscribe((mempoolWeight) => {
        this.mempoolBlocks = Math.ceil(mempoolWeight / 4000000);
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
