import { useState, useCallback, useRef, useEffect } from 'react';
import type { Worker } from 'tesseract.js';
import { genId } from '@/lib/id';

export type OcrLanguage = 'chi_sim' | 'chi_tra' | 'eng' | 'chi_sim+eng';

export interface OcrProgress {
  status: string;
  progress: number;
}

export interface OcrResult {
  id: string;
  text: string;
  confidence: number;
  language: OcrLanguage;
  imagePreview: string;
  createdAt: number;
}

interface UseOcrOptions {
  defaultLanguage?: OcrLanguage;
  onProgress?: (progress: OcrProgress) => void;
  onError?: (error: Error) => void;
}

interface UseOcrReturn {
  isInitialized: boolean;
  isProcessing: boolean;
  progress: OcrProgress;
  result: OcrResult | null;
  error: string | null;
  recognize: (image: string | File | Blob, language?: OcrLanguage) => Promise<OcrResult | null>;
  reset: () => void;
  setLanguage: (lang: OcrLanguage) => void;
  language: OcrLanguage;
}

export function useOcr(options: UseOcrOptions = {}): UseOcrReturn {
  const { defaultLanguage = 'chi_sim+eng', onProgress, onError } = options;

  const [isInitialized, setIsInitialized] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<OcrProgress>({ status: '', progress: 0 });
  const [result, setResult] = useState<OcrResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<OcrLanguage>(defaultLanguage);

  const workerRef = useRef<Worker | null>(null);
  const initPromiseRef = useRef<Promise<Worker> | null>(null);

  // Initialize Tesseract worker
  const initWorker = useCallback(async (lang: OcrLanguage): Promise<Worker> => {
    if (workerRef.current && isInitialized) {
      return workerRef.current;
    }

    if (initPromiseRef.current) {
      return initPromiseRef.current;
    }

    initPromiseRef.current = (async () => {
      const { default: Tesseract } = await import('tesseract.js');
      const worker = await Tesseract.createWorker(lang, 1, {
        logger: (m: { status: string; progress?: number }) => {
          if (m.status === 'recognizing text' || m.status.includes('loading')) {
            setProgress({
              status: m.status,
              progress: m.progress || 0,
            });
            onProgress?.({
              status: m.status,
              progress: m.progress || 0,
            });
          }
        },
      });

      workerRef.current = worker;
      setIsInitialized(true);
      return worker;
    })();

    return initPromiseRef.current;
  }, [isInitialized, onProgress]);

  // Auto-initialize on mount
  useEffect(() => {
    initWorker(language).catch((err: unknown) => {
      const errorMsg = err instanceof Error ? err.message : 'OCR initialization failed';
      setError(errorMsg);
      onError?.(err instanceof Error ? err : new Error(errorMsg));
    });

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      initPromiseRef.current = null;
      setIsInitialized(false);
    };
  }, []);

  // Preprocess image (grayscale + binarization)
  const preprocessImage = useCallback((imageDataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imageDataUrl);
          return;
        }

        ctx.drawImage(img, 0, 0);

        // Apply grayscale preprocessing
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
          const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
          // Simple binarization with threshold
          const threshold = 128;
          const val = avg > threshold ? 255 : 0;
          data[i] = val;
          data[i + 1] = val;
          data[i + 2] = val;
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(imageDataUrl);
      img.src = imageDataUrl;
    });
  }, []);

  // Convert File/Blob to data URL
  const fileToDataUrl = useCallback((file: File | Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Image read failed'));
      reader.readAsDataURL(file);
    });
  }, []);

  // Main recognize function
  const recognize = useCallback(
    async (image: string | File | Blob, lang?: OcrLanguage): Promise<OcrResult | null> => {
      setIsProcessing(true);
      setError(null);
      setProgress({ status: 'initializing', progress: 0 });

      try {
        const targetLang = lang || language;

        // Initialize worker if needed
        const worker = await initWorker(targetLang);

        // Convert image to data URL if needed
        let imageDataUrl: string;
        if (typeof image === 'string') {
          imageDataUrl = image;
        } else {
          imageDataUrl = await fileToDataUrl(image);
        }

        // Preprocess image
        setProgress({ status: 'preprocessing', progress: 0 });
        const processedImage = await preprocessImage(imageDataUrl);

        // Perform OCR
        setProgress({ status: 'recognizing text', progress: 0 });
        const {
          data: { text, confidence },
        } = await worker.recognize(processedImage);

        const ocrResult: OcrResult = {
          id: genId('ocr', 5),
          text: text.trim(),
          confidence: confidence || 0,
          language: targetLang,
          imagePreview: imageDataUrl,
          createdAt: Date.now(),
        };

        setResult(ocrResult);
        setProgress({ status: 'done', progress: 1 });
        return ocrResult;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'OCR recognition failed';
        setError(errorMsg);
        onError?.(err instanceof Error ? err : new Error(errorMsg));
        return null;
      } finally {
        setIsProcessing(false);
      }
    },
    [language, initWorker, fileToDataUrl, preprocessImage, onError],
  );

  // Reset state
  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setProgress({ status: '', progress: 0 });
  }, []);

  return {
    isInitialized,
    isProcessing,
    progress,
    result,
    error,
    recognize,
    reset,
    setLanguage,
    language,
  };
}
