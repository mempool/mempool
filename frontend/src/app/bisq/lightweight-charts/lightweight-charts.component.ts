import { createChart, CrosshairMode } from 'lightweight-charts';
import { ChangeDetectionStrategy, Component, ElementRef, Input, OnChanges, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-lightweight-charts',
  template: '<ng-component></ng-component>',
  styleUrls: ['./lightweight-charts.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LightweightChartsComponent implements OnChanges, OnDestroy {
  @Input() data: any;
  @Input() volumeData: any;
  @Input() precision: number;

  lineSeries: any;
  volumeSeries: any;
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

    this.volumeSeries = this.chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '',
      scaleMargins: {
        top: 0.85,
        bottom: 0,
      },
    });
  }

  ngOnChanges() {
    if (!this.data) {
      return;
    }
    this.lineSeries.setData(this.data);
    this.volumeSeries.setData(this.volumeData);

    this.lineSeries.applyOptions({
      priceFormat: {
          type: 'price',
          precision: this.precision,
          minMove: 0.0000001,
      },
    });
  }

  ngOnDestroy() {
    this.chart.remove();
  }

}
