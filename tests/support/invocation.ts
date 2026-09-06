import type { Agent } from '@deepseek-ai/dsh-agent'
import type { CommandInvocation } from '@deepseek-ai/dsh-commands'
import type { UserMessage } from '@deepseek-ai/dsh-llm'

/**
 * 造一次命令调用：只给 handler 真正用的两样（agent 与原文），
 * 其余按空调用填。agent 是系统边界（live loop），这里是唯一的桩。
 */
export function invocation(
  rawInput: string,
  agent: Pick<Agent, 'followup'>,
): CommandInvocation {
  return {
    commandId: 'test-command' as CommandInvocation['commandId'],
    agent: agent as Agent,
    rawInput,
    attachments: [],
    signal: new AbortController().signal,
  }
}

/** 记下 followup 收到的用户消息。 */
export function followupRecorder() {
  const messages: UserMessage[] = []
  return {
    messages,
    agent: { followup: (message: UserMessage): void => { messages.push(message) } },
  }
}
