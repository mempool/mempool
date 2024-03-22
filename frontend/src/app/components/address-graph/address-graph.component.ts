import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, Input, LOCALE_ID, OnChanges, SimpleChanges } from '@angular/core';
import { echarts, EChartsOption } from '../../graphs/echarts';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ChainStats } from '../../interfaces/electrs.interface';
import { ElectrsApiService } from '../../services/electrs-api.service';
import { AmountShortenerPipe } from '../../shared/pipes/amount-shortener.pipe';
import { Router } from '@angular/router';

@Component({
  selector: 'app-address-graph',
  templateUrl: './address-graph.component.html',
  styleUrls: ['./address-graph.component.scss'],
  styles: [`
    .loadingGraphs {
      position: absolute;
      top: 50%;
      left: calc(50% - 15px);
      z-index: 100;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddressGraphComponent implements OnChanges {
  @Input() address: string;
  @Input() isPubkey: boolean = false;
  @Input() stats: ChainStats;
  @Input() right: number | string = 10;
  @Input() left: number | string = 70;

  data: any[] = [];
  hoverData: any[] = [];

  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
  };

  error: any;
  isLoading = true;
  chartInstance: any = undefined;

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private electrsApiService: ElectrsApiService,
    private router: Router,
    private amountShortenerPipe: AmountShortenerPipe,
    private cd: ChangeDetectorRef,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    this.isLoading = true;
    (this.isPubkey
      ? this.electrsApiService.getScriptHashSummary$((this.address.length === 66 ? '21' : '41') + this.address + 'ac')
      : this.electrsApiService.getAddressSummary$(this.address)).pipe(
      catchError(e => {
        this.error = `Failed to fetch address balance history: ${e?.status || ''} ${e?.statusText || 'unknown error'}`;
        return of(null);
      }),
    ).subscribe(addressSummary => {
      if (addressSummary) {
        this.error = null;
        this.prepareChartOptions(addressSummary);
      }
      this.isLoading = false;
      this.cd.markForCheck();
    });
  }

  prepareChartOptions(summary): void {
    let total = (this.stats.funded_txo_sum - this.stats.spent_txo_sum); // + (summary[0]?.value || 0);
    this.data = summary.map(d => {
      const balance = total;
      total -= d.value;
      return [d.time * 1000, balance, d];
    }).reverse();

    const maxValue = this.data.reduce((acc, d) => Math.max(acc, Math.abs(d[1])), 0);

    this.chartOptions = {
      color: [
        new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#FDD835' },
          { offset: 1, color: '#FB8C00' },
        ]),
      ],
      animation: false,
      grid: {
        top: 20,
        bottom: 20,
        right: this.right,
        left: this.left,
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
          color: '#b1b1b1',
          align: 'left',
        },
        borderColor: '#000',
        formatter: function (data): string {
          const header = data.length === 1
            ? `${data[0].data[2].txid.slice(0, 6)}...${data[0].data[2].txid.slice(-6)}`
            : `${data.length} transactions`;
          const date = new Date(data[0].data[0]).toLocaleTimeString(this.locale, { year: 'numeric', month: 'short', day: 'numeric' });
          const val = data.reduce((total, d) => total + d.data[2].value, 0);
          const color = val === 0 ? '' : (val > 0 ? '#1a9436' : '#dc3545');
          const symbol = val > 0 ? '+' : '';
          return `
            <div>
              <span><b>${header}</b></span>
              <div style="text-align: right;">
                <span style="color: ${color}">${symbol} ${(val / 100_000_000).toFixed(8)} BTC</span><br>
                <span>${(data[0].data[1] / 100_000_000).toFixed(8)} BTC</span>
              </div>
              <span>${date}</span>
            </div>
          `; 
        }.bind(this)
      },
      xAxis: {
        type: 'time',
        splitNumber: this.isMobile() ? 5 : 10,
        axisLabel: {
          hideOverlap: true,
        }
      },
      yAxis: [
        {
          type: 'value',
          position: 'left',
          axisLabel: {
            color: 'rgb(110, 112, 121)',
            formatter: (val): string => {
              if (maxValue > 1_000_000_000) {
                return `${this.amountShortenerPipe.transform(Math.round(val / 100_000_000), 0)} BTC`;
              } else if (maxValue > 100_000_000) {
                return `${(val / 100_000_000).toFixed(1)} BTC`;
              } else if (maxValue > 10_000_000) {
                return `${(val / 100_000_000).toFixed(2)} BTC`;
              } else if (maxValue > 1_000_000) {
                return `${(val / 100_000_000).toFixed(3)} BTC`;
              } else {
                return `${this.amountShortenerPipe.transform(val, 0)} sats`;
              }
            }
          },
          splitLine: {
            show: false,
          },
        },
      ],
      series: [
        {
          name: $localize`Balance:Balance`,
          showSymbol: false,
          symbol: 'circle',
          symbolSize: 8,
          data: this.data,
          areaStyle: {
            opacity: 0.5,
          },
          triggerLineEvent: true,
          type: 'line',
          smooth: false,
          step: 'end'
        }
      ],
    };
  }

  onChartClick(e) {
    if (this.hoverData?.length && this.hoverData[0]?.[2]?.txid) {
      this.router.navigate(['/tx/', this.hoverData[0][2].txid]);
    }
  }

  onTooltip(e) {
    this.hoverData = (e?.dataByCoordSys?.[0]?.dataByAxis?.[0]?.seriesDataIndices || []).map(indices => this.data[indices.dataIndex]);
  }

  onChartInit(ec) {
    this.chartInstance = ec;
    this.chartInstance.on('showTip', this.onTooltip.bind(this));
    this.chartInstance.on('click', 'series', this.onChartClick.bind(this));
  }

  isMobile() {
    return (window.innerWidth <= 767.98);
  }
}
