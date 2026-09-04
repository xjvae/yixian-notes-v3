import { memo, useCallback, useEffect } from 'react';
import { X, ZoomIn, ZoomOut } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { useState } from 'react';
import { Image } from '@/components/ui/image';

interface ImageLightboxProps {
  src: string;
  alt?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default memo(function ImageLightbox({ src, alt, open, onOpenChange }: ImageLightboxProps) {
  const [zoom, setZoom] = useState(1);

  const handleZoomIn = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setZoom((z) => Math.min(z + 0.25, 3));
  }, []);

  const handleZoomOut = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setZoom((z) => Math.max(z - 0.25, 0.3));
  }, []);

  // 重置缩放
  useEffect(() => {
    if (open) {
      setZoom(1);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[90vh] p-0 border-0 bg-transparent shadow-none">
        <DialogTitle className="sr-only">图片预览</DialogTitle>
        <DialogClose className="absolute right-3 top-3 z-10 size-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors">
          <X className="size-4" />
        </DialogClose>

        <div className="relative w-full h-full flex items-center justify-center">
          {/* 缩放控制 */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-black/50 rounded-full p-1">
            <button
              type="button"
              className="size-7 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              onClick={handleZoomOut}
            >
              <ZoomOut className="size-4" />
            </button>
            <span className="text-white text-xs min-w-[48px] text-center font-mono">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              className="size-7 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              onClick={handleZoomIn}
            >
              <ZoomIn className="size-4" />
            </button>
          </div>

          {/* 图片 */}
          <div
            className="flex items-center justify-center overflow-auto max-h-[85vh] max-w-full"
            onClick={() => onOpenChange(false)}
          >
            <Image
              src={src}
              alt={alt || '图片预览'}
              className="max-w-full max-h-[85vh] object-contain rounded-md transition-transform duration-200 cursor-zoom-out"
              style={{ transform: `scale(${zoom})` }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});
