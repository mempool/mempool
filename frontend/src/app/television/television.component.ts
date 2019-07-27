import { Component, OnInit, LOCALE_ID, Inject } from '@angular/core';
import { ApiService } from '../services/api.service';
import { formatDate } from '@angular/common';
import { BytesPipe } from '../shared/pipes/bytes-pipe/bytes.pipe';

import * as Chartist from 'chartist';
import { IMempoolStats } from '../blockchain/interfaces';
import { MemPoolService } from '../services/mem-pool.service';

@Component({
  selector: 'app-television',
  templateUrl: './television.component.html',
  styleUrls: ['./television.component.scss']
})
export class TelevisionComponent implements OnInit {
  loading = true;

  mempoolStats: IMempoolStats[] = [];
  mempoolVsizeFeesData: any;
  mempoolVsizeFeesOptions: any;

  constructor(
    private apiService: ApiService,
    @Inject(LOCALE_ID) private locale: string,
    private bytesPipe: BytesPipe,
    private memPoolService: MemPoolService,
  ) { }

  ngOnInit() {
    this.apiService.sendWebSocket({'action': 'want', data: ['projected-blocks', 'live-2h-chart']});

    const labelInterpolationFnc = (value: any, index: any) => {
      return index % 6  === 0 ? formatDate(value, 'HH:mm', this.locale) : null;
    };

    this.mempoolVsizeFeesOptions = {
      showArea: true,
      showLine: false,
      fullWidth: true,
      showPoint: false,
      low: 0,
      axisX: {
        labelInterpolationFnc: labelInterpolationFnc,
        offset: 40
      },
      axisY: {
        labelInterpolationFnc: (value: number): any => {
          return this.bytesPipe.transform(value);
        },
        offset: 50
      },
      plugins: [
        Chartist.plugins.ctTargetLine({
          value: 1000000
        }),
      ]
    };

    this.apiService.list2HStatistics$()
      .subscribe((mempoolStats) => {
        this.mempoolStats = mempoolStats;
        this.handleNewMempoolData(this.mempoolStats.concat([]));
        this.loading = false;
      });

    this.memPoolService.live2Chart$
      .subscribe((mempoolStats) => {
        this.mempoolStats.unshift(mempoolStats);
        this.mempoolStats = this.mempoolStats.slice(0, this.mempoolStats.length - 1);
        this.handleNewMempoolData(this.mempoolStats.concat([]));
      });
  }

  handleNewMempoolData(mempoolStats: IMempoolStats[]) {
    mempoolStats.reverse();
    const labels = mempoolStats.map(stats => stats.added);

    const finalArrayVbyte = this.generateArray(mempoolStats);

    // Remove the 0-1 fee vbyte since it's practially empty
    finalArrayVbyte.shift();

    this.mempoolVsizeFeesData = {
      labels: labels,
      series: finalArrayVbyte
    };
  }

  generateArray(mempoolStats: IMempoolStats[]) {
    const logFees = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100, 125, 150, 175, 200,
      250, 300, 350, 400, 500, 600, 700, 800, 900, 1000, 1200, 1400, 1600, 1800, 2000];

    logFees.reverse();

    const finalArray: number[][] = [];
    let feesArray: number[] = [];

    logFees.forEach((fee) => {
      feesArray = [];
      mempoolStats.forEach((stats) => {
        // @ts-ignore
        const theFee = stats['vsize_' + fee];
        if (theFee) {
          feesArray.push(parseInt(theFee, 10));
        } else {
          feesArray.push(0);
        }
      });
      if (finalArray.length) {
        feesArray = feesArray.map((value, i) => value + finalArray[finalArray.length - 1][i]);
      }
      finalArray.push(feesArray);
    });
    finalArray.reverse();
    return finalArray;
  }

}
