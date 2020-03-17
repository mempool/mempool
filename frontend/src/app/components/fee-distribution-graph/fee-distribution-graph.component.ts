import { Component, OnInit, Input, OnChanges } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import * as Chartist from 'chartist';
import { VbytesPipe } from 'src/app/pipes/bytes-pipe/vbytes.pipe';

@Component({
  selector: 'app-fee-distribution-graph',
  templateUrl: './fee-distribution-graph.component.html',
  styleUrls: ['./fee-distribution-graph.component.scss']
})
export class FeeDistributionGraphComponent implements OnChanges {
  @Input() feeRange;

  mempoolVsizeFeesData: any;
  mempoolVsizeFeesOptions: any;

  mempoolVsizeFeesPieData: any;
  mempoolVsizeFeesPieOptions: any;

  feeLevels = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100, 125, 150, 175, 200,
  250, 300, 350, 400, 500];

  radioGroupForm: FormGroup;

  constructor(
    private vbytesPipe: VbytesPipe,
  ) { }

  ngOnChanges() {
    this.mempoolVsizeFeesOptions = {
      showArea: true,
      showLine: true,
      fullWidth: true,
      showPoint: false,
      low: 0,
      axisY: {
        labelInterpolationFnc: (value: number): any => {
          return this.vbytesPipe.transform(value, 2);
        },
        offset: 60
      },
    };

    const fees = this.feeRange;
    const series = [];

    for (let i = 0; i < this.feeLevels.length; i++) {
      let total = 0;
      for (let j = 0; j < fees.length; j++) {
        if (i === this.feeLevels.length - 1) {
          if (fees[j] >= this.feeLevels[i]) {
            total += 1;
          }
        } else  if (fees[j] >= this.feeLevels[i] && fees[j] < this.feeLevels[i + 1]) {
          total += 1;
        }
      }
      series.push(total);
    }

    this.mempoolVsizeFeesData = {
      series: [fees]
    };
  }

}
