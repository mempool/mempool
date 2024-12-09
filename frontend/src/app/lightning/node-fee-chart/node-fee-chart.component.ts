import { Component, Inject, Input, LOCALE_ID, OnInit, HostBinding } from '@angular/core';
import { EChartsOption } from '@app/graphs/echarts';
import { switchMap } from 'rxjs/operators';
import { download } from '@app/shared/graphs.utils';
import { LightningApiService } from '@app/lightning/lightning-api.service';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { AmountShortenerPipe } from '@app/shared/pipes/amount-shortener.pipe';
import { StateService } from '@app/services/state.service';

@Component({
  selector: 'app-node-fee-chart',
  templateUrl: './node-fee-chart.component.html',
  styleUrls: ['./node-fee-chart.component.scss'],
  styles: [`
    .loadingGraphs {
      position: absolute;
      top: 50%;
      left: calc(50% - 15px);
      z-index: 99;
    }
  `],
})
export class NodeFeeChartComponent implements OnInit {
  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
  };

  @HostBinding('attr.dir') dir = 'ltr';

  isLoading = true;
  chartInstance: any = undefined;

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private lightningApiService: LightningApiService,
    public stateService: StateService,
    private activatedRoute: ActivatedRoute,
    private amountShortenerPipe: AmountShortenerPipe,
  ) {
  }

  ngOnInit(): void {

    this.activatedRoute.paramMap
      .pipe(
        switchMap((params: ParamMap) => {
          this.isLoading = true;
          return this.lightningApiService.getNodeFeeHistogram$(params.get('public_key'));
        }),
      ).subscribe((data) => {
        if (data && data.incoming && data.outgoing) {
          const outgoingHistogram = this.bucketsToHistogram(data.outgoing);
          const incomingHistogram = this.bucketsToHistogram(data.incoming);
          this.prepareChartOptions(outgoingHistogram, incomingHistogram);
        }
        this.isLoading = false;
      });
  }

  bucketsToHistogram(buckets): { label: string, count: number, capacity: number}[] {
    const histogram = [];
    let increment = 1;
    let lower = -increment;
    let upper = 0;

    let nullBucket;
    if (buckets.length && buckets[0] && buckets[0].bucket == null) {
      nullBucket = buckets.shift();
    }

    while (upper <= 5000) {
      let bucket;
      if (buckets.length && buckets[0] && upper >= Number(buckets[0].bucket)) {
        bucket = buckets.shift();
      }
      histogram.push({
        label: upper === 0 ? '0 ppm' : `${lower} - ${upper} ppm`,
        count: Number(bucket?.count || 0) + (upper === 0 ? Number(nullBucket?.count || 0) : 0),
        capacity: Number(bucket?.capacity || 0) + (upper === 0 ? Number(nullBucket?.capacity || 0) : 0),
      });

      if (upper >= increment * 10) {
        increment *= 10;
        lower = increment;
        upper = increment + increment;
      } else {
        lower += increment;
        upper += increment;
      }
    }
    const rest = buckets.reduce((acc, bucket) => {
      acc.count += Number(bucket.count);
      acc.capacity += Number(bucket.capacity);
      return acc;
    }, { count: 0, capacity: 0 });
    histogram.push({
      label: `5000+ ppm`,
      count: rest.count,
      capacity: rest.capacity,
    });
    return histogram;
  }

  prepareChartOptions(outgoingData, incomingData): void {
    let sum = outgoingData.reduce((accumulator, object) => {
      return accumulator + object.count;
    }, 0);
    sum += incomingData.reduce((accumulator, object) => {
      return accumulator + object.count;
    }, 0);

    let title: object;
    if (sum === 0) {
      title = {
        textStyle: {
          color: 'grey',
          fontSize: 15
        },
        text: $localize`No data to display yet. Try again later.`,
        left: 'center',
        top: 'center'
      };
    }

    this.chartOptions = {
      title: sum === 0 ? title : undefined,
      animation: false,
      grid: {
        top: 30,
        bottom: 20,
        right: 20,
        left: 65,
      },
      tooltip: {
        show: !this.isMobile(),
        trigger: 'axis',
        axisPointer: {
          type: 'line'
        },
        backgroundColor: 'rgba(17, 19, 31, 1)',
        borderRadius: 4,
        shadowColor: 'rgba(0, 0, 0, 0.5)',
        textStyle: {
          color: 'var(--tooltip-grey)',
          align: 'left',
        },
        borderColor: '#000',
        formatter: (ticks): string => {
          return `
            <b style="color: white; margin-left: 2px">${ticks[0].data.label}</b><br>
            <br>
            <b style="color: white; margin-left: 2px">${ticks[0].marker} Outgoing</b><br>
            <span>Capacity: ${this.amountShortenerPipe.transform(ticks[0].data.capacity, 2, undefined, true)} sats</span><br>
            <span>Channels: ${ticks[0].data.count}</span><br>
            <br>
            <b style="color: white; margin-left: 2px">${ticks[1].marker} Incoming</b><br>
            <span>Capacity: ${this.amountShortenerPipe.transform(ticks[1].data.capacity, 2, undefined, true)} sats</span><br>
            <span>Channels: ${ticks[1].data.count}</span><br>
          `;
        }
      },
      xAxis: sum === 0 ? undefined : {
        type: 'category',
        axisLine: { onZero: true },
        axisLabel: {
          align: 'center',
          fontSize: 11,
          lineHeight: 12,
          hideOverlap: true,
          padding: [0, 5],
        },
        data: outgoingData.map(bucket => bucket.label)
      },
      legend: sum === 0 ? undefined : {
        padding: 10,
        data: [
          {
            name: $localize`Outgoing Fees`,
            inactiveColor: 'rgb(110, 112, 121)',
            textStyle: {
              color: 'white',
            },
            icon: 'roundRect',
          },
          {
            name: $localize`Incoming Fees`,
            inactiveColor: 'rgb(110, 112, 121)',
            textStyle: {
              color: 'white',
            },
            icon: 'roundRect',
          },
        ],
      },
      yAxis: sum === 0 ? undefined : [
        {
          type: 'value',
          axisLabel: {
            color: 'rgb(110, 112, 121)',
            formatter: (val) => {
              return `${this.amountShortenerPipe.transform(Math.abs(val), 2, undefined, true)} sats`;
            }
          },
          splitLine: {
            lineStyle: {
              type: 'dotted',
              color: 'var(--transparent-fg)',
              opacity: 0.25,
            }
          },
        },
      ],
      series: sum === 0 ? undefined : [
        {
          zlevel: 0,
          name: $localize`Outgoing Fees`,
          data: outgoingData.map(bucket => ({
            value: bucket.capacity,
            label: bucket.label,
            capacity: bucket.capacity,
            count: bucket.count,
          })),
          type: 'bar',
          barWidth: '90%',
          barMaxWidth: 50,
          stack: 'fees',
        },
        {
          zlevel: 0,
          name: $localize`Incoming Fees`,
          data: incomingData.map(bucket => ({
            value: -bucket.capacity,
            label: bucket.label,
            capacity: bucket.capacity,
            count: bucket.count,
          })),
          type: 'bar',
          barWidth: '90%',
          barMaxWidth: 50,
          stack: 'fees',
        },
      ],
    };
  }

  onChartInit(ec) {
    if (this.chartInstance !== undefined) {
      return;
    }

    this.chartInstance = ec;
  }

  isMobile() {
    return (window.innerWidth <= 767.98);
  }
}
