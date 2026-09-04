import { useState, useCallback, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ScanText,
  History,
  Trash2,
  Copy,
  Check,
  Download,
  FileText,
  Clock,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import OcrTextEditor from '@/components/Ocr/OcrTextEditor';
import { type OcrResult } from '@/hooks/useOcr';
import { cn } from '@/lib/utils';

const HISTORY_KEY = '__app_yixian_ocr_history';
const MAX_HISTORY = 20;

function loadHistory(): OcrResult[] {
  try {
    const saved = localStorage.getItem(HISTORY_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    /* ignore */
  }
  return [];
}

function saveHistory(history: OcrResult[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    /* ignore */
  }
}

export default memo(function OcrPage() {
  const [history, setHistory] = useState<OcrResult[]>(() => loadHistory());
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(true);

  // Persist history
  useEffect(() => {
    saveHistory(history);
  }, [history]);

  // Handle new OCR result
  const handleResult = useCallback((result: OcrResult) => {
    setHistory((prev) => {
      // Avoid duplicates
      if (prev.some((r) => r.imagePreview === result.imagePreview)) {
        return prev;
      }
      return [result, ...prev].slice(0, MAX_HISTORY);
    });
  }, []);

  // Delete history item
  const handleDeleteHistory = useCallback((id: string) => {
    setHistory((prev) => prev.filter((r) => r.id !== id));
    if (selectedHistoryId === id) {
      setSelectedHistoryId(null);
    }
    toast.success('已删除记录');
  }, [selectedHistoryId]);

  // Clear all history
  const handleClearHistory = useCallback(() => {
    setHistory([]);
    setSelectedHistoryId(null);
    toast.success('已清空历史记录');
  }, []);

  // Copy history item text
  const handleCopyHistory = useCallback(async (item: OcrResult) => {
    try {
      await navigator.clipboard.writeText(item.text);
      setCopiedId(item.id);
      toast.success('已复制到剪贴板');
      setTimeout(() => setCopiedId((prev) => (prev === item.id ? null : prev)), 2000);
    } catch {
      toast.error('复制失败');
    }
  }, []);

  // Export all history
  const handleExportAll = useCallback(() => {
    if (history.length === 0) {
      toast.warning('没有可导出的记录');
      return;
    }

    const content = history
      .map((item, i) => {
        const date = new Date(item.createdAt).toLocaleString('zh-CN');
        return `[${i + 1}] ${date}\n语言: ${item.language}\n置信度: ${Math.round(item.confidence)}%\n\n${item.text}\n\n${'='.repeat(40)}`;
      })
      .join('\n\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ocr-history-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('已导出全部记录');
  }, [history]);

  // Selected history item
  const selectedItem = history.find((r) => r.id === selectedHistoryId);

  return (
    <div className="flex h-full gap-4 p-4">
      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Page Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <ScanText className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">OCR 文字识别</h1>
            <p className="text-xs text-muted-foreground">
              使用 Tesseract.js 进行纯前端文字识别，支持中英文
            </p>
          </div>
        </div>

        {/* Editor Card */}
        <div className="flex-1 rounded-xl border border-border bg-card p-5 shadow-sm overflow-y-auto">
          <OcrTextEditor onResult={handleResult} />
        </div>
      </div>

      {/* History Sidebar */}
      <div
        className={cn(
          'flex flex-col rounded-xl border border-border bg-card shadow-sm transition-all duration-300',
          showHistory ? 'w-72' : 'w-10',
        )}
      >
        {/* Sidebar Header */}
        <div className="flex items-center gap-2 px-3 py-3 border-b border-border shrink-0">
          {showHistory ? (
            <>
              <History className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground/80 flex-1">
                识别历史
              </span>
              <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full">
                {history.length}
              </span>
              <button
                type="button"
                className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                onClick={() => setShowHistory(false)}
                title="收起"
              >
                <ChevronRight className="size-3.5" />
              </button>
            </>
          ) : (
            <button
              type="button"
              className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground mx-auto"
              onClick={() => setShowHistory(true)}
              title="展开历史"
            >
              <History className="size-4" />
            </button>
          )}
        </div>

        {/* History Actions */}
        {showHistory && history.length > 0 && (
          <div className="flex items-center gap-1 px-3 py-2 border-b border-border/50 shrink-0">
            <button
              type="button"
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              onClick={handleExportAll}
              title="导出全部"
            >
              <Download className="size-3" />
              导出
            </button>
            <button
              type="button"
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              onClick={handleClearHistory}
              title="清空历史"
            >
              <Trash2 className="size-3" />
              清空
            </button>
          </div>
        )}

        {/* History List */}
        {showHistory && (
          <div className="flex-1 overflow-y-auto">
            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <Sparkles className="size-8 text-muted-foreground/20 mb-2" />
                <p className="text-xs text-muted-foreground/50">暂无识别记录</p>
                <p className="text-[10px] text-muted-foreground/30 mt-1">
                  上传图片开始识别
                </p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {history.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className={cn(
                      'group flex items-start gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors',
                      selectedHistoryId === item.id
                        ? 'bg-primary/10 border border-primary/20'
                        : 'hover:bg-muted/50 border border-transparent',
                    )}
                    onClick={() => setSelectedHistoryId(item.id)}
                  >
                    {item.imagePreview ? (
                      <img
                        src={item.imagePreview}
                        alt=""
                        className="size-8 rounded object-cover border border-border/50 shrink-0"
                      />
                    ) : (
                      <div className="size-8 rounded bg-muted/50 flex items-center justify-center shrink-0">
                        <FileText className="size-3.5 text-muted-foreground/50" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground/80 line-clamp-2 leading-relaxed">
                        {item.text.slice(0, 60) || '空内容'}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Clock className="size-2.5 text-muted-foreground/40" />
                        <span className="text-[10px] text-muted-foreground/40">
                          {new Date(item.createdAt).toLocaleString('zh-CN', {
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <span className="text-[10px] text-muted-foreground/30">
                          {Math.round(item.confidence)}%
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        type="button"
                        className="p-0.5 rounded hover:bg-muted transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyHistory(item);
                        }}
                        title="复制"
                      >
                        {copiedId === item.id ? (
                          <Check className="size-3 text-success" />
                        ) : (
                          <Copy className="size-3 text-muted-foreground" />
                        )}
                      </button>
                      <button
                        type="button"
                        className="p-0.5 rounded hover:bg-destructive/10 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteHistory(item.id);
                        }}
                        title="删除"
                      >
                        <Trash2 className="size-3 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Selected Item Preview */}
        <AnimatePresence>
          {showHistory && selectedItem && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-border overflow-hidden shrink-0"
            >
              <div className="p-3 max-h-40 overflow-y-auto">
                <p className="text-[10px] font-medium text-muted-foreground/60 mb-1.5 uppercase tracking-wider">
                  选中记录
                </p>
                <p className="text-xs text-foreground/70 leading-relaxed whitespace-pre-wrap">
                  {selectedItem.text.slice(0, 200)}
                  {selectedItem.text.length > 200 && '...'}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});
