// Import tree-shakeable echarts
import * as echarts from 'echarts/core';
import { LineChart, LinesChart, BarChart, TreemapChart, PieChart, ScatterChart } from 'echarts/charts';
import { TitleComponent, TooltipComponent, GridComponent, LegendComponent, GeoComponent, DataZoomComponent, VisualMapComponent, MarkLineComponent } from 'echarts/components';
import { SVGRenderer, CanvasRenderer } from 'echarts/renderers';
// Typescript interfaces
import { EChartsOption, TreemapSeriesOption, LineSeriesOption, PieSeriesOption } from 'echarts';


echarts.use([
  SVGRenderer, CanvasRenderer,
  TitleComponent, TooltipComponent, GridComponent,
  LegendComponent, GeoComponent, DataZoomComponent,
  VisualMapComponent, MarkLineComponent,
  LineChart, LinesChart, BarChart, TreemapChart, PieChart, ScatterChart
]);
export { echarts, EChartsOption, TreemapSeriesOption, LineSeriesOption, PieSeriesOption };