import { Component, OnInit, Input } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import * as Chartist from 'chartist';
import { ApiService } from '../services/api.service';

@Component({
  selector: 'app-fee-distribution-graph',
  templateUrl: './fee-distribution-graph.component.html',
  styleUrls: ['./fee-distribution-graph.component.scss']
})
export class FeeDistributionGraphComponent implements OnInit {
  @Input() projectedBlockIndex: number;
  @Input() blockHeight: number;

  mempoolVsizeFeesData: any;
  mempoolVsizeFeesOptions: any;

  mempoolVsizeFeesPieData: any;
  mempoolVsizeFeesPieOptions: any;

  feeLevels = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100, 125, 150, 175, 200,
  250, 300, 350, 400, 500];

  radioGroupForm: FormGroup;

  constructor(
    private formBuilder: FormBuilder,
    private apiService: ApiService,
  ) { }

  ngOnInit() {
    this.radioGroupForm = this.formBuilder.group({
      model: ['line'],
    });

    this.mempoolVsizeFeesOptions = {
      showArea: false,
      showLine: false,
      fullWidth: false,
      showPoint: false,
      low: 0,
      axisX: {
        position: 'start',
        showLabel: false,
        offset: 0,
        showGrid: false,
      },
      axisY: {
        position: 'end',
        scaleMinSpace: 40,
        showGrid: false,
      },
      plugins: [
        Chartist.plugins.tooltip({
          tooltipOffset: {
            x: 15,
            y: 250
          },
          transformTooltipTextFnc: (value: number): any => {
            return Math.ceil(value) + ' sat/vB';
          },
          anchorToPoint: false,
        })
      ]
    };

    this.mempoolVsizeFeesPieOptions = {
      showLabel: false,
      plugins: [
        Chartist.plugins.tooltip({
          tooltipOffset: {
            x: 15,
            y: 250
          },
          transformTooltipTextFnc: (value: string, seriesName: string): any => {
            const index = parseInt(seriesName.split(' ')[2].split('-')[1], 10);
            const intValue = parseInt(value, 10);
            const result = Math.ceil(intValue) + ' tx @ ' + this.feeLevels[index] +
              (this.feeLevels[index + 1] ? '-' + this.feeLevels[index + 1] : '+' ) + ' sat/vB';

            return result;
          },
          anchorToPoint: false,
        })
      ]
    };

    let sub;
    if (this.blockHeight) {
      sub = this.apiService.listTransactionsForBlock$(this.blockHeight);
    } else {
      sub = this.apiService.listTransactionsForProjectedBlock$(this.projectedBlockIndex);
    }

    sub.subscribe((data) => {
        const fees = data.map((tx) => tx.fpv);

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

        this.mempoolVsizeFeesPieData = {
          series: series.map((d, index: number) => {
            return {
              value: d,
              className: 'ct-series-' + Chartist.alphaNumerate(index) + ' index-' + index
            };
          }),
          labels: data.map((x, i) => i),
        };

        this.mempoolVsizeFeesData = {
          labels: data.map((x, i) => i),
          series: [fees]
        };
      });
  }

}
