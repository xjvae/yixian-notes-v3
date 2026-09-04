// 编辑器底部状态栏组件
//
// 显示工作区名称、字数统计、阅读时长和保存状态。
// 从 EditorPane 中提取的底部状态栏 UI。

import { memo } from 'react';
import { Check, Briefcase } from 'lucide-react';
import type { EditorStatusBarProps } from './types';

export default memo(function EditorStatusBar({
  workspaceName,
  workspaceColor,
  wordCount,
  saved,
}: EditorStatusBarProps) {
  return (
    <div className="shrink-0 px-6 py-2 border-t border-border/60 bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
      <div className="flex items-center gap-4">
        {workspaceName && (
          <span className="flex items-center gap-1" style={{ color: workspaceColor }}>
            <Briefcase className="size-3" />
            {workspaceName}
          </span>
        )}
        <span>{wordCount} 字</span>
        <span>阅读约 {Math.max(1, Math.ceil(wordCount / 300))} 分钟</span>
      </div>
      <div className="flex items-center gap-2">
        {saved ? (
          <span className="flex items-center gap-1 text-success">
            <Check className="size-3" />
            已保存
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-warning animate-pulse" />
            正在保存...
          </span>
        )}
      </div>
    </div>
  );
});
