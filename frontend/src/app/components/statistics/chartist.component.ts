import {
  Component,
  ElementRef,
  Inject,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  SimpleChanges,
  ViewEncapsulation,
} from '@angular/core';

import { isPlatformBrowser } from '@angular/common';

import * as Chartist from '@mempool/chartist';

/**
 * Possible chart types
 * @type {String}
 */
export type ChartType = 'Pie' | 'Bar' | 'Line';

export type ChartInterfaces = Chartist.IChartistPieChart | Chartist.IChartistBarChart | Chartist.IChartistLineChart;
export type ChartOptions = Chartist.IBarChartOptions | Chartist.ILineChartOptions | Chartist.IPieChartOptions;
export type ResponsiveOptionTuple = Chartist.IResponsiveOptionTuple<ChartOptions>;
export type ResponsiveOptions = ResponsiveOptionTuple[];

/**
 * Represent a chart event.
 * For possible values, check the Chartist docs.
 */
export interface ChartEvent {
  [eventName: string]: (data: any) => void;
}

@Component({
  selector: 'app-chartist',
  template: '<ng-content></ng-content>',
  styleUrls: ['./chartist.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class ChartistComponent implements OnInit, OnChanges, OnDestroy {
  @Input()
  // @ts-ignore
  public data: Promise<Chartist.IChartistData> | Chartist.IChartistData;

  // @ts-ignore
  @Input() public type: Promise<ChartType> | ChartType;

  @Input()
  // @ts-ignore
  public options: Promise<Chartist.IChartOptions> | Chartist.IChartOptions;

  @Input()
  // @ts-ignore
  public responsiveOptions: Promise<ResponsiveOptions> | ResponsiveOptions;

  // @ts-ignore
  @Input() public events: ChartEvent;

  isBrowser: boolean = isPlatformBrowser(this.platformId);

  // @ts-ignore
  public chart: ChartInterfaces;

  private element: HTMLElement;

  constructor(element: ElementRef, @Inject(PLATFORM_ID) private platformId: any) {
    this.element = element.nativeElement;
  }

  public ngOnInit(): Promise<ChartInterfaces> {
    if (!this.isBrowser) {
      return;
    }

    if (!this.type || !this.data) {
      Promise.reject('Expected at least type and data.');
    }

    return this.renderChart().then(chart => {
      if (this.events !== undefined) {
        this.bindEvents(chart);
      }

      return chart;
    });
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (!this.isBrowser) {
      return;
    }

    this.update(changes);
  }

  public ngOnDestroy(): void {
    if (this.chart) {
      this.chart.detach();
    }
  }

  public renderChart(): Promise<ChartInterfaces> {
    const promises: any[] = [this.type, this.element, this.data, this.options, this.responsiveOptions];

    return Promise.all(promises).then(values => {
      const [type, ...args]: any = values;

      if (!(type in Chartist)) {
        throw new Error(`${type} is not a valid chart type`);
      }

      this.chart = (Chartist as any)[type](...args);

      return this.chart;
    });
  }

  public update(changes: SimpleChanges): void {
    if (!this.chart || 'type' in changes) {
      this.renderChart();
    } else {
      if (changes.data) {
        this.data = changes.data.currentValue;
      }

      if (changes.options) {
        this.options = changes.options.currentValue;
      }

      (this.chart as any).update(this.data, this.options);
    }
  }

  public bindEvents(chart: any): void {
    for (const event of Object.keys(this.events)) {
      chart.on(event, this.events[event]);
    }
  }
}

/**
 * Chartist.js plugin to display a "target" or "goal" line across the chart.
 * Only tested with bar charts. Works for horizontal and vertical bars.
 */
(function (window, document, Chartist) {
  'use strict';

  const defaultOptions = {
    // The class name so you can style the text
    className: 'ct-target-line',
    // The axis to draw the line. y == vertical bars, x == horizontal
    axis: 'y',
    // What value the target line should be drawn at
    value: null,
  };

  Chartist.plugins = Chartist.plugins || {};

  Chartist.plugins.ctTargetLine = function (options: any) {
    options = Chartist.extend({}, defaultOptions, options);
    return function ctTargetLine(chart: any) {
      chart.on('created', function (context: any) {
        const projectTarget = {
          y: function (chartRect: any, bounds: any, value: any) {
            const targetLineY = chartRect.y1 - (chartRect.height() / bounds.max) * value;

            return {
              x1: chartRect.x1,
              x2: chartRect.x2,
              y1: targetLineY,
              y2: targetLineY,
            };
          },
          x: function (chartRect: any, bounds: any, value: any) {
            const targetLineX = chartRect.x1 + (chartRect.width() / bounds.max) * value;

            return {
              x1: targetLineX,
              x2: targetLineX,
              y1: chartRect.y1,
              y2: chartRect.y2,
            };
          },
        };
        // @ts-ignore
        const targetLine = projectTarget[options.axis](context.chartRect, context.bounds, options.value);

        context.svg.elem('line', targetLine, options.className);
      });
    };
  };
})(null, null, Chartist);

/**
 * Chartist.js plugin to display a data label on top of the points in a line chart.
 *
 */
/* global Chartist */
(function (window, document, Chartist) {
  'use strict';

  const defaultOptions = {
    labelClass: 'ct-label',
    labelOffset: {
      x: 0,
      y: -10,
    },
    textAnchor: 'middle',
    align: 'center',
    labelInterpolationFnc: Chartist.noop,
  };

  const labelPositionCalculation = {
    point: function (data: any) {
      return {
        x: data.x,
        y: data.y,
      };
    },
    bar: {
      left: function (data: any) {
        return {
          x: data.x1,
          y: data.y1,
        };
      },
      center: function (data: any) {
        return {
          x: data.x1 + (data.x2 - data.x1) / 2,
          y: data.y1,
        };
      },
      right: function (data: any) {
        return {
          x: data.x2,
          y: data.y1,
        };
      },
    },
  };

  Chartist.plugins = Chartist.plugins || {};
  Chartist.plugins.ctPointLabels = function (options: any) {
    options = Chartist.extend({}, defaultOptions, options);

    function addLabel(position: any, data: any) {
      // if x and y exist concat them otherwise output only the existing value
      const value =
        data.value.x !== undefined && data.value.y ? data.value.x + ', ' + data.value.y : data.value.y || data.value.x;

      data.group
        .elem(
          'text',
          {
            x: position.x + options.labelOffset.x,
            y: position.y + options.labelOffset.y,
            style: 'text-anchor: ' + options.textAnchor,
          },
          options.labelClass
        )
        .text(options.labelInterpolationFnc(value));
    }

    return function ctPointLabels(chart: any) {
      if (chart instanceof Chartist.Line || chart instanceof Chartist.Bar) {
        chart.on('draw', function (data: any) {
          // @ts-ignore
          const positonCalculator =
            (labelPositionCalculation[data.type] &&
              // @ts-ignore
              labelPositionCalculation[data.type][options.align]) ||
            labelPositionCalculation[data.type];
          if (positonCalculator) {
            addLabel(positonCalculator(data), data);
          }
        });
      }
    };
  };
})(null, null, Chartist);

const defaultOptions = {
  className: '',
  classNames: false,
  removeAll: false,
  legendNames: false,
  clickable: true,
  onClick: null,
  position: 'top',
};

Chartist.plugins.legend = function (options: any) {
  let cachedDOMPosition;
  let cacheInactiveLegends: { [key: number]: boolean } = {};
  // Catch invalid options
  if (options && options.position) {
    if (!(options.position === 'top' || options.position === 'bottom' || options.position instanceof HTMLElement)) {
      throw Error('The position you entered is not a valid position');
    }
    if (options.position instanceof HTMLElement) {
      // Detatch DOM element from options object, because Chartist.extend
      // currently chokes on circular references present in HTMLElements
      cachedDOMPosition = options.position;
      delete options.position;
    }
  }

  options = Chartist.extend({}, defaultOptions, options);

  if (cachedDOMPosition) {
    // Reattatch the DOM Element position if it was removed before
    options.position = cachedDOMPosition;
  }

  return function legend(chart: any) {
    let isSelfUpdate = false;

    chart.on('created', function (data: any) {
      const useLabels = chart instanceof Chartist.Pie && chart.data.labels && chart.data.labels.length;
      const legendNames = getLegendNames(useLabels);
      let dirtyChartData = chart.data.series.length < legendNames.length;

      if (isSelfUpdate || dirtyChartData) return;

      function removeLegendElement() {
        const legendElement = chart.container.querySelector('.ct-legend');
        if (legendElement) {
          legendElement.parentNode.removeChild(legendElement);
        }
      }

      // Set a unique className for each series so that when a series is removed,
      // the other series still have the same color.
      function setSeriesClassNames() {
        chart.data.series = chart.data.series.map(function (series: any, seriesIndex: any) {
          if (typeof series !== 'object') {
            series = {
              value: series,
            };
          }
          series.className =
            series.className || chart.options.classNames.series + '-' + Chartist.alphaNumerate(seriesIndex);
          return series;
        });
      }

      function createLegendElement() {
        const legendElement = document.createElement('ul');
        legendElement.className = 'ct-legend';
        const inverted = localStorage.getItem('inverted-graph') === 'true';
        if (inverted) {
          legendElement.classList.add('inverted');
        }
        if (chart instanceof Chartist.Pie) {
          legendElement.classList.add('ct-legend-inside');
        }
        if (typeof options.className === 'string' && options.className.length > 0) {
          legendElement.classList.add(options.className);
        }
        if (chart.options.width) {
          legendElement.style.cssText = 'width: ' + chart.options.width + 'px;margin: 0 auto;';
        }
        return legendElement;
      }

      // Get the right array to use for generating the legend.
      function getLegendNames(useLabels: any) {
        return options.legendNames || (useLabels ? chart.data.labels : chart.data.series);
      }

      // Initialize the array that associates series with legends.
      // -1 indicates that there is no legend associated with it.
      function initSeriesMetadata(useLabels: any) {
        const seriesMetadata = new Array(chart.data.series.length);
        for (let i = 0; i < chart.data.series.length; i++) {
          seriesMetadata[i] = {
            data: chart.data.series[i],
            label: useLabels ? chart.data.labels[i] : null,
            legend: -1,
          };
        }
        return seriesMetadata;
      }

      function createNameElement(i: any, legendText: any, classNamesViable: any) {
        const li = document.createElement('li');
        li.classList.add('ct-series-' + i);
        // Append specific class to a legend element, if viable classes are given
        if (classNamesViable) {
          li.classList.add(options.classNames[i]);
        }
        li.setAttribute('data-legend', i);
        li.textContent = legendText;
        return li;
      }

      // Append the legend element to the DOM
      function appendLegendToDOM(legendElement: any) {
        if (!(options.position instanceof HTMLElement)) {
          switch (options.position) {
            case 'top':
              chart.container.insertBefore(legendElement, chart.container.childNodes[0]);
              break;

            case 'bottom':
              chart.container.insertBefore(legendElement, null);
              break;
          }
        } else {
          // Appends the legend element as the last child of a given HTMLElement
          options.position.insertBefore(legendElement, null);
        }
      }

      function updateChart(newSeries: any, newLabels: any, useLabels: any) {
        chart.data.series = newSeries;
        if (useLabels) {
          chart.data.labels = newLabels;
        }

        isSelfUpdate = true;
        chart.update();
        isSelfUpdate = false;
      }

      function addClickHandler(legendElement: any, legends: any, seriesMetadata: any, useLabels: any) {
        legendElement.addEventListener('click', function (e: any) {
          const li = e.target;
          if (li.parentNode !== legendElement || !li.hasAttribute('data-legend')) return;
          e.preventDefault();

          const legendIndex = parseInt(li.getAttribute('data-legend'));
          const legend = legends[legendIndex];

          const activateLegend = (_legendIndex: number): void => {
            legends[_legendIndex].active = true;
            legendElement.childNodes[_legendIndex].classList.remove('inactive');

            cacheInactiveLegends[_legendIndex] = false;
          };

          const deactivateLegend = (_legendIndex: number): void => {
            legends[_legendIndex].active = false;
            legendElement.childNodes[_legendIndex].classList.add('inactive');
            cacheInactiveLegends[_legendIndex] = true;
          };

          for (let i = legends.length - 1; i >= 0; i--) {
            if (i >= legendIndex) {
              if (!legend.active) activateLegend(i);
            } else {
              if (legend.active) deactivateLegend(i);
            }
          }
          // Make sure all values are undefined (falsy) when clicking the first legend
          // After clicking the first legend all indices should be falsy
          if (legendIndex === 0) cacheInactiveLegends = {};

          const newSeries = [];
          const newLabels = [];

          for (let i = 0; i < seriesMetadata.length; i++) {
            if (seriesMetadata[i].legend !== -1 && legends[seriesMetadata[i].legend].active) {
              newSeries.push(seriesMetadata[i].data);
              newLabels.push(seriesMetadata[i].label);
            }
          }

          updateChart(newSeries, newLabels, useLabels);

          if (options.onClick) {
            options.onClick(chart, e);
          }
        });
      }

      removeLegendElement();

      const legendElement = createLegendElement();
      const seriesMetadata = initSeriesMetadata(useLabels);
      const legends: any = [];

      // Check if given class names are viable to append to legends
      const classNamesViable = Array.isArray(options.classNames) && options.classNames.length === legendNames.length;

      let activeSeries = [];
      let activeLabels = [];

      // Loop through all legends to set each name in a list item.
      legendNames.forEach(function (legend: any, i: any) {
        const legendText = legend.name || legend;
        const legendSeries = legend.series || [i];

        const li = createNameElement(i, legendText, classNamesViable);
        // If the value is undefined or false, isActive is true
        const isActive: boolean = !cacheInactiveLegends[i];
        if (isActive) {
          activeSeries.push(seriesMetadata[i].data);
          activeLabels.push(seriesMetadata[i].label);
        } else {
          li.classList.add('inactive');
        }
        legendElement.appendChild(li);

        legendSeries.forEach(function (seriesIndex: any) {
          seriesMetadata[seriesIndex].legend = i;
        });

        legends.push({
          text: legendText,
          series: legendSeries,
          active: isActive,
        });
      });

      appendLegendToDOM(legendElement);

      if (options.clickable) {
        setSeriesClassNames();
        addClickHandler(legendElement, legends, seriesMetadata, useLabels);
      }

      updateChart(activeSeries, activeLabels, useLabels);
    });
  };
};

Chartist.plugins.tooltip = function (options: any) {
  options = Chartist.extend({}, defaultOptions, options);

  return function tooltip(chart: any) {
    let tooltipSelector = options.pointClass;
    if (chart instanceof Chartist.Bar) {
      tooltipSelector = 'ct-bar';
    } else if (chart instanceof Chartist.Pie) {
      // Added support for donut graph
      if (chart.options.donut) {
        tooltipSelector = 'ct-slice-donut';
      } else {
        tooltipSelector = 'ct-slice-pie';
      }
    }

    const $chart = chart.container;
    let $toolTip = $chart.querySelector('.chartist-tooltip');
    if (!$toolTip) {
      $toolTip = document.createElement('div');
      $toolTip.className = !options.class ? 'chartist-tooltip' : 'chartist-tooltip ' + options.class;
      if (!options.appendToBody) {
        $chart.appendChild($toolTip);
      } else {
        document.body.appendChild($toolTip);
      }
    }
    let height = $toolTip.offsetHeight;
    let width = $toolTip.offsetWidth;

    hide($toolTip);

    function on(event: any, selector: any, callback: any) {
      $chart.addEventListener(event, function (e: any) {
        if (!selector || hasClass(e.target, selector)) {
          callback(e);
        }
      });
    }

    on('mouseover', tooltipSelector, function (event: any) {
      const $point = event.target;
      let tooltipText = '';

      const isPieChart = chart instanceof Chartist.Pie ? $point : $point.parentNode;
      const seriesName = isPieChart
        ? $point.parentNode.getAttribute('ct:meta') || $point.parentNode.getAttribute('ct:series-name')
        : '';
      let meta = $point.getAttribute('ct:meta') || seriesName || '';
      const hasMeta = !!meta;
      let value = $point.getAttribute('ct:value');

      if (options.transformTooltipTextFnc && typeof options.transformTooltipTextFnc === 'function') {
        value = options.transformTooltipTextFnc(value, $point.parentNode.getAttribute('class'));
      }

      if (options.tooltipFnc && typeof options.tooltipFnc === 'function') {
        tooltipText = options.tooltipFnc(meta, value);
      } else {
        if (options.metaIsHTML) {
          const txt = document.createElement('textarea');
          txt.innerHTML = meta;
          meta = txt.value;
        }

        meta = '<span class="chartist-tooltip-meta">' + meta + '</span>';

        if (hasMeta) {
          tooltipText += meta + '<br>';
        } else {
          // For Pie Charts also take the labels into account
          // Could add support for more charts here as well!
          if (chart instanceof Chartist.Pie) {
            const label = next($point, 'ct-label');
            if (label) {
              tooltipText += text(label) + '<br>';
            }
          }
        }

        if (value) {
          if (options.currency) {
            if (options.currencyFormatCallback != undefined) {
              value = options.currencyFormatCallback(value, options);
            } else {
              value = options.currency + value.replace(/(\d)(?=(\d{3})+(?:\.\d+)?$)/g, '$1,');
            }
          }
          value = '<span class="chartist-tooltip-value">' + value + '</span>';
          tooltipText += value;
        }
      }

      if (tooltipText) {
        $toolTip.innerHTML = tooltipText;
        setPosition(event);
        show($toolTip);

        // Remember height and width to avoid wrong position in IE
        height = $toolTip.offsetHeight;
        width = $toolTip.offsetWidth;
      }
    });

    on('mouseout', tooltipSelector, function () {
      hide($toolTip);
    });

    on('mousemove', null, function (event: any) {
      if (false === options.anchorToPoint) {
        setPosition(event);
      }
    });

    function setPosition(event: any) {
      height = height || $toolTip.offsetHeight;
      width = width || $toolTip.offsetWidth;
      const offsetX = -width / 2 + options.tooltipOffset.x;
      const offsetY = -height + options.tooltipOffset.y;
      let anchorX, anchorY;

      if (!options.appendToBody) {
        const box = $chart.getBoundingClientRect();
        const left = event.pageX - box.left - window.pageXOffset;
        const top = event.pageY - box.top - window.pageYOffset;

        if (true === options.anchorToPoint && event.target.x2 && event.target.y2) {
          anchorX = parseInt(event.target.x2.baseVal.value);
          anchorY = parseInt(event.target.y2.baseVal.value);
        }

        $toolTip.style.top = (anchorY || top) + offsetY + 'px';
        $toolTip.style.left = (anchorX || left) + offsetX + 'px';
      } else {
        $toolTip.style.top = event.pageY + offsetY + 'px';
        $toolTip.style.left = event.pageX + offsetX + 'px';
      }
    }
  };
};

Chartist.plugins.ctPointLabels = options => {
  return function ctPointLabels(chart) {
    const defaultOptions2 = {
      labelClass: 'ct-point-label',
      labelOffset: {
        x: 0,
        y: -7,
      },
      textAnchor: 'middle',
    };
    options = Chartist.extend({}, defaultOptions2, options);

    if (chart instanceof Chartist.Line) {
      chart.on('draw', data => {
        if (data.type === 'point') {
          data.group
            .elem(
              'text',
              {
                x: data.x + options.labelOffset.x,
                y: data.y + options.labelOffset.y,
                style: 'text-anchor: ' + options.textAnchor,
              },
              options.labelClass
            )
            .text(options.labelInterpolationFnc(data.value.y)); // 07.11.17 added ".y"
        }
      });
    }
  };
};

function show(element: any) {
  if (!hasClass(element, 'tooltip-show')) {
    element.className = element.className + ' tooltip-show';
  }
}

function hide(element: any) {
  const regex = new RegExp('tooltip-show' + '\\s*', 'gi');
  element.className = element.className.replace(regex, '').trim();
}

function hasClass(element: any, className: any) {
  return (' ' + element.getAttribute('class') + ' ').indexOf(' ' + className + ' ') > -1;
}

function next(element: any, className: any) {
  do {
    element = element.nextSibling;
  } while (element && !hasClass(element, className));
  return element;
}

function text(element: any) {
  return element.innerText || element.textContent;
}
