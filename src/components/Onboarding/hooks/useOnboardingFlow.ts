import { useState, useCallback, useMemo, useEffect } from 'react';
import { STEPS } from '../data/steps';
import {
  FEATURE_MODULES,
} from '@/data/onboarding-features';

interface UseOnboardingFlowProps {
  open: boolean;
  activeWorkspaceId: string;
  currentTheme: string;
  currentMode: 'light' | 'dark' | 'system';
  currentFontSize: 'small' | 'medium' | 'large';
}

export function useOnboardingFlow({
  open,
  activeWorkspaceId,
  currentTheme,
  currentMode,
  currentFontSize,
}: UseOnboardingFlowProps) {
  const [stepIdx, setStepIdx] = useState(0);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(activeWorkspaceId);
  const [newDialogOpen, setNewDialogOpen] = useState(false);

  // 功能：默认全部开启的是 defaultEnabled=true 的
  const defaultEnabledIds = useMemo(
    () => FEATURE_MODULES.filter((m) => m.defaultEnabled).map((m) => m.id),
    [],
  );
  const [enabledFeatures, setEnabledFeatures] = useState<Set<string>>(
    () => new Set(defaultEnabledIds),
  );

  // 外观
  const [themePack, setThemePack] = useState(currentTheme);
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>(currentMode);
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>(currentFontSize);

  const [dontShowAgain, setDontShowAgain] = useState(true);
  const [liteMode, setLiteMode] = useState(false);

  // 重置到第一步
  useEffect(() => {
    if (open) {
      setStepIdx(0);
      setSelectedWorkspaceId(activeWorkspaceId);
      setEnabledFeatures(new Set(defaultEnabledIds));
      setThemePack(currentTheme);
      setThemeMode(currentMode);
      setFontSize(currentFontSize);
    }
  }, [open, activeWorkspaceId, currentTheme, currentMode, currentFontSize, defaultEnabledIds]);

  const goNext = useCallback(() => {
    if (stepIdx < STEPS.length - 1) {
      setStepIdx((i) => i + 1);
    }
  }, [stepIdx]);

  const goPrev = useCallback(() => {
    if (stepIdx > 0) {
      setStepIdx((i) => i - 1);
    }
  }, [stepIdx]);

  const toggleFeature = useCallback((id: string) => {
    setEnabledFeatures((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setEnabledFeatures(new Set(FEATURE_MODULES.map((m) => m.id)));
  }, []);

  const selectNone = useCallback(() => {
    setEnabledFeatures(new Set());
  }, []);

  const selectDefault = useCallback(() => {
    setEnabledFeatures(new Set(defaultEnabledIds));
  }, [defaultEnabledIds]);

  return {
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
  };
}
