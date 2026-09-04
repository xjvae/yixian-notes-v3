// 标签管理面板组件
//
// 显示和管理笔记标签，支持添加/移除标签。
// 从 EditorPane 中提取的 TagEditor 组件。

import { useState, memo } from 'react';
import { Tags, X, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { EditorTagsPanelProps } from './types';

export default memo(function EditorTagsPanel({
  note,
  allTags,
  onAddTag,
  onRemoveTag,
}: EditorTagsPanelProps) {
  const [isEditing, setIsEditing] = useState(false);

  if (!isEditing) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {note.tags.length === 0 ? (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-muted transition-colors"
          >
            <Tags className="size-3" />
            添加标签
          </button>
        ) : (
          <>
            {note.tags.map((tagId) => {
              const tag = allTags.find((t) => t.id === tagId);
              if (!tag) return null;
              return (
                <Badge
                  key={tagId}
                  variant="secondary"
                  className="h-5 px-2 text-[11px] font-normal cursor-pointer hover:opacity-80"
                  style={{
                    backgroundColor: `${tag.color}15`,
                    color: tag.color,
                  }}
                  onClick={() => setIsEditing(true)}
                >
                  #{tag.name}
                </Badge>
              );
            })}
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="text-xs text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-muted"
              aria-label="管理标签"
            >
              <X className="size-3" />
            </button>
          </>
        )}
      </div>
    );
  }

  const availableTags = allTags.filter((t) => !note.tags.includes(t.id));

  return (
    <div className="flex items-center gap-2 flex-wrap p-1.5 -m-1.5 bg-muted/50 rounded-md">
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        <Tags className="size-3" />
        标签:
      </span>
      {note.tags.map((tagId) => {
        const tag = allTags.find((t) => t.id === tagId);
        if (!tag) return null;
        return (
          <Badge
            key={tagId}
            variant="secondary"
            className="h-5 px-2 text-[11px] font-normal cursor-pointer"
            style={{
              backgroundColor: `${tag.color}20`,
              color: tag.color,
            }}
            onClick={() => onRemoveTag(tagId)}
          >
            #{tag.name} <X className="size-3 ml-1" />
          </Badge>
        );
      })}
      {availableTags.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {availableTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => onAddTag(tag.id)}
              className="h-5 px-1.5 text-[11px] rounded-full border border-dashed border-border hover:border-foreground/30 text-muted-foreground hover:text-foreground transition-colors"
              style={{ color: tag.color, borderColor: `${tag.color}40` }}
            >
              + {tag.name}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => setIsEditing(false)}
        className="ml-auto text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5"
      >
        <Check className="size-3" />
        完成
      </button>
    </div>
  );
});
