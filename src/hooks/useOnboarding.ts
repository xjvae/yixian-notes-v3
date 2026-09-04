// 引导流程 + 功能权限管理 Hook
import { useState, useCallback, useEffect } from "react";
import { FEATURE_MODULES } from "@/data/onboarding-features";
import { ONBOARDED_KEY, ENABLED_FEATURES_KEY } from "./useWorkspaceStorage";
import type { OnboardingConfig, NewWorkspaceData } from "@/components/Onboarding/OnboardingWizard";
import type { IWorkspace } from "@/data/notes";

export function useOnboarding(workspaces: IWorkspace[]) {
  // 引导显示状态：true = 显示全屏引导页
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    return localStorage.getItem(ONBOARDED_KEY) !== "true";
  });

  // 启用的功能模块
  const [enabledFeatures, setEnabledFeatures] = useState<Set<string>>(() => {
    const defaultIds = FEATURE_MODULES.filter((m) => m.defaultEnabled).map((m) => m.id);
    const stored = localStorage.getItem(ENABLED_FEATURES_KEY);
    if (stored) {
      try {
        const storedIds = JSON.parse(stored) as string[];
        return new Set([...storedIds, ...defaultIds]);
      } catch {
        // ignore
      }
    }
    return new Set(defaultIds);
  });

  // Ctrl+Shift+O 唤起启动引导
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        setShowOnboarding((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // 持久化启用的功能模块
  useEffect(() => {
    localStorage.setItem(ENABLED_FEATURES_KEY, JSON.stringify(Array.from(enabledFeatures)));
  }, [enabledFeatures]);

  // 引导完成处理
  const handleOnboardingComplete = useCallback(
    (config: OnboardingConfig) => {
      // 1. 启用的功能模块
      setEnabledFeatures(new Set(config.enabledFeatures));
      // 2. 标记已完成引导
      localStorage.setItem(ONBOARDED_KEY, "true");
      // 3. 关闭引导页，显示主窗口
      setShowOnboarding(false);
    },
    [],
  );

  // 创建工作区（引导内使用）
  const handleCreateWorkspaceFromOnboarding = useCallback(
    (_data: NewWorkspaceData): string => {
      const now = Date.now();
      const newId = `ws${now}`;
      return newId;
    },
    [workspaces.length],
  );

  return {
    showOnboarding,
    setShowOnboarding,
    enabledFeatures,
    setEnabledFeatures,
    handleOnboardingComplete,
    handleCreateWorkspaceFromOnboarding,
  };
}
