#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const versionPath = path.join(root, 'src/lib/version.ts')
const changelogPath = path.join(root, 'CHANGELOG.md')
const dryRun = process.argv.includes('--dry-run')
const summaryArg = process.argv.slice(2).filter((arg) => arg !== '--dry-run').join(' ').trim()

function run(command, args, options = {}) {
  if (command === 'npm' && process.platform === 'win32') {
    const commandLine = `npm ${args.join(' ')}`
    execFileSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', commandLine], {
      cwd: root,
      encoding: 'utf8',
      stdio: options.stdio ?? 'pipe',
    })
    return ''
  }
  const executable = command
  const result = execFileSync(executable, args, { cwd: root, encoding: 'utf8', stdio: options.stdio ?? 'pipe' })
  return typeof result === 'string' ? result.trim() : ''
}

function localDateStamp(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

function nextVersion(currentVersion, today) {
  const match = /^(\d{8})-(\d+)$/.exec(currentVersion)
  if (!match) throw new Error(`目前版號格式錯誤：${currentVersion}，應為 YYYYMMDD-N。`)
  if (match[1] > today) throw new Error(`目前版號日期 ${match[1]} 晚於今天 ${today}，請先確認版號。`)
  return match[1] === today ? `${today}-${Number(match[2]) + 1}` : `${today}-1`
}

async function askSummary() {
  if (summaryArg) return summaryArg
  const terminal = createInterface({ input: stdin, output: stdout })
  try {
    return (await terminal.question('請輸入本次提交摘要（繁體中文）：')).trim()
  } finally {
    terminal.close()
  }
}

async function confirm(message) {
  const terminal = createInterface({ input: stdin, output: stdout })
  try {
    const answer = (await terminal.question(`${message} [y/N] `)).trim().toLowerCase()
    return answer === 'y' || answer === 'yes'
  } finally {
    terminal.close()
  }
}

async function main() {
  const originalVersionFile = await readFile(versionPath, 'utf8')
  const originalChangelog = await readFile(changelogPath, 'utf8')
  const versionMatch = /export const APP_VERSION = '([^']+)'/.exec(originalVersionFile)
  if (!versionMatch) throw new Error('找不到 src/lib/version.ts 中的 APP_VERSION。')

  const summary = await askSummary()
  if (!summary) throw new Error('提交摘要不可空白。')

  const version = nextVersion(versionMatch[1], localDateStamp())
  const entry = `## ${version}\n- ${summary}\n`
  const updatedVersionFile = originalVersionFile.replace(
    /export const APP_VERSION = '[^']+';?/,
    `export const APP_VERSION = '${version}'`,
  )
  if (updatedVersionFile === originalVersionFile) throw new Error('無法更新 APP_VERSION。')
  const releaseHeading = /^## \d{8}-\d+$/m
  const updatedChangelog = releaseHeading.test(originalChangelog)
    ? originalChangelog.replace(releaseHeading, `${entry.trimEnd()}\n\n${originalChangelog.match(releaseHeading)?.[0]}`)
    : `${originalChangelog.trimEnd()}\n\n${entry}`

  console.log(`\n本次版號：${version}`)
  console.log(`提交摘要：${summary}`)
  if (dryRun) {
    console.log('Dry run：未修改檔案、未執行檢查、未建立 commit。')
    return
  }

  const proceed = await confirm('先更新版號與 CHANGELOG，執行 build/lint，再提交目前所有變更；確定繼續？')
  if (!proceed) {
    console.log('已取消，沒有修改檔案。')
    return
  }

  await writeFile(versionPath, updatedVersionFile, 'utf8')
  await writeFile(changelogPath, updatedChangelog, 'utf8')

  try {
    console.log('\n執行 npm run build…')
    run('npm', ['run', 'build'], { stdio: 'inherit' })
    console.log('\n執行 npm run lint…')
    run('npm', ['run', 'lint'], { stdio: 'inherit' })
  } catch (error) {
    await writeFile(versionPath, originalVersionFile, 'utf8')
    await writeFile(changelogPath, originalChangelog, 'utf8')
    throw new Error(`建置或 lint 未通過，已還原腳本對版號檔案的修改。${error instanceof Error ? `\n${error.message}` : ''}`)
  }

  console.log('\n將提交目前工作目錄的所有變更：')
  console.log(run('git', ['status', '--short']))
  const commit = await confirm(`確認建立 commit「${version}：${summary}」？`)
  if (!commit) {
    console.log(`已取消 commit；版號 ${version} 與 CHANGELOG 紀錄保留，方便稍後提交。`)
    return
  }

  run('git', ['add', '-A'], { stdio: 'inherit' })
  run('git', ['diff', '--cached', '--check'], { stdio: 'inherit' })
  run('git', ['commit', '-m', `${version}：${summary}`], { stdio: 'inherit' })
  console.log(`\nCommit 完成：${version}。此腳本不會執行 git push。`)
}

main().catch((error) => {
  console.error(`\n提交流程失敗：${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
