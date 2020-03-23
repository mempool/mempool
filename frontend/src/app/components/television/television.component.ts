import { Component, OnInit, LOCALE_ID, Inject, Renderer2 } from '@angular/core';
import { formatDate } from '@angular/common';
import { VbytesPipe } from '../../pipes/bytes-pipe/vbytes.pipe';

import * as Chartist from 'chartist';
import { WebsocketService } from 'src/app/services/websocket.service';
import { OptimizedMempoolStats } from '../../interfaces/node-api.interface';
import { StateService } from 'src/app/services/state.service';
import { ApiService } from 'src/app/services/api.service';
import { SeoService } from 'src/app/services/seo.service';

@Component({
  selector: 'app-television',
  templateUrl: './television.component.html',
  styleUrls: ['./television.component.scss']
})
export class TelevisionComponent implements OnInit {
  loading = true;

  mempoolStats: OptimizedMempoolStats[] = [];
  mempoolVsizeFeesData: any;
  mempoolVsizeFeesOptions: any;

  constructor(
    private websocketService: WebsocketService,
    @Inject(LOCALE_ID) private locale: string,
    private vbytesPipe: VbytesPipe,
    private apiService: ApiService,
    private stateService: StateService,
    private seoService: SeoService,
  ) { }

  ngOnInit() {
    this.seoService.setTitle('TV view');
    this.websocketService.want(['blocks', 'live-2h-chart', 'mempool-blocks']);

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
          return this.vbytesPipe.transform(value, 2);
        },
        offset: 160
      },
      plugins: [
        Chartist.plugins.ctTargetLine({
          value: 1000000
        }),
        Chartist.plugins.legend({
          legendNames: [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100, 125, 150, 175, 200,
            250, 300, 350, 400].map((sats, i, arr) => {
              if (sats === 400) {
               return '350+';
              }
              if (i === 0) {
                return '1 sat/vbyte';
              }
              return arr[i - 1] + ' - ' + sats;
            })
        })
      ]
    };

    this.apiService.list2HStatistics$()
      .subscribe((mempoolStats) => {
        this.mempoolStats = mempoolStats;
        this.handleNewMempoolData(this.mempoolStats.concat([]));
        this.loading = false;
      });

    this.stateService.live2Chart$
      .subscribe((mempoolStats) => {
        this.mempoolStats.unshift(mempoolStats);
        this.mempoolStats = this.mempoolStats.slice(0, this.mempoolStats.length - 1);
        this.handleNewMempoolData(this.mempoolStats.concat([]));
      });
  }

  handleNewMempoolData(mempoolStats: OptimizedMempoolStats[]) {
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

  generateArray(mempoolStats: OptimizedMempoolStats[]) {
    const finalArray: number[][] = [];
    let feesArray: number[] = [];

    for (let index = 37; index > -1; index--) {
      feesArray = [];
      mempoolStats.forEach((stats) => {
        const theFee = stats.vsizes[index].toString();
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
    }
    finalArray.reverse();
    return finalArray;
  }

}
