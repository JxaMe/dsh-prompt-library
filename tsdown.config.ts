import { defineConfig } from 'tsdown'

// Client 半：lazy-CJS factory 产物，供宿主 client module 系统发布。
// 版式抄 packages/client/tsdown.client.ts 的输出约定：banner 注册 factory，
// 首尾闭包保证执行时零副作用（副作用全在 factory 内，物化时才跑）。
// 本包客户端零运行时外部依赖（只有 type-only 引入 + 全局 fetch），
// 因此无 externals 声明，全部内联；clean 必须关，否则会擦掉上面的 Node 半产物。
export default defineConfig({
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  dts: false,
  sourcemap: true,
  clean: false,
  treeshake: true,
  outputOptions: {
    entryFileNames: 'client.js',
    banner: 'window.__ModuleLoader__.load({ id: "dsh-prompt-manager", factory: (require) => {',
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
})
