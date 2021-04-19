import { createChart, CrosshairMode, isBusinessDay } from 'lightweight-charts';
import { ChangeDetectionStrategy, Component, ElementRef, Input, OnChanges, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-lightweight-charts-area',
  template: '<ng-component></ng-component>',
  styleUrls: ['./lightweight-charts-area.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LightweightChartsAreaComponent implements OnChanges, OnDestroy {
  @Input() data: any;
  @Input() lineData: any;
  @Input() precision: number;

  areaSeries: any;
  volumeSeries: any;
  chart: any;
  lineSeries: any;
  container: any;

  width = 1110;
  height = 500;

  constructor(
    private element: ElementRef,
  ) {
    this.container = document.createElement('div');
    const chartholder = this.element.nativeElement.appendChild(this.container);

    this.chart = createChart(chartholder, {
      width: this.width,
      height: this.height,
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      layout: {
        backgroundColor: '#000',
        textColor: 'rgba(255, 255, 255, 0.8)',
      },
      grid: {
        vertLines: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
        horzLines: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.2)',
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.2)',
      },
    });

    this.lineSeries = this.chart.addLineSeries({
      color: 'rgba(37, 177, 53, 1)',
      lineColor: 'rgba(216, 27, 96, 1)',
      lineWidth: 2,
    });

    this.areaSeries = this.chart.addAreaSeries({
      topColor: 'rgba(33, 150, 243, 0.7)',
      bottomColor: 'rgba(33, 150, 243, 0.1)',
      lineColor: 'rgba(33, 150, 243, 0.1)',
      lineWidth: 2,
    });

    const toolTip = document.createElement('div');
    toolTip.className = 'floating-tooltip-2';
    chartholder.appendChild(toolTip);

    this.chart.subscribeCrosshairMove((param) => {
      if (!param.time || param.point.x < 0 || param.point.x > this.width || param.point.y < 0 || param.point.y > this.height) {
        toolTip.style.display = 'none';
        return;
      }

      const dateStr = isBusinessDay(param.time)
        ? this.businessDayToString(param.time)
        : new Date(param.time * 1000).toLocaleDateString();

      toolTip.style.display = 'block';
      const price = param.seriesPrices.get(this.areaSeries);
      const line = param.seriesPrices.get(this.lineSeries);

      toolTip.innerHTML = `<table>
        <tr><td class="tradesText"># of trades:</td><td class="text-right tradesText">${Math.round(line * 100) / 100}</td></tr>
        <tr><td class="volumeText">Volume:<td class="text-right volumeText">${Math.round(price * 100) / 100} BTC</td></tr>
        </table>
        <div>${dateStr}</div>`;

      const y = param.point.y;

      const toolTipWidth = 100;
      const toolTipHeight = 80;
      const toolTipMargin = 15;

      let left = param.point.x + toolTipMargin;
      if (left > this.width - toolTipWidth) {
        left = param.point.x - toolTipMargin - toolTipWidth;
      }

      let top = y + toolTipMargin;
      if (top > this.height - toolTipHeight) {
        top = y - toolTipHeight - toolTipMargin;
      }

      toolTip.style.left = left + 'px';
      toolTip.style.top = top + 'px';
    });
  }

  businessDayToString(businessDay) {
    return businessDay.year + '-' + businessDay.month + '-' + businessDay.day;
  }

  ngOnChanges() {
    if (!this.data) {
      return;
    }
    this.areaSeries.setData(this.data);
    this.lineSeries.setData(this.lineData);
  }

  ngOnDestroy() {
    this.chart.remove();
  }

}
