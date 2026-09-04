import { useState, type ComponentType } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  Minus,
  BookOpen,
  CheckSquare,
  Wrench,
  Zap,
  Settings2,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  FEATURE_MODULES,
  FEATURE_GROUPS,
} from '@/data/onboarding-features';

// ========== 功能选择步骤 ==========
interface FeaturesStepProps {
  enabled: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  onDefault: () => void;
}

export default function FeaturesStep({
  enabled,
  onToggle,
  onSelectAll,
  onSelectNone,
  onDefault,
}: FeaturesStepProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set(['core']));

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const groupIconMap: Record<string, ComponentType<{ className?: string }>> = {
    core: BookOpen,
    plan: CheckSquare,
    tool: Wrench,
    advanced: Zap,
  };

  const handleGroupSelectAll = (groupId: string) => {
    const ids = FEATURE_MODULES.filter((f) => f.group === groupId).map((f) => f.id);
    ids.forEach((id) => {
      if (!enabled.has(id)) onToggle(id);
    });
  };

  const handleGroupSelectNone = (groupId: string) => {
    const ids = FEATURE_MODULES.filter((f) => f.group === groupId).map((f) => f.id);
    ids.forEach((id) => {
      if (enabled.has(id)) onToggle(id);
    });
  };

  const getGroupState = (groupId: string): 'all' | 'some' | 'none' => {
    const items = FEATURE_MODULES.filter((f) => f.group === groupId);
    const count = items.filter((f) => enabled.has(f.id)).length;
    if (count === 0) return 'none';
    if (count === items.length) return 'all';
    return 'some';
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex flex-col h-[460px]"
    >
      {/* 标题区 */}
      <div className="flex items-start justify-between px-6 pt-5 pb-3 shrink-0">
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-1">选择你需要的功能</h3>
          <p className="text-sm text-muted-foreground">
            可随时在设置中开启或关闭，已选 <span className="text-primary font-semibold">{enabled.size}</span> 个
          </p>
        </div>
      </div>

      {/* 分组列表（可滚动） */}
      <div className="flex-1 overflow-y-auto px-6 space-y-6 pb-20">
        {FEATURE_GROUPS.map((group) => {
          const groupFeatures = FEATURE_MODULES.filter((f) => f.group === group.id);
          const selectedCount = groupFeatures.filter((f) => enabled.has(f.id)).length;
          const isExpanded = expandedGroups.has(group.id);
          const state = getGroupState(group.id);
          const GroupIcon = groupIconMap[group.id] ?? Settings2;
          const selectedNames = groupFeatures
            .filter((f) => enabled.has(f.id))
            .map((f) => f.name);
          const displayNames = selectedNames.slice(0, 3);
          const extraCount = selectedNames.length - displayNames.length;

          return (
            <div
              key={group.id}
              className="rounded-xl border border-border bg-card overflow-hidden"
            >
              {/* 分组标题栏 */}
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 transition-all text-left group relative ${
                  isExpanded
                    ? 'bg-muted/60 border-b border-border'
                    : 'bg-muted/30 hover:bg-muted/60'
                }`}
              >
                {/* 左侧状态指示 */}
                <div
                  className={`size-7 shrink-0 rounded-md flex items-center justify-center transition-colors ${
                    state === 'all'
                      ? 'bg-primary text-primary-foreground'
                      : state === 'some'
                        ? 'bg-primary/20 text-primary'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {state === 'all' ? (
                    <Check className="size-4" />
                  ) : state === 'some' ? (
                    <Minus className="size-4" />
                  ) : (
                    <GroupIcon className="size-4" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {group.name}
                    </span>
                    <span className="text-xs text-primary font-medium tabular-nums">
                      {selectedCount}/{groupFeatures.length}
                    </span>
                  </div>
                  {!isExpanded && (
                    <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                      {selectedNames.length === 0 ? (
                        <span className="text-xs text-muted-foreground/70">未选择任何功能</span>
                      ) : (
                        <>
                          {displayNames.map((name) => (
                            <span
                              key={name}
                              className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground font-medium leading-tight"
                            >
                              {name}
                            </span>
                          ))}
                          {extraCount > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-medium leading-tight">
                              +{extraCount}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* hover 显示全选/全不选 */}
                <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGroupSelectAll(group.id);
                    }}
                    className="text-[11px] px-2 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                  >
                    全选
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGroupSelectNone(group.id);
                    }}
                    className="text-[11px] px-2 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                  >
                    全不选
                  </button>
                </div>

                <motion.div
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="shrink-0 text-muted-foreground"
                >
                  <ChevronDown className="size-4" />
                </motion.div>
              </button>

              {/* 功能项内容 */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    key="content"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-2 gap-2 p-3">
                      {groupFeatures.map((feature, i) => {
                        const Icon = feature.icon;
                        const isOn = enabled.has(feature.id);
                        return (
                          <motion.button
                            key={feature.id}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.03, duration: 0.25, ease: 'easeOut' }}
                            type="button"
                            onClick={() => onToggle(feature.id)}
                            className={`flex items-start gap-2.5 p-3 rounded-lg border text-left transition-all ${
                              isOn
                                ? 'border-primary/40 bg-primary/5'
                                : 'border-border hover:bg-accent/40'
                            }`}
                          >
                            <div
                              className={`size-8 shrink-0 rounded-md flex items-center justify-center transition-colors ${
                                isOn ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              <Icon className="size-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-foreground mb-0.5">
                                {feature.name}
                              </div>
                              <div className="text-xs text-muted-foreground line-clamp-2">
                                {feature.description}
                              </div>
                            </div>
                            <Switch
                              checked={isOn}
                              onCheckedChange={() => onToggle(feature.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="shrink-0 mt-0.5"
                            />
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Sticky 底部操作栏 */}
      <div className="shrink-0 px-6 py-3 border-t border-border bg-card/95 backdrop-blur-sm flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          已选 <span className="text-primary font-semibold">{enabled.size}</span> / {FEATURE_MODULES.length} 项功能
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onDefault}>
            恢复默认
          </Button>
          <Button variant="outline" size="sm" onClick={onSelectNone}>
            全不选
          </Button>
          <Button size="sm" onClick={onSelectAll}>
            全选
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
