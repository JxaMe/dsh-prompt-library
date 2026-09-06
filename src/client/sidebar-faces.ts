import type { ReactNode } from 'react'

/**
 * better-sidebar 消费面的最小结构镜像（对准 dsh-better-sidebar@0.18.0-alpha.0
 * src/client/service.ts 的 TabDescriptor/registerTab，只收我们用的字段）。
 * 用镜像而不用它的类型导出：它的发布包不带 lib/types，src 图又拖着
 * state/reducers 等实现依赖；注册形态是它文档化的公开消费契约，
 * 真机挂载验收时断言页签出现即对齐。
 */
export interface PromptTabDescriptor {
  readonly id: string
  readonly title: string
  readonly icon?: (size: number) => ReactNode
  readonly single?: boolean
  /** 无参组件可赋给有参组件位（参数少永远兼容）。 */
  readonly component: () => ReactNode
}

/** 只一个 registerTab 的侧边栏服务面。 */
export interface PromptSidebarService {
  registerTab(descriptor: PromptTabDescriptor): () => void
}
