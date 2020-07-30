import { Component, Input, OnChanges, ChangeDetectionStrategy } from '@angular/core';
import * as Chartist from 'chartist';

@Component({
  selector: 'app-fee-distribution-graph',
  templateUrl: './fee-distribution-graph.component.html',
  styleUrls: ['./fee-distribution-graph.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeeDistributionGraphComponent implements OnChanges {
  @Input() feeRange;

  mempoolVsizeFeesData: any;
  mempoolVsizeFeesOptions: any;

  feeLevels = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100, 125, 150, 175, 200,
  250, 300, 350, 400, 500];

  constructor(
  ) { }

  ngOnChanges() {
    this.mempoolVsizeFeesOptions = {
      showArea: true,
      showLine: true,
      fullWidth: true,
      showPoint: true,
      low: 0,
      axisY: {
        showLabel: false,
        offset: 0
      },
      axisX: {
        showGrid: true,
        showLabel: false,
        offset: 0
      },
      plugins: [
        Chartist.plugins.ctPointLabels({
          textAnchor: 'middle',
          labelInterpolationFnc: (value) => Math.round(value)
        })
      ]
    };

    const fees = this.feeRange;
    const series = [];

    for (let i = 0; i < this.feeLevels.length; i++) {
      let total = 0;
      // for (let j = 0; j < fees.length; j++) {
      for (const fee of fees) {
        if (i === this.feeLevels.length - 1) {
          if (fee >= this.feeLevels[i]) {
            total += 1;
          }
        } else  if (fee >= this.feeLevels[i] && fee < this.feeLevels[i + 1]) {
          total += 1;
        }
      }
      series.push(total);
    }

    this.mempoolVsizeFeesData = {
      series: [fees],
      labels: fees.map((d, i) => i)
    };
  }

}
