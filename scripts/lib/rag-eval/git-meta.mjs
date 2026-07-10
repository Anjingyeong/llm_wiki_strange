import { execSync } from 'node:child_process';

function runGit(command) {
  try {
    return execSync(command, { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

export function collectGitMeta(cwd = process.cwd()) {
  const gitCommit = runGit('git rev-parse --short HEAD') || 'unknown';
  const gitBranch = runGit('git rev-parse --abbrev-ref HEAD') || 'unknown';
  const status = runGit('git status --porcelain');
  const dirtyWorkingTree = status.length > 0;
  return { gitCommit, gitBranch, dirtyWorkingTree };
}

export function nowStamp() {
  const d = new Date();
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}${pad(d.getUTCMilliseconds(), 3)}`;
}
