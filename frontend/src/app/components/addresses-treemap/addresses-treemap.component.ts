import { ChangeDetectionStrategy, Component, Inject, Input, LOCALE_ID, NgZone, OnChanges } from '@angular/core';
import { Router } from '@angular/router';
import { EChartsOption, TreemapSeriesOption } from '@app/graphs/echarts';
import { lerpColor } from '@app/shared/graphs.utils';
import { AmountShortenerPipe } from '@app/shared/pipes/amount-shortener.pipe';
import { LightningApiService } from '@app/lightning/lightning-api.service';
import { RelativeUrlPipe } from '@app/shared/pipes/relative-url/relative-url.pipe';
import { StateService } from '@app/services/state.service';
import { Address } from '@interfaces/electrs.interface';
import { formatNumber } from '@angular/common';

@Component({
  selector: 'app-addresses-treemap',
  templateUrl: './addresses-treemap.component.html',
  styleUrls: ['./addresses-treemap.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddressesTreemap implements OnChanges {
  @Input() addresses: Address[];
  @Input() isLoading: boolean = false;

  chartInstance: any;
  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
  };

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private lightningApiService: LightningApiService,
    private amountShortenerPipe: AmountShortenerPipe,
    private zone: NgZone,
    private router: Router,
    public stateService: StateService,
  ) {}

  ngOnChanges(): void {
    this.prepareChartOptions();
  }

  prepareChartOptions(): void {
    const data = this.addresses.map(address => ({
      address: address.address,
      value: address.chain_stats.funded_txo_sum - address.chain_stats.spent_txo_sum,
      stats: address.chain_stats,
    }));
    // only consider visible items for the color gradient
    const totalValue = data.reduce((acc, address) => acc + address.value, 0);
    const maxTxs = data.filter(address => address.value > (totalValue / 2000)).reduce((max, address) => Math.max(max, address.stats.tx_count), 0);
    const dataItems = data.map(address => ({
      ...address,
      itemStyle: {
        color: lerpColor('#1E88E5', '#D81B60', address.stats.tx_count / maxTxs),
      }
    }));
    this.chartOptions = {
      tooltip: {
        trigger: 'item',
        textStyle: {
          align: 'left',
        }
      },
      series: <TreemapSeriesOption[]>[
        {
          height: 300,
          left: 0,
          right: 0,
          bottom: 0,
          top: 0,
          roam: false,
          type: 'treemap',
          data: dataItems,
          nodeClick: 'link',
          progressive: 100,
          tooltip: {
            show: true,
            backgroundColor: 'rgba(17, 19, 31, 1)',
            borderRadius: 4,
            shadowColor: 'rgba(0, 0, 0, 0.5)',
            textStyle: {
              color: '#b1b1b1',
            },
            borderColor: '#000',
            formatter: (value): string => {
              if (!value.data.address) {
                return '';
              }
              return `
                <table style="table-layout: fixed;">
                  <tbody>
                    <tr>
                      <td colspan="2"><b style="color: white; margin-left: 2px">${value.data.address}</b></td>
                    </tr>
                    <tr>
                      <td>Received</td>
                      <td style="text-align: right">${this.formatValue(value.data.stats.funded_txo_sum)}</td>
                    </tr>
                    <tr>
                      <td>Sent</td>
                      <td style="text-align: right">${this.formatValue(value.data.stats.spent_txo_sum)}</td>
                    </tr>
                    <tr>
                      <td>Balance</td>
                      <td style="text-align: right">${this.formatValue(value.data.stats.funded_txo_sum - value.data.stats.spent_txo_sum)}</td>
                    </tr>
                    <tr>
                      <td>Transaction count</td>
                      <td style="text-align: right">${value.data.stats.tx_count}</td>
                    </tr>
                  </tbody>
                </table>
              `;
            }
          },
          itemStyle: {
            borderColor: 'black',
            borderWidth: 1,
          },
          breadcrumb: {
            show: false,
          }
        }
      ]
    };    
  }

  formatValue(sats: number): string {
    if (sats > 100000000) {
      return formatNumber(sats / 100000000, this.locale, '1.2-2') + ' BTC';
    } else {
     return this.amountShortenerPipe.transform(sats, 2) + ' sats';
    }
  }

  onChartInit(ec: any): void {
    this.chartInstance = ec;

    this.chartInstance.on('click', (e) => {
      //@ts-ignore
      if (!e.data.address) {
        return;
      }
      this.zone.run(() => {
        //@ts-ignore
        const url = new RelativeUrlPipe(this.stateService).transform(`/address/${e.data.address}`);
        this.router.navigate([url]);
      });
    });
  }
}
