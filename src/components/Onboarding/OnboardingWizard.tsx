import { useCallback, useMemo, useEffect, memo } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  ArrowLeft,
  X,
  PartyPopper,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { THEME_PACKS } from '@/lib/themes';
import type { IWorkspace } from '@/data/notes';
import { useOnboardingFlow } from './hooks/useOnboardingFlow';
import StepIndicator from './StepIndicator';
import WelcomeStep from './steps/WelcomeStep';
import WorkspaceStep, { NewWorkspaceDialog } from './steps/WorkspaceStep';
import FeaturesStep from './steps/FeaturesStep';
import AppearanceStep from './steps/AppearanceStep';
import CompleteStep from './steps/CompleteStep';

// ========== 导出接口 ==========
interface OnboardingWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaces: IWorkspace[];
  activeWorkspaceId: string;
  currentTheme: string;
  currentMode: 'light' | 'dark' | 'system';
  currentFontSize: 'small' | 'medium' | 'large';
  onComplete: (config: OnboardingConfig) => void;
  onCreateWorkspace: (data: NewWorkspaceData) => string;
  /**
   * 全屏模式：不使用 Dialog 遮罩，直接占满整个视口。
   * 用于首次启动场景，避免主窗口先渲染再被盖住。
   */
  fullScreen?: boolean;
}

export interface OnboardingConfig {
  workspaceId: string;
  enabledFeatures: string[];
  themePack: string;
  themeMode: 'light' | 'dark' | 'system';
  fontSize: 'small' | 'medium' | 'large';
  dontShowAgain: boolean;
  liteMode: boolean;
}

export interface NewWorkspaceData {
  name: string;
  description: string;
  themeKey: import('@/data/notes').WorkspaceThemeKey;
  template: import('@/data/notes').WorkspaceTemplateKey;
}

