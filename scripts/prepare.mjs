/**
 * prepare 自愈：生产安装（无 dev 依赖）时先补装 dev 依赖再构建。
 * prepare 会被 npm pack / npm install（无参数）触发；本脚本内的 npm install
 * 又会触发 prepare，形成递归。用 node_modules/typescript 是否存在判断 dev
 * 依赖是否已就位：已就位则跳过 npm install 直接 build，切断递归。
 * 用法：npm run prepare（npm pack / npm install / git 依赖安装时自动触发）。
 */
import { existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

if (!existsSync('node_modules/typescript')) {
  execSync('npm install --include=dev --no-audit --no-fund', { stdio: 'inherit' })
}
execSync('npm run build', { stdio: 'inherit' })
