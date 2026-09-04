import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import AppLogo from '@/components/AppLogo';

interface WelcomeStepProps {
  onNext: () => void;
  onSkip: () => void;
}

export default function WelcomeStep(_props: WelcomeStepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center px-8 py-10 text-center"
    >
      {/* 装饰插画区域 */}
      <div className="relative w-28 h-28 mb-6">
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/20 via-accent to-background" />
        <div className="absolute inset-3 rounded-2xl bg-gradient-to-br from-primary/10 to-accent flex items-center justify-center">
          <Sparkles className="size-10 text-primary" />
        </div>
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-1 -right-1"
        >
          <AppLogo size={32} />
        </motion.div>
      </div>

      <h2 className="text-2xl font-bold text-foreground mb-2">欢迎来到一闲笔记</h2>
      <p className="text-muted-foreground max-w-md leading-relaxed">
        一款温润雅致的桌面笔记工具，让记录成为一种享受。
        <br />
        用一分钟，定制属于你的笔记空间。
      </p>
    </motion.div>
  );
}
