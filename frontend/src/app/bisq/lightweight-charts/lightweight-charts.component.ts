import { createChart, CrosshairMode } from 'lightweight-charts';
import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, Input, OnChanges, OnDestroy, OnInit } from '@angular/core';

@Component({
  selector: 'app-lightweight-charts',
  template: '<ng-component></ng-component>',
  styleUrls: ['./lightweight-charts.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LightweightChartsComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() data: any;
  lineSeries: any;
  chart: any;

  constructor(
    private element: ElementRef,
  ) {
    this.chart = createChart(this.element.nativeElement, {
      width: 1110,
      height: 500,
      layout: {
        backgroundColor: '#000000',
        textColor: '#d1d4dc',
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      grid: {
        vertLines: {
          visible: true,
          color: 'rgba(42, 46, 57, 0.5)',
        },
        horzLines: {
          color: 'rgba(42, 46, 57, 0.5)',
        },
      },
    });
    this.lineSeries = this.chart.addCandlestickSeries();
  }

  ngAfterViewInit(): void {
    /*
    lineSeries.setData([
        { time: '2019-04-11', value: 80.01 },
        { time: '2019-04-12', value: 96.63 },
        { time: '2019-04-13', value: 76.64 },
        { time: '2019-04-14', value: 81.89 },
        { time: '2019-04-15', value: 74.43 },
        { time: '2019-04-16', value: 80.01 },
        { time: '2019-04-17', value: 96.63 },
        { time: '2019-04-18', value: 76.64 },
        { time: '2019-04-19', value: 81.89 },
        { time: '2019-04-20', value: 74.43 },
    ]);
    */
  }

  ngOnChanges() {
    if (!this.data) {
      return;
    }
    this.lineSeries.setData(this.data);
  }

  ngOnDestroy() {
    this.chart.remove();
  }

}
