import { OnChanges } from '@angular/core';
import { Component, Input, OnInit, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-fee-distribution-graph',
  templateUrl: './fee-distribution-graph.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeeDistributionGraphComponent implements OnInit, OnChanges {
  @Input() data: any;
  @Input() height: number | string = 210;
  @Input() top: number | string = 20;
  @Input() right: number | string = 22;
  @Input() left: number | string = 30;

  mempoolVsizeFeesOptions: any;
  mempoolVsizeFeesInitOptions = {
    renderer: 'svg'
  };

  constructor() { }

  ngOnInit() {
    this.mountChart();
  }

  ngOnChanges() {
    this.mountChart();
  }

  mountChart() {
    this.mempoolVsizeFeesOptions = {
      grid: {
        height: '210',
        right: '20',
        top: '22',
        left: '30',
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
      },
      yAxis: {
        type: 'value',
        splitLine: {
          lineStyle: {
            type: 'dotted',
            color: '#ffffff66',
            opacity: 0.25,
          }
        }
      },
      series: [{
        data: this.data,
        type: 'line',
        label: {
          show: true,
          position: 'top',
          color: '#ffffff',
          textShadowBlur: 0,
          formatter: (label: any) => {
            return Math.floor(label.data);
          },
        },
        smooth: true,
        lineStyle: {
          color: '#D81B60',
          width: 4,
        },
        itemStyle: {
          color: '#b71c1c',
          borderWidth: 10,
          borderMiterLimit: 10,
          opacity: 1,
        },
        areaStyle: {
          color: '#D81B60',
          opacity: 1,
        }
      }]
    };
  }
}
