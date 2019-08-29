import { Component, OnInit, LOCALE_ID, Inject } from '@angular/core';
import { ApiService } from '../services/api.service';
import { formatDate } from '@angular/common';
import { BytesPipe } from '../shared/pipes/bytes-pipe/bytes.pipe';

import * as Chartist from 'chartist';
import { FormGroup, FormBuilder } from '@angular/forms';
import { IMempoolStats } from '../blockchain/interfaces';
import { Subject, of, merge} from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { ActivatedRoute } from '@angular/router';
import { MemPoolService } from '../services/mem-pool.service';

@Component({
  selector: 'app-statistics',
  templateUrl: './statistics.component.html',
  styleUrls: ['./statistics.component.scss']
})
export class StatisticsComponent implements OnInit {
  loading = true;
  spinnerLoading = false;

  mempoolStats: IMempoolStats[] = [];

  mempoolVsizeFeesData: any;
  mempoolUnconfirmedTransactionsData: any;
  mempoolTransactionsWeightPerSecondData: any;

  mempoolVsizeFeesOptions: any;
  transactionsWeightPerSecondOptions: any;

  radioGroupForm: FormGroup;

  constructor(
    private apiService: ApiService,
    @Inject(LOCALE_ID) private locale: string,
    private bytesPipe: BytesPipe,
    private formBuilder: FormBuilder,
    private route: ActivatedRoute,
    private memPoolService: MemPoolService,
  ) {
    this.radioGroupForm = this.formBuilder.group({
      'dateSpan': '2h'
    });
   }

  ngOnInit() {
    const labelInterpolationFnc = (value: any, index: any) => {
      const nr = 6;

      switch (this.radioGroupForm.controls['dateSpan'].value) {
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
          value = formatDate(value, 'dd/MM', this.locale);
      }

      return index % nr  === 0 ? value : null;
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
        offset: 160
      },
      plugins: [
        Chartist.plugins.ctTargetLine({
          value: 1000000
        }),
        Chartist.plugins.legend({
          legendNames: [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100, 125, 150, 175, 200,
            250, 300, 350, 400, 500, 600].map((sats, i, arr) => {
              if (sats === 600) {
               return '500+';
              }
              if (i === 0) {
                return '1 sat/vbyte';
              }
              return arr[i - 1] + ' - ' + sats;
            })
        })
      ]
    };

    this.transactionsWeightPerSecondOptions = {
      showArea: false,
      showLine: true,
      showPoint: false,
      low: 0,
      axisY: {
        offset: 40
      },
      axisX: {
        labelInterpolationFnc: labelInterpolationFnc
      },
      plugins: [
        Chartist.plugins.ctTargetLine({
          value: 1667
        }),
      ]
    };

    this.route
      .fragment
      .subscribe((fragment) => {
        if (['2h', '24h', '1w', '1m', '3m', '6m'].indexOf(fragment) > -1) {
          this.radioGroupForm.controls['dateSpan'].setValue(fragment, { emitEvent: false });
        }
      });

    merge(
      of(''),
      this.radioGroupForm.controls['dateSpan'].valueChanges
        .pipe(
          tap(() => {
            this.mempoolStats = [];
          })
        )
    )
    .pipe(
      switchMap(() => {
        this.spinnerLoading = true;
        if (this.radioGroupForm.controls['dateSpan'].value === '2h') {
          this.apiService.webSocketWant(['live-2h-chart']);
          return this.apiService.list2HStatistics$();
        }
        this.apiService.webSocketWant([]);
        if (this.radioGroupForm.controls['dateSpan'].value === '24h') {
          return this.apiService.list24HStatistics$();
        }
        if (this.radioGroupForm.controls['dateSpan'].value === '1w') {
          return this.apiService.list1WStatistics$();
        }
        if (this.radioGroupForm.controls['dateSpan'].value === '1m') {
          return this.apiService.list1MStatistics$();
        }
        if (this.radioGroupForm.controls['dateSpan'].value === '3m') {
          return this.apiService.list3MStatistics$();
        }
        return this.apiService.list6MStatistics$();
      })
    )
    .subscribe((mempoolStats) => {
      this.mempoolStats = mempoolStats;
      this.handleNewMempoolData(this.mempoolStats.concat([]));
      this.loading = false;
      this.spinnerLoading = false;
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

    this.mempoolTransactionsWeightPerSecondData = {
      labels: labels,
      series: [mempoolStats.map((stats) => stats.vbytes_per_second)],
    };

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
