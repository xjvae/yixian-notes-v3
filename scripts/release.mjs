/**
 * release.mjs — 「一闲笔记」发版脚本
 *
 * 作用：统一提升版本号并固化更新日志，做到「每次更新 / 修复 Bug 一次完成发版」。
 * 用法：
 *   node scripts/release.mjs patch      # 修复 Bug / 小优化（x.x.N+1）
 *   node scripts/release.mjs minor      # 新增功能      （x.(N+1).0）
 *   node scripts/release.mjs major      # 重大改动      （(N+1).0.0）
 *   node scripts/release.mjs 3.1.1      # 显式指定版本号
 *
 * 版本号真源：package.json。
 * 自动同步：package.json / package-lock.json / Cargo.toml / Cargo.lock / tauri.conf.json / CHANGELOG.md
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const AUTHOR = '梦一闲';

const paths = {
  pkg: join(ROOT, 'package.json'),
  pkgLock: join(ROOT, 'package-lock.json'),
  cargo: join(ROOT, 'src-tauri', 'Cargo.toml'),
  cargoLock: join(ROOT, 'src-tauri', 'Cargo.lock'),
  tauri: join(ROOT, 'src-tauri', 'tauri.conf.json'),
  changelog: join(ROOT, 'CHANGELOG.md'),
};

const read = (p) => readFileSync(p, 'utf8');
const save = (p, s) => writeFileSync(p, s, 'utf8');

function parseVersion(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(v).trim());
  if (!m) throw new Error(`无法解析版本号: ${v}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function bump(ver, kind) {
  let [ma, mi, pa] = parseVersion(ver);
  if (kind === 'major') { ma += 1; mi = 0; pa = 0; }
  else if (kind === 'minor') { mi += 1; pa = 0; }
  else if (kind === 'patch') { pa += 1; }
  else throw new Error(`未知的发布类型: ${kind}`);
  return `${ma}.${mi}.${pa}`;
}

const today = () => new Date().toISOString().slice(0, 10);

// 1) 解析目标版本号
const kindArg = process.argv[2] || 'patch';
const pkg = JSON.parse(read(paths.pkg));
const oldVersion = pkg.version;
const nextVersion = /^\d+\.\d+\.\d+$/.test(kindArg) ? kindArg : bump(oldVersion, kindArg);

// 2) 固化 CHANGELOG：把 [Unreleased] 落版本，并下放新的空白模板
const UNRELEASED_TPL = '## [Unreleased]\n\n### 新增\n- 待补充\n\n### 修复\n- 待补充\n';
{
  let md = read(paths.changelog);
  const re = /## \[Unreleased\][\s\S]*?(?=\n## \[|$)/;
  if (!re.test(md)) throw new Error('CHANGELOG.md 缺少 "## [Unreleased]" 区块');

  // Unreleased 内真实记录（去掉模板占位行）
  const growth = md
    .match(re)[0]
    .replace(/## \[Unreleased\]\s*\n/, '')
    .replace(/### 新增\n- 待补充\n\n### 修复\n- 待补充\n?/, '')
    .trim();

  const section = `## [${nextVersion}] - ${today()}\n\n### 变更\n${growth || '- 本次更新（补充到更新日志）。'}\n\n### 作者\n- ${AUTHOR}\n`;

  // 整体替换 Unreleased 区块为（新模板 + 本版 section），并把后续内容接上
  md = md.replace(re, `${UNRELEASED_TPL.trimEnd()}\n\n${section.trimEnd()}`);
  save(paths.changelog, md);
}

// 3) 同步各版本号文件
{
  // JSON：package.json 顶层 + package-lock.json（顶层和 root package）
  for (const key of ['pkg', 'pkgLock']) {
    const obj = JSON.parse(read(paths[key]));
    if (obj.name === 'yixian-notes-v3') obj.version = nextVersion;
    if (obj.packages?.[''] && obj.packages[''].name === 'yixian-notes-v3') {
      obj.packages[''].version = nextVersion;
    }
    save(paths[key], JSON.stringify(obj, null, 2) + '\n');
  }
  // Cargo.toml / Cargo.lock / tauri.conf.json（精准替换自身版本行）
  save(paths.cargo, read(paths.cargo).replace(/(^version = ")[^"]+(")/m, `$1${nextVersion}$2`));
  save(paths.cargoLock, read(paths.cargoLock).replace(/(name = "yixian-notes-v3"\nversion = )"[^"]+"/, `$1"${nextVersion}"`));
  save(paths.tauri, read(paths.tauri).replace(/(("version"\s*:\s*)")[^"]+(")/m, `$1${nextVersion}$3`));
}

console.log(`✅ 版本已更新：${oldVersion} → ${nextVersion}（作者：${AUTHOR}）`);
console.log('   已同步 package.json / package-lock.json / Cargo.toml / Cargo.lock / tauri.conf.json / CHANGELOG.md');
console.log('   提示：把本次改动补充到 CHANGELOG.md 的 [Unreleased] 区，下次发版会自动带上。');