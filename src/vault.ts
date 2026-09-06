/** 一条提示词。存的是用户原文，读出来是什么样，写进去就是什么样。 */
export interface PromptRecord {
  /** 全小写标识，见 PROMPT_NAME_RE。 */
  readonly name: string
  /** 一句话说明，可空。 */
  readonly description: string
  /** 提示词正文。 */
  readonly body: string
}

/**
 * 持久边界口。生产实现包一层 storageDomain 的 KvTable，
 * 测试用内存实现。只做存取，不做校验——校验是 PromptLibrary 的事。
 * 实现抛出的错原样上抛：库不翻译介质故障，挂载时坏文件由 open 直接
 * 拒绝（文件不动），运行中故障由命令执行器记 error 结算。
 */
export interface PromptVault {
  /** 按名取一条，没有返回 undefined。 */
  get(name: string): Promise<PromptRecord | undefined>
  /** 存一条（新增或覆盖由调用方保证语义）。 */
  put(record: PromptRecord): Promise<void>
  /** 按名删一条，返回删之前是否存在。 */
  delete(name: string): Promise<boolean>
  /** 全量快照。 */
  all(): Promise<readonly PromptRecord[]>
}
