export interface StepConfig {
  id: string;
  title: string;
}

export const STEPS: StepConfig[] = [
  { id: 'welcome', title: '欢迎' },
  { id: 'workspace', title: '工作区' },
  { id: 'features', title: '功能' },
  { id: 'appearance', title: '外观' },
  { id: 'finish', title: '完成' },
];
