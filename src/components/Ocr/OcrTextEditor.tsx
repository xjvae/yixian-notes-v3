import { useState, useCallback, useRef, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClipboardPaste,
  Upload,
  Copy,
  Check,
  Loader2,
  Image as ImageIcon,
  X,
  FileText,
  Languages,
  Trash2,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { useOcr, type OcrLanguage, type OcrResult } from '@/hooks/useOcr';
import { cn } from '@/lib/utils';

interface OcrTextEditorProps {
  onResult?: (result: OcrResult) => void;
  className?: string;
}

const LANGUAGE_OPTIONS: { value: OcrLanguage; label: string }[] = [
  { value: 'chi_sim+eng', label: '中文简体 + 英文' },
  { value: 'chi_sim', label: '中文简体' },
  { value: 'chi_tra', label: '中文繁体' },
  { value: 'eng', label: '英文' },
];

export default memo(function OcrTextEditor({ onResult, className }: OcrTextEditorProps) {
  const { isProcessing, progress, result, error, recognize, reset, language, setLanguage } = useOcr({
    defaultLanguage: 'chi_sim+eng',
  });

  const [copied, setCopied] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [editedText, setEditedText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync result to edited text
  useEffect(() => {
    if (result) {
      setEditedText(result.text);
      onResult?.(result);
    }
  }, [result, onResult]);

  // Handle file selection
  const handleFileSelect = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        toast.warning('请选择图片文件');
        return;
      }

      // Show preview
      const reader = new FileReader();
      reader.onload = () => {
        setPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Run OCR
      const ocrResult = await recognize(file);
      if (ocrResult) {
        toast.success(`识别完成，置信度 ${Math.round(ocrResult.confidence)}%`);
      }
    },
    [recognize],
  );

  // Handle paste
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            handleFileSelect(file);
          }
          break;
        }
      }
    },
    [handleFileSelect],
  );

  // Handle drag and drop
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer?.types.includes('Files')) {
      e.preventDefault();
      setIsDraggingOver(true);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer?.types.includes('Files')) {
      e.preventDefault();
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDraggingOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDraggingOver(false);
      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;
      const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
      if (imageFiles.length === 0) {
        toast.warning('只支持图片文件');
        return;
      }
      handleFileSelect(imageFiles[0]);
    },
    [handleFileSelect],
  );

  // Copy result
  const handleCopy = useCallback(async () => {
    if (!editedText) return;
    try {
      await navigator.clipboard.writeText(editedText);
      setCopied(true);
      toast.success('已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('复制失败');
    }
  }, [editedText]);

  // Download result
  const handleDownload = useCallback(() => {
    if (!editedText) return;
    const blob = new Blob([editedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ocr-result-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('已下载识别结果');
  }, [editedText]);

  // Clear all
  const handleClear = useCallback(() => {
    reset();
    setPreviewImage(null);
    setEditedText('');
    setCopied(false);
  }, [reset]);

  // Progress label
  const getProgressLabel = (status: string): string => {
    switch (status) {
      case 'initializing':
        return '正在初始化...';
      case 'preprocessing':
        return '图片预处理中...';
      case 'recognizing text':
        return '文字识别中...';
      case 'done':
        return '识别完成';
      default:
        return status || '处理中...';
    }
  };

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Language Selector */}
      <div className="flex items-center gap-2">
        <Languages className="size-4 text-muted-foreground" />
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as OcrLanguage)}
          className={cn(
            'min-h-8 px-3 py-1 rounded-md text-sm',
            'bg-muted/50 border border-border text-foreground',
            'focus:outline-none focus:ring-1 focus:ring-primary/50',
            'cursor-pointer',
          )}
        >
          {LANGUAGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Image Upload Area */}
      <div
        className={cn(
          'relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 transition-all',
          isDraggingOver
            ? 'border-primary bg-primary/5 scale-[1.02]'
            : 'border-border hover:border-primary/40 hover:bg-muted/20',
          previewImage && 'p-3',
        )}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onPaste={handlePaste}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelect(file);
            e.target.value = '';
          }}
        />

        {previewImage ? (
          <div className="relative w-full">
            <img
              src={previewImage}
              alt="Preview"
              className="max-h-48 w-full object-contain rounded-lg border border-border/50"
            />
            {!isProcessing && (
              <button
                type="button"
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                onClick={() => {
                  setPreviewImage(null);
                  handleClear();
                }}
                title="移除图片"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        ) : (
          <>
            <ImageIcon className="size-10 text-muted-foreground/30" />
            <div className="text-center">
              <p className="text-sm text-foreground/70 font-medium">
                拖拽图片到此处，或
              </p>
              <p className="text-xs text-muted-foreground/50 mt-1">
                支持粘贴截图 (Ctrl+V)、点击上传
              </p>
            </div>
          </>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium',
              'bg-primary text-primary-foreground border border-primary-border',
              'hover-elevate active-elevate-2',
            )}
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
          >
            <Upload className="size-3.5" />
            上传图片
          </button>
          <button
            type="button"
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium',
              'bg-secondary text-secondary-foreground border border-secondary-border',
              'hover-elevate active-elevate-2',
            )}
            onClick={async () => {
              try {
                const items = await navigator.clipboard.read();
                for (const item of items) {
                  const imageType = item.types.find((t) => t.startsWith('image/'));
                  if (imageType) {
                    const blob = await item.getType(imageType);
                    const file = new File([blob], 'pasted-image.png', { type: imageType });
                    handleFileSelect(file);
                    return;
                  }
                }
                toast.warning('剪贴板中没有图片');
              } catch {
                toast.error('无法读取剪贴板，请直接粘贴 (Ctrl+V)');
              }
            }}
            disabled={isProcessing}
          >
            <ClipboardPaste className="size-3.5" />
            粘贴图片
          </button>
        </div>

        {/* Drag overlay */}
        {isDraggingOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-primary/10 rounded-xl pointer-events-none">
            <div className="text-sm text-primary font-medium">释放以识别图片</div>
          </div>
        )}
      </div>

      {/* Progress */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/50 border border-border"
          >
            <Loader2 className="size-4 text-primary animate-spin shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground/70 font-medium">
                {getProgressLabel(progress.status)}
              </p>
              <div className="mt-1.5 h-1.5 rounded-full bg-border overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.round(progress.progress * 100)}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
            <span className="text-xs text-muted-foreground shrink-0">
              {Math.round(progress.progress * 100)}%
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result Editor */}
      {(result || editedText) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-2"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              <span className="text-sm font-medium text-foreground/80">识别结果</span>
              {result && (
                <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full">
                  置信度 {Math.round(result.confidence)}%
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className={cn(
                  'p-1.5 rounded-md transition-colors',
                  'hover:bg-muted text-muted-foreground hover:text-foreground',
                )}
                onClick={handleCopy}
                title="复制结果"
              >
                {copied ? (
                  <Check className="size-3.5 text-success" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </button>
              <button
                type="button"
                className={cn(
                  'p-1.5 rounded-md transition-colors',
                  'hover:bg-muted text-muted-foreground hover:text-foreground',
                )}
                onClick={handleDownload}
                title="下载结果"
              >
                <Download className="size-3.5" />
              </button>
              <button
                type="button"
                className={cn(
                  'p-1.5 rounded-md transition-colors',
                  'hover:bg-destructive/10 text-muted-foreground hover:text-destructive',
                )}
                onClick={handleClear}
                title="清除"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>

          <textarea
            ref={textareaRef}
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            className={cn(
              'w-full min-h-[160px] p-3 rounded-lg text-sm leading-relaxed',
              'bg-muted/30 border border-border text-foreground',
              'placeholder:text-muted-foreground/40',
              'focus:outline-none focus:ring-1 focus:ring-primary/50',
              'resize-y font-mono',
            )}
            placeholder="识别结果将显示在这里..."
          />
        </motion.div>
      )}
    </div>
  );
});
