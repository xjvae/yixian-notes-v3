/**
 * vite 构建优化插件 —— 产物体积精简
 *
 * 负责在构建后对 dist 做一次安全瘦身：
 *  1. 移除 KaTeX 冗余字体格式(.ttf / .woff)，仅保留现代浏览器通用的 .woff2。
 *     说明：项目实际引用的 KaTeX CSS 发出的字体 URL 指向不存在的 fonts/ 目录，
 *     assets/ttf 与 assets/woff 属不可达的重复体积，删除不影响渲染。
 *  2. （可选）调用 size-report 输出一份 `体积/性能报告`，用于度量优化效果。
 */
import { accessSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('..', import.meta.url));

/** 从某个数学库样式中仅保留 woff2，剔除其后的 woff/ttf 回退，避免无意义 404。 */
function keepWoff2Only(css) {
  // @font-face src 形如：url(fonts/x.woff2) format("woff2"),url(fonts/x.woff) format("woff"),url(fonts/x.ttf) format("truetype")
  // 保留 woff2，去掉剩余的 woff / ttf 候选格式。
  return css
    // 用正则移除每条 src 列表中 woff/ttf 部分(以非 woff2 的 url(...) format(...) 为单元)
    .replace(/,url\([^)]*?\.woff\)\s*format\([^)]*?\)/g, '')
    .replace(/,url\([^)]*?\.ttf\)\s*format\([^)]*?\)/g, '')
    .replace(/^url\([^)]*?\.ttf\)\s*format\([^)]*?\),/g, '');
}

export function pruneAssets({ pruneFonts = true } = {}) {
  let outDir;
  return {
    name: 'prune-assets',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      if (!outDir) return;
      if (pruneFonts) {
        // 1) 移除不可达的 ttf / woff 字体文件，仅保留通用 woff2
        for (const ext of ['ttf', 'woff']) {
          const dir = join(rootDir, outDir, 'assets', ext);
          try {
            accessSync(dir);
            rmSync(dir, { recursive: true, force: true });
          } catch {
            /* 目录不存在则跳过 */
          }
        }
        // 2) 同步剥离产物 CSS 中指向 woff/ttf 的 @font-face 候选格式
        const cssDir = join(rootDir, outDir, 'assets', 'css');
        try {
          for (const name of readdirSync(cssDir)) {
            if (extname(name) !== '.css') continue;
            const full = join(cssDir, name);
            const raw = readFileSync(full, 'utf8');
            const next = keepWoff2Only(raw);
            if (next !== raw) writeFileSync(full, next, 'utf8');
          }
        } catch {
          /* css 目录不存在则跳过 */
        }
      }
    },
  };
}