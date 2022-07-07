import { createChart, CrosshairMode } from 'lightweight-charts';
import { ChangeDetectionStrategy, Component, ElementRef, HostListener, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-lightweight-charts',
  template: '<ng-component></ng-component>',
  styleUrls: ['./lightweight-charts.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LightweightChartsComponent implements OnInit, OnChanges, OnDestroy {
  @Input() data: any;
  @Input() volumeData: any;
  @Input() precision: number;
  @Input() height = 500;

  lineSeries: any;
  volumeSeries: any;
  chart: any;

  constructor(
    private element: ElementRef,
  ) { }

  @HostListener('window:resize', ['$event'])
  resizeCanvas(): void {
    this.chart.applyOptions({
      width: this.element.nativeElement.parentElement.offsetWidth,
      height: this.height,
    });
  }

  ngOnInit() {
    this.chart = createChart(this.element.nativeElement, {
      width: this.element.nativeElement.parentElement.offsetWidth,
      height: this.height,
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

    this.updateData();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (!changes.data || changes.data.isFirstChange()){
      return;
    }
    this.updateData();
  }

  ngOnDestroy() {
    this.chart.remove();
  }

  updateData() {
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

}