// ========== 主组件 ==========
export default memo(function OnboardingWizard({
  open,
  onOpenChange,
  workspaces,
  activeWorkspaceId,
  currentTheme,
  currentMode,
  currentFontSize,
  onComplete,
  onCreateWorkspace,
  fullScreen = false,
}: OnboardingWizardProps) {
  const {
    stepIdx,
    selectedWorkspaceId,
    setSelectedWorkspaceId,
    newDialogOpen,
    setNewDialogOpen,
    enabledFeatures,
    themePack,
    setThemePack,
    themeMode,
    setThemeMode,
    fontSize,
    setFontSize,
    dontShowAgain,
    setDontShowAgain,
    liteMode,
    setLiteMode,
    goNext,
    goPrev,
    toggleFeature,
    selectAll,
    selectNone,
    selectDefault,
  } = useOnboardingFlow({
    open,
    activeWorkspaceId,
    currentTheme,
    currentMode,
    currentFontSize,
  });

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onOpenChange]);

  const handleFinish = useCallback(() => {
    onComplete({
      workspaceId: selectedWorkspaceId,
      enabledFeatures: Array.from(enabledFeatures),
      themePack,
      themeMode,
      fontSize,
      dontShowAgain,
      liteMode,
    });
    onOpenChange(false);
    toast.success('欢迎来到一闲笔记！');
  }, [
    selectedWorkspaceId,
    enabledFeatures,
    themePack,
    themeMode,
    fontSize,
    dontShowAgain,
    liteMode,
    onComplete,
    onOpenChange,
  ]);

  const handleCreateWorkspace = useCallback(
    (data: NewWorkspaceData) => {
      const id = onCreateWorkspace(data);
      setSelectedWorkspaceId(id);
      setNewDialogOpen(false);
      toast.success(`工作区「${data.name}」已创建`);
    },
    [onCreateWorkspace, setSelectedWorkspaceId, setNewDialogOpen],
  );

  const selectedTheme = useMemo(
    () => THEME_PACKS.find((t) => t.id === themePack) ?? THEME_PACKS[0],
    [themePack],
  );
  const selectedWorkspace = useMemo(
    () => workspaces.find((w) => w.id === selectedWorkspaceId),
    [workspaces, selectedWorkspaceId],
  );

  const activeWorkspaces = useMemo(
    () => workspaces.filter((w) => !w.archived),
    [workspaces],
  );

  // 引导卡片主体（内部内容一致，外层包装不同）
  const wizardCard = (
    <div className="w-full max-w-[720px] overflow-hidden bg-background border border-border/40 shadow-2xl rounded-xl">
      {/* 顶部进度 + 关闭 */}
      <div className="relative px-6 pt-5 pb-3 border-b border-border/50">
        <button
          type="button"
          className="absolute right-4 top-4 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          onClick={() => onOpenChange(false)}
          aria-label="关闭"
        >
          <X className="size-4" />
        </button>

        {/* 步骤指示器 */}
        <StepIndicator currentStep={stepIdx} />
      </div>

      {/* 步骤内容 */}
      <div className="relative min-h-[440px] overflow-hidden">
        <AnimatePresence mode="wait">
          {stepIdx === 0 && (
            <WelcomeStep key="welcome" onNext={goNext} onSkip={() => onOpenChange(false)} />
          )}
          {stepIdx === 1 && (
            <WorkspaceStep
              key="workspace"
              workspaces={activeWorkspaces}
              selectedId={selectedWorkspaceId}
              onSelect={setSelectedWorkspaceId}
              onNew={() => setNewDialogOpen(true)}
            />
          )}
          {stepIdx === 2 && (
            <FeaturesStep
              key="features"
              enabled={enabledFeatures}
              onToggle={toggleFeature}
              onSelectAll={selectAll}
              onSelectNone={selectNone}
              onDefault={selectDefault}
            />
          )}
          {stepIdx === 3 && (
            <AppearanceStep
              key="appearance"
              themePack={themePack}
              onThemePack={setThemePack}
              themeMode={themeMode}
              onThemeMode={setThemeMode}
              fontSize={fontSize}
              onFontSize={setFontSize}
            />
          )}
          {stepIdx === 4 && (
            <CompleteStep
              key="finish"
              workspace={selectedWorkspace}
              enabledCount={enabledFeatures.size}
              themeName={selectedTheme.name}
              themeMode={themeMode}
              dontShowAgain={dontShowAgain}
              onDontShowAgain={setDontShowAgain}
              liteMode={liteMode}
              onLiteMode={setLiteMode}
            />
          )}
        </AnimatePresence>
      </div>

      {/* 底部操作栏 */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-border/50 bg-muted/30">
        <div>
          {stepIdx === 0 && (
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => onOpenChange(false)}
            >
              跳过引导，使用默认设置
            </button>
          )}
          {stepIdx > 0 && stepIdx < 4 && (
            <Button variant="ghost" size="sm" onClick={goPrev}>
              <ArrowLeft className="size-4 mr-1" />
              上一步
            </Button>
          )}
        </div>
        <div>
          {stepIdx < 4 && (
            <Button onClick={goNext} disabled={stepIdx === 1 && !selectedWorkspaceId}>
              {stepIdx === 0 ? '开始设置' : '下一步'}
              <ArrowRight className="size-4 ml-1" />
            </Button>
          )}
          {stepIdx === 4 && (
            <Button onClick={handleFinish} className="min-w-[140px]">
              <PartyPopper className="size-4 mr-1.5" />
              开始使用
            </Button>
          )}
        </div>
      </div>

      {/* 新建工作区对话框 */}
      <NewWorkspaceDialog
        open={newDialogOpen}
        onOpenChange={setNewDialogOpen}
        onConfirm={handleCreateWorkspace}
      />
    </div>
  );

  // 全屏模式：直接占满视口，无 Dialog 遮罩
  if (fullScreen) {
    if (!open) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/20">
        {/* 装饰光斑 */}
        <div className="absolute top-1/4 left-1/4 size-96 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 size-80 rounded-full bg-accent/30 blur-3xl pointer-events-none" />
        {wizardCard}
      </div>
    );
  }

  // 普通模式：Dialog 遮罩覆盖主窗口
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[720px] p-0 overflow-hidden bg-background border-0 shadow-2xl"
        showCloseButton={false}
        onInteractOutside={(e: Event) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">启动引导</DialogTitle>
        <DialogDescription className="sr-only">
          选择工作区和功能，定制你的一闲笔记
        </DialogDescription>
        {wizardCard}
      </DialogContent>
    </Dialog>
  );
});
