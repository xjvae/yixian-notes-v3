import { motion, AnimatePresence } from 'framer-motion';

interface WorkspaceTransitionProps {
  visible: boolean;
  workspaceName: string;
  workspaceColor: string;
  workspaceIcon: string;
  workspaceSlogan?: string;
  fromColor?: string;
}

export default function WorkspaceTransition({
  visible,
  workspaceName,
  workspaceColor,
  workspaceIcon,
  workspaceSlogan,
  fromColor,
}: WorkspaceTransitionProps) {
  const gradientFrom = fromColor ?? workspaceColor;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
          animate={{ opacity: 1, backdropFilter: 'blur(8px)' }}
          exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="fixed inset-0 z-[9998] flex items-center justify-center pointer-events-none overflow-hidden"
        >
          {/* 背景色渐变过渡层 */}
          <motion.div
            className="absolute inset-0"
            initial={{
              background: `radial-gradient(circle at 30% 40%, ${gradientFrom}25 0%, transparent 60%), radial-gradient(circle at 70% 60%, ${gradientFrom}15 0%, transparent 60%)`,
            }}
            animate={{
              background: `radial-gradient(circle at 50% 50%, ${workspaceColor}35 0%, transparent 70%), radial-gradient(circle at 20% 80%, ${workspaceColor}20 0%, transparent 50%)`,
            }}
            transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
          />

          {/* 内容：图标 + 名称 + 标语 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 20, filter: 'blur(8px)' }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              filter: 'blur(0px)',
            }}
            exit={{ opacity: 0, scale: 1.08, y: -10, filter: 'blur(6px)' }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex flex-col items-center gap-4 px-8"
          >
            <motion.div
              initial={{ scale: 0.7, rotate: -5 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
              className="size-20 rounded-xl flex items-center justify-center text-4xl shadow-xl backdrop-blur-sm"
              style={{ backgroundColor: `${workspaceColor}20`, color: workspaceColor }}
            >
              {workspaceIcon}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut', delay: 0.2 }}
              className="text-3xl font-bold tracking-wide"
              style={{ color: workspaceColor }}
            >
              {workspaceName}
            </motion.div>

            {workspaceSlogan && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut', delay: 0.35 }}
                className="text-sm text-muted-foreground/80 tracking-wider"
              >
                {workspaceSlogan}
              </motion.div>
            )}

            {/* 底部装饰线 */}
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
              className="mt-1 h-0.5 w-16 rounded-full origin-left"
              style={{ backgroundColor: workspaceColor }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
