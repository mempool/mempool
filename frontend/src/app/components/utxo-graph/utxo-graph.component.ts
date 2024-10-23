import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, NgZone, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { EChartsOption } from '@app/graphs/echarts';
import { Subscription } from 'rxjs';
import { Utxo } from '@interfaces/electrs.interface';
import { StateService } from '@app/services/state.service';
import { Router } from '@angular/router';
import { RelativeUrlPipe } from '@app/shared/pipes/relative-url/relative-url.pipe';
import { renderSats } from '@app/shared/common.utils';
import { colorToHex, hexToColor, mix } from '@components/block-overview-graph/utils';
import { TimeService } from '@app/services/time.service';

const newColorHex = '1bd8f4';
const oldColorHex = '9339f4';
const pendingColorHex = 'eba814';
const newColor = hexToColor(newColorHex);
const oldColor = hexToColor(oldColorHex);

interface Circle {
  x: number,
  y: number,
  r: number,
  i: number,
}

interface UtxoCircle extends Circle {
  utxo: Utxo;
}

function sortedInsert(positions: { c1: Circle, c2: Circle, d: number, p: number, side?: boolean }[], newPosition: { c1: Circle, c2: Circle, d: number, p: number }): void {
  let left = 0;
  let right = positions.length;
  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (positions[mid].p > newPosition.p) {
      right = mid;
    } else {
      left = mid + 1;
    }
  }
  positions.splice(left, 0, newPosition, {...newPosition, side: true });
}
@Component({
  selector: 'app-utxo-graph',
  templateUrl: './utxo-graph.component.html',
  styleUrls: ['./utxo-graph.component.scss'],
  styles: [`
    .loadingGraphs {
      position: absolute;
      top: 50%;
      left: calc(50% - 15px);
      z-index: 99;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UtxoGraphComponent implements OnChanges, OnDestroy {
  @Input() utxos: Utxo[];
  @Input() height: number = 200;
  @Input() right: number | string = 10;
  @Input() left: number | string = 70;
  @Input() widget: boolean = false;

  subscription: Subscription;
  lastUpdate: number = 0;
  updateInterval;

  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
  };

  error: any;
  isLoading = true;
  chartInstance: any = undefined;

  constructor(
    public stateService: StateService,
    private cd: ChangeDetectorRef,
    private zone: NgZone,
    private router: Router,
    private relativeUrlPipe: RelativeUrlPipe,
    private timeService: TimeService,
  ) {
    // re-render the chart every 10 seconds, to keep the age colors up to date
    this.updateInterval = setInterval(() => {
      if (this.lastUpdate < Date.now() - 10000 && this.utxos) {
        this.prepareChartOptions(this.utxos);
      }
    }, 10000);
  }

  ngOnChanges(changes: SimpleChanges): void {
    this.isLoading = true;
    if (!this.utxos) {
      return;
    }
    if (changes.utxos) {
      this.prepareChartOptions(this.utxos);
    }
  }

  prepareChartOptions(utxos: Utxo[]): void {
    if (!utxos || utxos.length === 0) {
      return;
    }

    this.isLoading = false;

    // Helper functions
    const distance = (x1: number, y1: number, x2: number, y2: number): number => Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    const intersection = (c1: Circle, c2: Circle, d: number, r: number, side: boolean): { x: number, y: number} => {
      const d1 = c1.r + r;
      const d2 = c2.r + r;
      const a = (d1 * d1 - d2 * d2 + d * d) / (2 * d);
      const h = Math.sqrt(d1 * d1 - a * a);
      const x3 = c1.x + a * (c2.x - c1.x) / d;
      const y3 = c1.y + a * (c2.y - c1.y) / d;
      return side
        ? { x: x3 + h * (c2.y - c1.y) / d, y: y3 - h * (c2.x - c1.x) / d }
        : { x: x3 - h * (c2.y - c1.y) / d, y: y3 + h * (c2.x - c1.x) / d };
    };

    // ~Linear algorithm to pack circles as tightly as possible without overlaps
    const placedCircles: UtxoCircle[] = [];
    const positions: { c1: Circle, c2: Circle, d: number, p: number, side?: boolean }[] = [];
    // Pack in descending order of value, and limit to the top 500 to preserve performance
    const sortedUtxos = utxos.sort((a, b) => {
      if (a.value === b.value) {
        if (a.status.confirmed && !b.status.confirmed) {
          return -1;
        } else if (!a.status.confirmed && b.status.confirmed) {
          return 1;
        } else {
          return a.status.block_height - b.status.block_height;
        }
      }
      return b.value - a.value;
    }).slice(0, 500);
    const maxR = Math.sqrt(sortedUtxos.reduce((max, utxo) => Math.max(max, utxo.value), 0));
    sortedUtxos.forEach((utxo, index) => {
      // area proportional to value
      const r = Math.sqrt(utxo.value);

      // special cases for the first two utxos
      if (index === 0) {
        placedCircles.push({ x: 0, y: 0, r, utxo, i: index });
        return;
      }
      if (index === 1) {
        const c = placedCircles[0];
        placedCircles.push({ x: c.r + r, y: 0, r, utxo, i: index });
        sortedInsert(positions, { c1: c, c2: placedCircles[1], d: c.r + r, p: 0 });
        return;
      }
      if (index === 2) {
        const c = placedCircles[0];
        placedCircles.push({ x: -c.r - r, y: 0, r, utxo, i: index });
        sortedInsert(positions, { c1: c, c2: placedCircles[2], d: c.r + r, p: 0 });
        return;
      }

      // The best position will be touching two other circles
      // find the closest such position to the center of the graph
      // where the circle can be placed without overlapping other circles
      const numCircles = placedCircles.length;
      let newCircle: UtxoCircle = null;
      while (positions.length > 0) {
        const position = positions.shift();
        // if the circles are too far apart, skip
        if (position.d > (position.c1.r + position.c2.r + r + r)) {
          continue;
        }

        const { x, y } = intersection(position.c1, position.c2, position.d, r, position.side);
        if (isNaN(x) || isNaN(y)) {
          // should never happen
          continue;
        }

        // check if the circle would overlap any other circles here
        let valid = true;
        const nearbyCircles: { c: UtxoCircle, d: number, s: number }[] = [];
        for (let k = 0; k < numCircles; k++) {
          const c = placedCircles[k];
          if (k === position.c1.i || k === position.c2.i) {
            nearbyCircles.push({ c, d: c.r + r, s: 0 });
            continue;
          }
          const d = distance(x, y, c.x, c.y);
          if (d < (r + c.r)) {
            valid = false;
            break;
          } else {
            nearbyCircles.push({ c, d, s: d - c.r - r });
          }
        }
        if (valid) {
          newCircle = { x, y, r, utxo, i: index };
          // add new positions to the candidate list
          const nearest = nearbyCircles.sort((a, b) => a.s - b.s).slice(0, 5);
          for (const n of nearest) {
            if (n.d < (n.c.r + r + maxR + maxR)) {
              sortedInsert(positions, { c1: newCircle, c2: n.c, d: n.d, p: distance((n.c.x + x) / 2, (n.c.y + y), 0, 0) });
            }
          }
          break;
        }
      }
      if (newCircle) {
        placedCircles.push(newCircle);
      } else {
        // should never happen
        return;
      }
    });

    // Precompute the bounding box of the graph
    const minX = Math.min(...placedCircles.map(d => d.x - d.r));
    const maxX = Math.max(...placedCircles.map(d => d.x + d.r));
    const minY = Math.min(...placedCircles.map(d => d.y - d.r));
    const maxY = Math.max(...placedCircles.map(d => d.y + d.r));
    const width = maxX - minX;
    const height = maxY - minY;

    const data = placedCircles.map((circle) => [
      circle.utxo.txid + circle.utxo.vout,
      circle.utxo,
      circle.x,
      circle.y,
      circle.r,
    ]);

    this.chartOptions = {
      series: [{
        type: 'custom',
        coordinateSystem: undefined,
        data: data,
        encode: {
          itemName: 0,
          x: 2,
          y: 3,
          r: 4,
        },
        renderItem: (params, api) => {
          const chartWidth = api.getWidth();
          const chartHeight = api.getHeight();
          const scale = Math.min(chartWidth / width, chartHeight / height);
          const scaledWidth = width * scale;
          const scaledHeight = height * scale;
          const offsetX = (chartWidth - scaledWidth) / 2 - minX * scale;
          const offsetY = (chartHeight - scaledHeight) / 2 - minY * scale;

          const datum = data[params.dataIndex];
          const utxo = datum[1] as Utxo;
          const x = datum[2] as number;
          const y = datum[3] as number;
          const r = datum[4] as number;
          if (r * scale < 2) {
            // skip items too small to render cleanly
            return;
          }

          const valueStr = renderSats(utxo.value, this.stateService.network);
          const elements: any[] = [
            {
              type: 'circle',
              autoBatch: true,
              shape: {
                r: (r * scale) - 1,
              },
              style: {
                fill: '#' + this.getColor(utxo),
              }
            },
          ];
          const labelFontSize = Math.min(36, r * scale * 0.3);
          if (labelFontSize > 8) {
            elements.push({
              type: 'text',
              style: {
                text: valueStr,
                fontSize: labelFontSize,
                fill: '#fff',
                align: 'center',
                verticalAlign: 'middle',
              },
            });
          }
          return {
            type: 'group',
            x: (x * scale) + offsetX,
            y: (y * scale) + offsetY,
            children: elements,
          };
        },
      }],
      tooltip: {
        backgroundColor: 'rgba(17, 19, 31, 1)',
        borderRadius: 4,
        shadowColor: 'rgba(0, 0, 0, 0.5)',
        textStyle: {
          color: 'var(--tooltip-grey)',
          align: 'left',
        },
        borderColor: '#000',
        formatter: (params: any): string => {
          const utxo = params.data[1] as Utxo;
          const valueStr = renderSats(utxo.value, this.stateService.network);
          return `
          <b style="color: white;">${utxo.txid.slice(0, 6)}...${utxo.txid.slice(-6)}:${utxo.vout}</b>
          <br>
          ${valueStr}
          <br>
          ${utxo.status.confirmed ? 'Confirmed ' + this.timeService.calculate(utxo.status.block_time, 'since', true, 1, 'minute').text : 'Pending'}
          `;
        },
      }
    };
    this.lastUpdate = Date.now();

    this.cd.markForCheck();
  }

  getColor(utxo: Utxo): string {
    if (utxo.status.confirmed) {
      const age = Date.now() / 1000 - utxo.status.block_time;
      const oneHour = 60 * 60;
      const fourYears = 4 * 365 * 24 * 60 * 60;

      if (age < oneHour) {
        return newColorHex;
      } else if (age >= fourYears) {
        return oldColorHex;
      } else {
        // Logarithmic scale between 1 hour and 4 years
        const logAge = Math.log(age / oneHour);
        const logMax = Math.log(fourYears / oneHour);
        const t = logAge / logMax;
        return colorToHex(mix(newColor, oldColor, t));
      }
    } else {
      return pendingColorHex;
    }
  }

  onChartClick(e): void {
    if (e.data?.[1]?.txid) {
      this.zone.run(() => {
        const url = this.relativeUrlPipe.transform(`/tx/${e.data[1].txid}`);
        if (e.event.event.shiftKey || e.event.event.ctrlKey || e.event.event.metaKey) {
          window.open(url + '?mode=details#vout=' + e.data[1].vout);
        } else {
          this.router.navigate([url], { fragment: `vout=${e.data[1].vout}` });
        }
      });
    }
  }

  onChartInit(ec): void {
    this.chartInstance = ec;
    this.chartInstance.on('click', 'series', this.onChartClick.bind(this));
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    clearInterval(this.updateInterval);
  }

  isMobile(): boolean {
    return (window.innerWidth <= 767.98);
  }
}
