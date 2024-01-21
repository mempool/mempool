import { Component, ChangeDetectionStrategy, Input, OnChanges, OnInit } from '@angular/core';
import { EChartsOption } from '../../../graphs/echarts';
import { CurrentPegs } from '../../../interfaces/node-api.interface';


@Component({
  selector: 'app-reserves-ratio',
  templateUrl: './reserves-ratio.component.html',
  styleUrls: ['./reserves-ratio.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReservesRatioComponent implements OnInit, OnChanges {
  @Input() currentPeg: CurrentPegs;
  @Input() currentReserves: CurrentPegs;
  pegsChartOptions: EChartsOption;

  height: number | string = '200';
  right: number | string = '10';
  top: number | string = '20';
  left: number | string = '50';
  template: ('widget' | 'advanced') = 'widget';
  isLoading = true;

  pegsChartOption: EChartsOption = {};
  pegsChartInitOption = {
    renderer: 'svg'
  };

  constructor() { }

  ngOnInit() {
    this.isLoading = true;
  }

  ngOnChanges() {
    if (!this.currentPeg || !this.currentReserves || this.currentPeg.amount === '0') {
      return;
    }
    this.pegsChartOptions = this.createChartOptions(this.currentPeg, this.currentReserves);
  }

  rendered() {
    if (!this.currentPeg || !this.currentReserves) {
      return;
    }
    this.isLoading = false;
  }

  createChartOptions(currentPeg: CurrentPegs, currentReserves: CurrentPegs): EChartsOption {
    return {
      series: [
        {
          type: 'gauge',
          startAngle: 180,
          endAngle: 0,
          center: ['50%', '70%'],
          radius: '100%',
          min: 0.999,
          max: 1.001,
          splitNumber: 2,
          axisLine: {
            lineStyle: {
              width: 6,
              color: [
                [0.49, '#D81B60'],
                [1, '#7CB342']
              ]
            }
          },
          axisLabel: {
            color: 'inherit',        
            fontFamily: 'inherit',    
          },
          pointer: {
            icon: 'path://M2090.36389,615.30999 L2090.36389,615.30999 C2091.48372,615.30999 2092.40383,616.194028 2092.44859,617.312956 L2096.90698,728.755929 C2097.05155,732.369577 2094.2393,735.416212 2090.62566,735.56078 C2090.53845,735.564269 2090.45117,735.566014 2090.36389,735.566014 L2090.36389,735.566014 C2086.74736,735.566014 2083.81557,732.63423 2083.81557,729.017692 C2083.81557,728.930412 2083.81732,728.84314 2083.82081,728.755929 L2088.2792,617.312956 C2088.32396,616.194028 2089.24407,615.30999 2090.36389,615.30999 Z',
            length: '50%',
            width: 16,
            offsetCenter: [0, '-27%'],
            itemStyle: {
              color: 'auto'
            }
          },
          axisTick: {
            length: 12,
            lineStyle: {
              color: 'auto',
              width: 2
            }
          },
          splitLine: {
            length: 20,
            lineStyle: {
              color: 'auto',
              width: 5
            }
          },
          title: {
            show: true,
            offsetCenter: [0, '-117.5%'],
            fontSize: 18,
            color: '#4a68b9',
            fontFamily: 'inherit',
            fontWeight: 500,
          },
          detail: {
            fontSize: 25,
            offsetCenter: [0, '-0%'],
            valueAnimation: true,
            fontFamily: 'inherit',
            fontWeight: 500,
            formatter: function (value) {
              return (value).toFixed(5);
            },
            color: 'inherit'
          },
          data: [
            {
              value: parseFloat(currentReserves.amount) / parseFloat(currentPeg.amount),
              name: 'Peg-O-Meter'
            }
          ]
        }
      ]
    };
  }
}

