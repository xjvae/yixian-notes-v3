// 笔记可选的「天气 / 心情」元信息选项与查找
// 供编辑器选择器与列表小图标共用，避免字段取值到显示符号重复维护。

export interface NoteMetaOption {
  value: string;
  label: string;
  icon: string;
}

export const WEATHER_OPTIONS: NoteMetaOption[] = [
  { value: 'sunny', label: '晴', icon: '☀️' },
  { value: 'cloudy', label: '多云', icon: '⛅' },
  { value: 'overcast', label: '阴', icon: '☁️' },
  { value: 'rain', label: '雨', icon: '🌧️' },
  { value: 'snow', label: '雪', icon: '🌨️' },
  { value: 'foggy', label: '雾', icon: '🌫️' },
  { value: 'windy', label: '风', icon: '🌬️' },
];

export const MOOD_OPTIONS: NoteMetaOption[] = [
  { value: 'happy', label: '开心', icon: '😄' },
  { value: 'great', label: '很棒', icon: '😎' },
  { value: 'calm', label: '平静', icon: '😌' },
  { value: 'neutral', label: '一般', icon: '😐' },
  { value: 'tired', label: '疲惫', icon: '😪' },
  { value: 'sad', label: '难过', icon: '😢' },
  { value: 'angry', label: '烦躁', icon: '😠' },
];

export function getWeatherIcon(value?: string): string | undefined {
  return WEATHER_OPTIONS.find((w) => w.value === value)?.icon;
}

export function getMoodIcon(value?: string): string | undefined {
  return MOOD_OPTIONS.find((m) => m.value === value)?.icon;
}