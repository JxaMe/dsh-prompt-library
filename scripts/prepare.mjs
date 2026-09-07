/**
 * prepare 自愈：生产安装（无 dev 依赖）时先补装 dev 依赖再构建。
 * prepare 会被 npm pack / npm install / pnpm install（git 依赖、无参数）触发；
 * 本脚本内的安装又会再次触发 prepare，形成递归。用 node_modules/typescript
 * 是否已就位判断 dev 依赖齐不齐：已就位则跳过安装直接 build，切断递归。
 *
 * 包管理器跟随触发方（npm 还是 pnpm），不交叉污染：npm 触发走 npm install，
 * pnpm 触发走 pnpm install（--prod=false 保证 dev 依赖也装）。
 * 用法：由包管理器在 prepare 生命周期自动调用；也可 npm run prepare / pnpm prepare。
 */
import { existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

if (!existsSync('node_modules/typescript')) {
  const execPath = process.env.npm_execpath || ''
  const isPnpm = execPath.includes('pnpm')
  const install = isPnpm
    ? 'pnpm install --prod=false'
    : 'npm install --include=dev --no-audit --no-fund'
  execSync(install, { stdio: 'inherit', env: process.env })
}
execSync('npm run build', { stdio: 'inherit' })
