import { Component, OnInit, Input, Inject, LOCALE_ID, ChangeDetectionStrategy, OnChanges } from '@angular/core';
import { formatDate } from '@angular/common';
import { VbytesPipe } from 'src/app/shared/pipes/bytes-pipe/vbytes.pipe';
import * as Chartist from '@mempool/chartist';
import { OptimizedMempoolStats } from 'src/app/interfaces/node-api.interface';
import { StateService } from 'src/app/services/state.service';
import { StorageService } from 'src/app/services/storage.service';

@Component({
  selector: 'app-mempool-graph',
  templateUrl: './mempool-graph.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MempoolGraphComponent implements OnInit, OnChanges {
  @Input() data;
  @Input() dateSpan = '2h';
  @Input() showLegend = true;
  @Input() offsetX = 40;
  @Input() small = false;

  mempoolVsizeFeesOptions: any;
  mempoolVsizeFeesData: any;

  isMobile = window.innerWidth <= 767.98;
  inverted: boolean;

  constructor(
    private vbytesPipe: VbytesPipe,
    private stateService: StateService,
    @Inject(LOCALE_ID) private locale: string,
    private storageService: StorageService
  ) {}

  ngOnInit(): void {
    let labelHops = !this.showLegend ? 48 : 24;
    if (this.small) {
      labelHops = labelHops / 2;
    }

    if (this.isMobile) {
      labelHops = 96;
    }

    const labelInterpolationFnc = (value: any, index: any) => {
      switch (this.dateSpan) {
        case '2h':
        case '24h':
          value = formatDate(value, 'HH:mm', this.locale);
          break;
        case '1w':
          value = formatDate(value, 'dd/MM HH:mm', this.locale);
          break;
        case '1m':
        case '3m':
        case '6m':
        case '1y':
          value = formatDate(value, 'dd/MM', this.locale);
      }
      return index % labelHops === 0 ? value : null;
    };

    this.mempoolVsizeFeesOptions = {
      showArea: true,
      showLine: false,
      fullWidth: true,
      showPoint: false,
      stackedLine: !this.inverted,
      low: 0,
      axisX: {
        labelInterpolationFnc: labelInterpolationFnc,
        offset: this.offsetX,
      },
      axisY: {
        labelInterpolationFnc: (value: number): any => this.vbytesPipe.transform(value, 2, 'vB', 'MvB', true),
        offset: this.showLegend ? 160 : 60,
      },
      plugins: this.inverted ? [Chartist.plugins.ctTargetLine({ value: 1000000 })] : [],
    };

    if (this.showLegend) {
      const legendNames: string[] = [
        1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100, 125, 150, 175, 200, 250, 300, 350, 400,
      ].map((sat, i, arr) => {
        if (sat === 400) {
          return '350+';
        }
        if (i === 0) {
          return '0 - 1';
        }
        return arr[i - 1] + ' - ' + sat;
      });
      // Only Liquid has lower than 1 sat/vb transactions
      if (this.stateService.network !== 'liquid') {
        legendNames.shift();
      }
      this.mempoolVsizeFeesOptions.plugins.push(Chartist.plugins.legend({ legendNames: legendNames }));
    }
  }

  ngOnChanges() {
    this.inverted = this.storageService.getValue('inverted-graph') === 'true';
    this.mempoolVsizeFeesData = this.handleNewMempoolData(this.data.concat([]));
  }

  handleNewMempoolData(mempoolStats: OptimizedMempoolStats[]) {
    mempoolStats.reverse();
    const labels = mempoolStats.map(stats => stats.added);

    const finalArrayVbyte = this.generateArray(mempoolStats);

    // Only Liquid has lower than 1 sat/vb transactions
    if (this.stateService.network !== 'liquid') {
      finalArrayVbyte.shift();
    }

    return {
      labels: labels,
      series: finalArrayVbyte,
    };
  }

  generateArray(mempoolStats: OptimizedMempoolStats[]) {
    const finalArray: number[][] = [];
    let feesArray: number[] = [];

    for (let index = 37; index > -1; index--) {
      feesArray = [];
      mempoolStats.forEach(stats => {
        const theFee = stats.vsizes[index].toString();
        if (theFee) {
          feesArray.push(parseInt(theFee, 10));
        } else {
          feesArray.push(0);
        }
      });
      if (this.inverted && finalArray.length) {
        feesArray = feesArray.map((value, i) => value + finalArray[finalArray.length - 1][i]);
      }
      finalArray.push(feesArray);
    }
    finalArray.reverse();
    return finalArray;
  }
}
