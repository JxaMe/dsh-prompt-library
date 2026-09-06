/** PromptLibrary 所有失败的原因。调用方按 code 分支，不猜异常类型。 */
export type PromptLibraryErrorCode =
  | 'invalid-name'
  | 'name-too-long'
  | 'body-too-long'
  | 'too-many'
  | 'duplicate'
  | 'missing'

/** 带 code 的库错误。message 写给人看，code 写给程序分支。 */
export class PromptLibraryError extends Error {
  readonly code: PromptLibraryErrorCode

  constructor(code: PromptLibraryErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'PromptLibraryError'
    this.code = code
  }
}
