/**
 * 构建产物体积 / 性能关键指标报告工具（零外部依赖，仅用 Node 内置模块）。
 *
 * 用途：作为「性能监控」工具，记录优化前后 dist 的关键指标，便于验证效果。
 *
 * 主要输出：
 *  - 总大小 / JS / CSS / 字体 / 其它
 *  - 启动首屏 JS（main + 头部独立 vendor chunk）总大小
 *  - 体积最大的 15 个 chunk（含未压缩 gzip 估算）
 *  - 以 JSON 形式写入 dist/size-report.json，便于 CI / 对比
 *
 * 用法：
 *  - node scripts/size-report.mjs [dist目录] [输出JSON路径]
 *  - 默认 dist 目录为项目根 /dist，输出到 /dist/size-report.json
 */
import { readdirSync, statSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const root = fileURLToPath(new URL('..', import.meta.url));
const distDir = process.argv[2] || join(root, 'dist');
const reportPath =
  process.argv[3] || join(root, 'performance', 'size-report.json');

mkdirSync(join(root, 'performance'), { recursive: true });

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else out.push({ path: p, size: st.size });
  }
  return out;
}

function bytesToKB(bytes) {
  return Number((bytes / 1024).toFixed(1));
}

function gzipKB(file) {
  const buf = readFileBytesSafe(file);
  if (!buf) return 0;
  return Number((zlib.gzipSync(buf).length / 1024).toFixed(1));
}

function readFileBytesSafe(p) {
  try {
    return readFileSync(p);
  } catch {
    return null;
  }
}

if (!existsSync(distDir)) {
  console.error('[size-report] dist 目录不存在: ' + distDir);
  process.exit(1);
}

const all = walk(distDir);
const byExt = {};
for (const f of all) {
  const key = extname(f.path) || '(none)';
  byExt[key] = (byExt[key] || 0) + f.size;
}

const jsTotal = Object.entries(byExt).reduce((s, [k, v]) => (k === '.js' ? s + v : s), 0);
const cssTotal = Object.entries(byExt).reduce((s, [k, v]) => (k === '.css' ? s + v : s), 0);
const fontTotal = Object.entries(byExt).reduce(
  (s, [k, v]) => (['.woff2', '.woff', '.ttf', '.eot'].includes(k) ? s + v : s),
  0,
);

// 启动关键 chunk：main 入口 + 常驻独立 vendor（React/图标/动效/日期）
const STARTUP_PREFIXES = ['main-', 'react-vendor-', 'icons-vendor-', 'motion-vendor-', 'date-vendor-'];
const jsFiles = all.filter((f) => extname(f.path) === '.js');
const startup = jsFiles
  .filter((f) => STARTUP_PREFIXES.some((p) => basename(f.path).startsWith(p)))
  .sort((a, b) => b.size - a.size);

const topChunks = [...jsFiles].sort((a, b) => b.size - a.size).slice(0, 15);

const total = all.reduce((s, f) => s + f.size, 0);

const report = {
  generatedAt: new Date().toISOString(),
  totalBytes: total,
  totalKB: bytesToKB(total),
  fileCount: all.length,
  byCategoryKB: {
    js: bytesToKB(jsTotal),
    css: bytesToKB(cssTotal),
    fonts: bytesToKB(fontTotal),
  },
  startupJSKB: bytesToKB(startup.reduce((s, f) => s + f.size, 0)),
  startupCount: startup.length,
  biggestChunks: topChunks.map((f) => ({
    file: basename(f.path),
    kb: bytesToKB(f.size),
    gzipKB: gzipKB(f.path),
  })),
  categoryFiles: Object.entries(byExt)
    .sort((a, b) => b[1] - a[1])
    .map(([ext, size]) => ({ ext, kb: bytesToKB(size) })),
};

writeFileSync(reportPath, JSON.stringify(report, null, 2));

// 控制台概览
const line = '-'.repeat(56);
console.log(`\n${line}`);
console.log('  构建产物 —— 体积 / 性能报告');
console.log(line);
console.log(`  总大小        : ${report.totalKB} KB  (${report.fileCount} 个文件)`);
console.log(`  JS            : ${report.byCategoryKB.js} KB`);
console.log(`  CSS           : ${report.byCategoryKB.css} KB`);
console.log(`  字体          : ${report.byCategoryKB.fonts} KB`);
console.log(`  启动关键 JS   : ${report.startupJSKB} KB  (${report.startupCount} 个 chunk)`);
console.log(line);
console.log('  启动关键 chunk:');
for (const f of startup) {
  console.log(`    - ${basename(f.path).padEnd(42)} ${bytesToKB(f.size)} KB`);
}
console.log(line);
console.log(`  报告已写出: ${reportPath}\n`);