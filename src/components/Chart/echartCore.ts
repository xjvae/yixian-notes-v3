/**
 * ECharts 按需引入核心模块
 *
 * 只引入项目中实际使用的图表类型和组件，
 * 相比全量引入可减少约 60% 体积（从 ~830KB 降至 ~300KB）
 */

// 导入基础类型和初始化函数
import * as echarts from 'echarts/core';

// 导入需要的图表类型
import { LineChart, PieChart, BarChart, HeatmapChart } from 'echarts/charts';

// 导入需要的组件
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  VisualMapComponent,
  ToolboxComponent,
} from 'echarts/components';

// 导入 Canvas 渲染器（比 SVG 渲染器更小且性能更好）
import { CanvasRenderer } from 'echarts/renderers';

// 按需注册模块
echarts.use([
  // 图表类型
  LineChart,
  PieChart,
  BarChart,
  HeatmapChart,
  // 组件
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  VisualMapComponent,
  ToolboxComponent,
  // 渲染器
  CanvasRenderer,
]);

// 导出配置好的 echarts 实例
export default echarts;

// 导出常用类型
export type { EChartsCoreOption as EChartsOption, EChartsType } from 'echarts/core';
