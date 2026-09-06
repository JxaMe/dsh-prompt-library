import z from '@deepseek-ai/schemastery'

/** 部署可调的上限。非法值在挂载时拒绝，不带病运行。 */
export interface Config {
  /** 名称最大长度。 */
  maxNameLength: number
  /** 正文最大字符数。 */
  maxBodyChars: number
  /** 最多存几条。 */
  maxCount: number
}

export const Config: z<Partial<Config>, Config> = z.object({
  maxNameLength: z.number().min(1).step(1).default(64),
  maxBodyChars: z.number().min(1).step(1).default(20000),
  maxCount: z.number().min(1).step(1).default(500),
})
