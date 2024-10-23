import { Component, ChangeDetectionStrategy, Input, OnChanges, OnInit, HostListener } from '@angular/core';
import { EChartsOption } from '@app/graphs/echarts';
import { CurrentPegs } from '@interfaces/node-api.interface';


@Component({
  selector: 'app-reserves-ratio',
  templateUrl: './reserves-ratio.component.html',
  styleUrls: ['./reserves-ratio.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReservesRatioComponent implements OnInit, OnChanges {
  @Input() currentPeg: CurrentPegs;
  @Input() currentReserves: CurrentPegs;
  ratioChartOptions: EChartsOption;

  height: number | string = '200';
  right: number | string = '10';
  top: number | string = '20';
  left: number | string = '50';
  template: ('widget' | 'advanced') = 'widget';
  isLoading = true;

  ratioChartInitOptions = {
    renderer: 'svg'
  };

  constructor() { }

  ngOnInit() {
    this.isLoading = true;
  }

  ngOnChanges() {
    this.updateChartOptions();
  }

  updateChartOptions() {
    if (!this.currentPeg || !this.currentReserves || this.currentPeg.amount === '0') {
      return;
    }
    this.ratioChartOptions = this.createChartOptions(this.currentPeg, this.currentReserves);
  }

  rendered() {
    if (!this.currentPeg || !this.currentReserves) {
      return;
    }
    this.isLoading = false;
  }

  createChartOptions(currentPeg: CurrentPegs, currentReserves: CurrentPegs): EChartsOption {
    const value = parseFloat(currentReserves.amount) / parseFloat(currentPeg.amount);
    const hideMaxAxisLabels = value >= 1.001;
    const hideMinAxisLabels = value <= 0.999;

    let axisFontSize = 14;
    let pointerLength = '50%';
    let pointerWidth = 16;
    let offsetCenter = ['0%', '-22%'];
    if (window.innerWidth >= 992) {
      axisFontSize = 14;
      pointerLength = '50%';
      pointerWidth = 16;
      offsetCenter = value >= 1.0007 || value <= 0.9993 ? ['0%', '-30%'] : ['0%', '-22%'];
    } else if (window.innerWidth >= 768) {
      axisFontSize = 10;
      pointerLength = '35%';
      pointerWidth = 12;
      offsetCenter = value >= 1.0007 || value <= 0.9993 ? ['0%', '-37%'] : ['0%', '-27%'];
    } else if (window.innerWidth >= 450) {
      axisFontSize = 14;
      pointerLength = '45%';
      pointerWidth = 14;
      offsetCenter = value >= 1.0007 || value <= 0.9993 ? ['0%', '-32%'] : ['0%', '-22%'];
    } else {
      axisFontSize = 10;
      pointerLength = '35%';
      pointerWidth = 12;
      offsetCenter = value >= 1.0007 || value <= 0.9993 ? ['0%', '-37%'] : ['0%', '-27%'];
    }

    return {
      series: [
        {
          type: 'gauge',
          startAngle: 180,
          silent: true,
          endAngle: 0,
          center: ['50%', '75%'],
          radius: '100%',
          min: 0.999,
          max: 1.001,
          splitNumber: 2,
          axisLine: {
            lineStyle: {
              width: 6,
              color: [
                [0.49, 'var(--red)'],
                [1, 'var(--green)']
              ]
            }
          },
          axisLabel: {
            color: 'inherit',        
            fontFamily: 'inherit',  
            fontSize: axisFontSize,  
            formatter: function (value) {
              if (value === 0.999) {
                return hideMinAxisLabels ? '' : '99.9%';
              } else if (value === 1.001) {
                return hideMaxAxisLabels ? '' : '100.1%';
              } else {
                return '100%';
              }
            },
          },
          pointer: {
            icon: 'path://M2090.36389,615.30999 L2090.36389,615.30999 C2091.48372,615.30999 2092.40383,616.194028 2092.44859,617.312956 L2096.90698,728.755929 C2097.05155,732.369577 2094.2393,735.416212 2090.62566,735.56078 C2090.53845,735.564269 2090.45117,735.566014 2090.36389,735.566014 L2090.36389,735.566014 C2086.74736,735.566014 2083.81557,732.63423 2083.81557,729.017692 C2083.81557,728.930412 2083.81732,728.84314 2083.82081,728.755929 L2088.2792,617.312956 C2088.32396,616.194028 2089.24407,615.30999 2090.36389,615.30999 Z',
            length: pointerLength,
            width: pointerWidth,
            offsetCenter: offsetCenter,
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
            offsetCenter: [0, '-127%'],
            fontSize: 18,
            color: 'var(--title-fg)',
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
              return (value * 100).toFixed(3) + '%';
            },
            color: 'inherit'
          },
          data: [
            {
              value: value,
              name: $localize`Assets vs Liabilities`
            }
          ]
        }
      ]
    };
  }

  @HostListener('window:resize', ['$event'])
  onResize(): void {
    this.updateChartOptions();
  }
}

