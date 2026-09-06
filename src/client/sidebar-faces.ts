import type { ReactNode } from 'react'

/**
 * better-sidebar 消费面的最小结构镜像（对准 dsh-better-sidebar@0.18.0-alpha.0
 * src/client/service.ts 的 TabDescriptor/registerTab，只收我们用的字段）。
 * 用镜像而不用它的类型导出：它的发布包不带 lib/types，src 图又拖着
 * state/reducers 等实现依赖；注册形态是它文档化的公开消费契约，
 * 真机挂载验收时断言页签出现即对齐。
 */
/** 面板宿主要求：能读服务（get），能认出当前会话（scope.sessionId）。侧边栏的 Tab props 天然满足。 */
export interface PanelHost {
  readonly ctx: { get(name: string): unknown }
  readonly scope: { readonly sessionId: string }
}

export interface PromptTabDescriptor {
  readonly id: string
  readonly title: string
  readonly icon?: (size: number) => ReactNode
  readonly single?: boolean
  readonly component: (props: PanelHost) => ReactNode
}

/** 只一个 registerTab 的侧边栏服务面。 */
export interface PromptSidebarService {
  registerTab(descriptor: PromptTabDescriptor): () => void
}
