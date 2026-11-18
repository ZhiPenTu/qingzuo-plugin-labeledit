#!/usr/bin/env node
// 清理可再生的插件构建产物。默认只清 Python 缓存，旧插件包需显式加 --releases。
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releaseDir = path.join(root, 'release');
const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(name);
const optionValue = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const dryRun = hasFlag('--dry-run');
const deep = hasFlag('--deep');
const pruneReleases = hasFlag('--releases');
const keepReleases = Math.max(1, Number(optionValue('--keep-releases', '2')) || 1);

if (hasFlag('--help') || hasFlag('-h')) {
  console.log(`用法：node scripts/clean-build-cache.mjs [选项]

默认清理：
  __pycache__、.pytest_cache、.ruff_cache、.mypy_cache

选项：
  --releases             清理 release/ 中的旧 .ecplugin，每个平台/架构保留最近 2 个版本
  --keep-releases <数量> 保留版本数，默认 2
  --deep                 同时删除 build、dist 和 release/plugin 打包暂存目录
  --dry-run              只列出将要删除的内容和大小
  --help                 显示本帮助

始终保留：
  .venv、.venv-packaging、.models、node_modules、release/plugin 当前目录和最新插件包。`);
  process.exit(0);
}

function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function pathSize(target) {
  let total = 0;
  const stack = [target];
  const seenInodes = new Set();
  while (stack.length > 0) {
    const current = stack.pop();
    let entry;
    try {
      entry = fs.lstatSync(current);
    } catch {
      continue;
    }
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      let children = [];
      try {
        children = fs.readdirSync(current);
      } catch {
        continue;
      }
      for (const child of children) stack.push(path.join(current, child));
    } else if (entry.isFile()) {
      if (entry.nlink > 1) {
        const inode = `${entry.dev}:${entry.ino}`;
        if (seenInodes.has(inode)) continue;
        seenInodes.add(inode);
      }
      total += typeof entry.blocks === 'number' && entry.blocks > 0
        ? entry.blocks * 512
        : entry.size;
    }
  }
  return total;
}

function remove(target, label = target) {
  const bytes = pathSize(target);
  console.log(`${dryRun ? '将删除' : '删除'} ${label} (${formatBytes(bytes)})`);
  if (!dryRun) fs.rmSync(target, { recursive: true, force: true });
  return bytes;
}

function collectPythonCaches(directory, results) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (['.git', '.venv', '.venv-packaging', '.models', 'node_modules'].includes(entry.name)) {
      continue;
    }
    const fullPath = path.join(directory, entry.name);
    if (['__pycache__', '.pytest_cache', '.ruff_cache', '.mypy_cache'].includes(entry.name)) {
      results.push(fullPath);
      continue;
    }
    collectPythonCaches(fullPath, results);
  }
}

function parseVersion(version) {
  const [main, ...rest] = version.split('-');
  const numbers = main.split('.').map((part) => Number.parseInt(part, 10) || 0);
  while (numbers.length < 3) numbers.push(0);
  return {
    numbers: numbers.slice(0, 3),
    prerelease: rest.length > 0 ? rest.join('-').split('.') : [],
  };
}

function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let index = 0; index < 3; index += 1) {
    if (a.numbers[index] !== b.numbers[index]) return a.numbers[index] - b.numbers[index];
  }
  if (a.prerelease.length === 0 && b.prerelease.length > 0) return 1;
  if (a.prerelease.length > 0 && b.prerelease.length === 0) return -1;
  const length = Math.max(a.prerelease.length, b.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = a.prerelease[index];
    const rightPart = b.prerelease[index];
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    if (leftPart === rightPart) continue;
    const leftNumber = Number(leftPart);
    const rightNumber = Number(rightPart);
    if (Number.isNaN(leftNumber) || Number.isNaN(rightNumber)) {
      return leftPart.localeCompare(rightPart);
    }
    return leftNumber - rightNumber;
  }
  return 0;
}

const artifactPattern = /^(?<product>.+?)-(?<version>\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)-(?<platform>darwin|win32|linux)-(?<arch>[0-9A-Za-z]+)\.ecplugin$/;

function releasePlan() {
  if (!fs.existsSync(releaseDir)) return [];
  const groups = new Map();
  for (const entry of fs.readdirSync(releaseDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const match = entry.name.match(artifactPattern);
    if (!match) continue;
    const key = `${match.groups.product}|${match.groups.platform}|${match.groups.arch}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({
      name: entry.name,
      version: match.groups.version,
      path: path.join(releaseDir, entry.name),
    });
  }

  const keptByGroup = new Map();
  for (const [key, files] of groups.entries()) {
    const versions = [...new Set(files.map((file) => file.version))]
      .sort((left, right) => compareVersions(right, left))
      .slice(0, keepReleases);
    keptByGroup.set(key, new Set(versions));
  }

  const removals = [];
  for (const [key, files] of groups.entries()) {
    const keptVersions = keptByGroup.get(key);
    for (const file of files) {
      if (!keptVersions.has(file.version)) removals.push(file.path);
    }
  }
  return removals;
}

let totalBytes = 0;
const failures = [];

console.log('清理 Python 缓存：');
const pythonCaches = [];
collectPythonCaches(root, pythonCaches);
if (pythonCaches.length === 0) {
  console.log('  没有找到 Python 缓存。');
} else {
  for (const target of pythonCaches) {
    try {
      totalBytes += remove(target, path.relative(root, target));
    } catch (error) {
      failures.push(`${path.relative(root, target)}: ${error.message}`);
    }
  }
}

if (pruneReleases) {
  console.log('');
  console.log(`清理 release（每个平台/架构保留最近 ${keepReleases} 个版本）：`);
  const releases = releasePlan();
  if (releases.length === 0) {
    console.log('  没有找到可清理的旧插件包。');
  }
  for (const target of releases) {
    try {
      totalBytes += remove(target, path.relative(root, target));
    } catch (error) {
      failures.push(`${path.relative(root, target)}: ${error.message}`);
    }
  }
}

if (deep) {
  console.log('');
  console.log('清理深度构建产物：');
  for (const relativePath of ['build', 'dist', path.join('release', 'plugin')]) {
    const target = path.join(root, relativePath);
    if (!fs.existsSync(target)) continue;
    try {
      totalBytes += remove(target, relativePath);
    } catch (error) {
      failures.push(`${relativePath}: ${error.message}`);
    }
  }
}

console.log('');
console.log(`${dryRun ? '预计清理' : '已清理'} ${formatBytes(totalBytes)} 缓存。`);
console.log('已保留 .venv、.venv-packaging、.models、node_modules 和最新插件包。');

if (failures.length > 0) {
  console.error('以下内容删除失败：');
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
