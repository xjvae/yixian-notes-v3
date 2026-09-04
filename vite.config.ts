import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { pruneAssets } from './plugins/vite-plugin-prune-assets.mjs'

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), pruneAssets()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  build: {
    outDir: 'dist',
    // 生产环境关闭 sourcemap，减少体积
    sourcemap: mode === 'development',
    // 设置构建目标为现代浏览器，减少 polyfill
    target: 'es2020',
    // 启用 CSS 代码分割
    cssCodeSplit: true,
    // 最小化配置
    minify: 'esbuild',
    // 压缩报告
    reportCompressedSize: true,
    // chunk 大小警告阈值：项目含 mermaid、echarts 等懒加载的动态大库，
    // 这些库加载于独立 chunk（不进首屏主包），体积大属正常现象，故阈值放宽到 1MB
    chunkSizeWarningLimit: 1000,
    // 禁用模块预加载 polyfill，避免 Tauri WebView2 兼容性问题
    modulePreload: false,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        sticky: path.resolve(__dirname, "sticky.html"),
        popup: path.resolve(__dirname, "popup.html"),
      },
      output: {
        // 自定义 chunk 命名，便于缓存
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
        // 按库族拆分稳定 vendor，降低 main 主包首屏解析体积（文档§七性能优化）
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('framer-motion') || id.includes('motion-dom') || id.includes('motion-utils')) {
            return 'motion-vendor';
          }
          if (id.includes('lucide-react')) return 'icons-vendor';
          if (id.includes('date-fns')) return 'date-vendor';
          if (id.includes('sonner') || id.includes('react-hot-toast')) return 'toast-vendor';
          if (
            id.includes('/react/') || id.includes('/react-dom/') ||
            id.includes('react-router') || id.includes('/zustand/') ||
            id.includes('scheduler') || id.includes('react-is') ||
            id.includes('use-sync-external-store') || id.includes('object-assign') ||
            id.includes('prop-types') || id.includes('loose-envify')
          ) {
            return 'react-vendor';
          }
          return undefined;
        },
      },
      // 外部依赖（Tauri 环境下不需要打包）
      external: [],
    },
    // esbuild 优化配置
    esbuild: {
      // 生产环境移除 console.log 和 debugger
      drop: mode === 'production' ? ['console', 'debugger'] : [],
      // 移除注释
      legalComments: 'none',
      // 优化 JSX
      jsx: 'automatic',
    },
  },
  // 优化依赖预构建
  optimizeDeps: {
    // 预构建大型依赖，加速开发模式
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'zustand',
      'sonner',
      'framer-motion',
      'lucide-react',
      'date-fns',
    ],
    // 排除不需要预构建的大型库
    exclude: ['tesseract.js', 'mermaid', 'echarts'],
  },
  server: {
    port: 5173,
    strictPort: true,
    // 忽略 Rust 编译产物目录，避免 tauri dev 时 Vite 与 Cargo 同时写
    // src-tauri/target 触发文件监听冲突（EBUSY）
    watch: {
      ignored: ['**/src-tauri/target/**'],
    },
  },
}))