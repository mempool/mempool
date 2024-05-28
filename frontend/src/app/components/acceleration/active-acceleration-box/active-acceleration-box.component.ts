import { Component, ChangeDetectionStrategy, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Transaction } from '../../../interfaces/electrs.interface';
import { Acceleration, SinglePoolStats } from '../../../interfaces/node-api.interface';
import { EChartsOption, PieSeriesOption } from '../../../graphs/echarts';
import { MiningStats } from '../../../services/mining.service';


@Component({
  selector: 'app-active-acceleration-box',
  templateUrl: './active-acceleration-box.component.html',
  styleUrls: ['./active-acceleration-box.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActiveAccelerationBox implements OnChanges {
  @Input() tx: Transaction;
  @Input() accelerationInfo: Acceleration;
  @Input() miningStats: MiningStats;

  acceleratedByPercentage: string = '';

  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
  };
  timespan = '';
  chartInstance: any = undefined;

  constructor() {}

  ngOnChanges(changes: SimpleChanges): void {
    if (this.tx && (this.tx.acceleratedBy || this.accelerationInfo) && this.miningStats) {
      this.prepareChartOptions();
    }
  }

  getChartData() {
    const data: object[] = [];
    const pools: { [id: number]: SinglePoolStats } = {};
    for (const pool of this.miningStats.pools) {
      pools[pool.poolUniqueId] = pool;
    }

    const getDataItem = (value, color, tooltip) => ({
      value,
      itemStyle: {
        color,
        borderColor: 'rgba(0,0,0,0)',
        borderWidth: 1,
      },
      avoidLabelOverlap: false,
      label: {
        show: false,
      },
      labelLine: {
        show: false
      },
      emphasis: {
        disabled: true,
      },
      tooltip: {
        show: true,
        backgroundColor: 'rgba(17, 19, 31, 1)',
        borderRadius: 4,
        shadowColor: 'rgba(0, 0, 0, 0.5)',
        textStyle: {
          color: 'var(--tooltip-grey)',
        },
        borderColor: '#000',
        formatter: () => {
          return tooltip;
        }
      }
    });

    let totalAcceleratedHashrate = 0;
    for (const poolId of (this.accelerationInfo?.pools || this.tx.acceleratedBy || [])) {
      const pool = pools[poolId];
      if (!pool) {
        continue;
      }
      totalAcceleratedHashrate += parseFloat(pool.lastEstimatedHashrate);
    }
    this.acceleratedByPercentage = ((totalAcceleratedHashrate / parseFloat(this.miningStats.lastEstimatedHashrate)) * 100).toFixed(1) + '%';
    data.push(getDataItem(
      totalAcceleratedHashrate,
      'var(--mainnet-alt)',
      `${this.acceleratedByPercentage} accelerating`,
    ) as PieSeriesOption);
    const notAcceleratedByPercentage = ((1 - (totalAcceleratedHashrate / parseFloat(this.miningStats.lastEstimatedHashrate))) * 100).toFixed(1) + '%';
    data.push(getDataItem(
      (parseFloat(this.miningStats.lastEstimatedHashrate) - totalAcceleratedHashrate),
      'rgba(127, 127, 127, 0.3)',
      `${notAcceleratedByPercentage} not accelerating`,
    ) as PieSeriesOption);

    return data;
  }

  prepareChartOptions() {
    this.chartOptions = {
      animation: false,
      grid: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      },
      tooltip: {
        show: true,
        trigger: 'item',
      },
      series: [
        {
          type: 'pie',
          radius: '100%',
          data: this.getChartData(),
        }
      ]
    };
  }

  onChartInit(ec) {
    if (this.chartInstance !== undefined) {
      return;
    }
    this.chartInstance = ec;
  }
}