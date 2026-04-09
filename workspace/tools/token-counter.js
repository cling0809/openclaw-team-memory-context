/**
 * token-counter.js - SDK-Level Token Counting for OpenClaw
 *
 * Upgraded from character-based estimation to SDK-level precision.
 * Uses Anthropic's official countTokens API when available,
 * falls back to char_length * 0.75 otherwise.
 *
 * Usage:
 *   const { estimateTokens, estimateMessagesTokens, estimateMessagesTokensWithTools } = require('./token-counter');
 *   const tokens = await estimateTokens("Hello world", "claude-sonnet-4-6");
 *   const tokens = await estimateMessagesTokens(messages, model);
 */

'use strict'

let AnthropicSDK
try {
  AnthropicSDK = require('@anthropic-ai/sdk')
} catch {
  AnthropicSDK = null
}

const SDK = AnthropicSDK

const DEFAULT_COUNT_MODEL = 'claude-sonnet-4-6'
const TOKEN_COUNT_MAX_TOKENS = 2048
const TOKEN_COUNT_THINKING_BUDGET = 1024

let _clientCache = null
let _cachedApiKey = null

function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null
  if (_clientCache && _cachedApiKey === apiKey) return _clientCache
  if (!SDK) return null

  _clientCache = new SDK.Anthropic({ apiKey })
  _cachedApiKey = apiKey
  return _clientCache
}

function hasThinkingBlocks(messages) {
  for (const message of messages) {
    if (message.role === 'assistant' && Array.isArray(message.content)) {
      for (const block of message.content) {
        if (
          typeof block === 'object' &&
          block !== null &&
          'type' in block &&
          (block.type === 'thinking' || block.type === 'redacted_thinking')
        ) {
          return true
        }
      }
    }
  }
  return false
}

function stripToolSearchFields(messages) {
  return messages.map(message => {
    if (!Array.isArray(message.content)) return message

    const normalizedContent = message.content.map(block => {
      if (block.type === 'tool_use') {
        const toolUse = block
        return {
          type: 'tool_use',
          id: toolUse.id,
          name: toolUse.name,
          input: toolUse.input,
        }
      }
      if (block.type === 'tool_result') {
        if (Array.isArray(block.content)) {
          const filtered = block.content.filter(
            c =>
              !(
                typeof c === 'object' &&
                c !== null &&
                'type' in c &&
                c.type === 'tool_reference'
              ),
          )
          if (filtered.length === 0) {
            return { ...block, content: [{ type: 'text', text: '[tool references]' }] }
          }
          return { ...block, content: filtered }
        }
      }
      return block
    })

    return { ...message, content: normalizedContent }
  })
}

async function countTokensWithSDK(messages, model, tools = []) {
  const client = getAnthropicClient()
  if (!client) return null

  try {
    const containsThinking = hasThinkingBlocks(messages)
    const normalizedMessages =
      messages.length > 0 ? stripToolSearchFields(messages) : [{ role: 'user', content: 'foo' }]

    let sdkTools = tools
    if (typeof tools === 'function') {
      sdkTools = []
    }

    const response = await client.beta.messages.countTokens({
      model: model || DEFAULT_COUNT_MODEL,
      messages: normalizedMessages,
      ...(sdkTools && sdkTools.length > 0 && { tools: sdkTools }),
      ...(containsThinking && {
        thinking: {
          type: 'enabled',
          budget_tokens: TOKEN_COUNT_THINKING_BUDGET,
        },
      }),
    })

    if (typeof response.input_tokens !== 'number') return null
    return response.input_tokens
  } catch {
    return null
  }
}

function roughEstimate(text) {
  if (!text || typeof text !== 'string') return 0
  return Math.round(text.length * 0.75)
}

function roughMessagesEstimate(messages) {
  if (!messages || messages.length === 0) return 0

  let total = 0
  for (const msg of messages) {
    total += 4

    const content = msg.content
    if (!content) continue

    if (typeof content === 'string') {
      total += roughEstimate(content)
    } else if (Array.isArray(content)) {
      for (const block of content) {
        if (typeof block === 'string') {
          total += roughEstimate(block)
        } else if (block && block.type === 'text') {
          total += roughEstimate(block.text || '')
        } else if (block && (block.type === 'image' || block.type === 'document')) {
          total += 2000
        } else if (block && block.type === 'tool_result') {
          total += roughMessagesEstimate([{ content: block.content }])
        } else if (block && block.type === 'tool_use') {
          const inputStr = block.input ? JSON.stringify(block.input) : ''
          total += roughEstimate((block.name || '') + inputStr)
        } else if (block && block.type === 'thinking') {
          total += roughEstimate(block.thinking || '')
        } else {
          total += roughEstimate(JSON.stringify(block))
        }
      }
    }

    if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls) {
        const name = tc.function?.name || tc.name || ''
        const args = tc.function?.arguments || tc.input || ''
        const argsStr = typeof args === 'string' ? args : JSON.stringify(args)
        total += roughEstimate(name) + roughEstimate(argsStr) + 10
      }
    }
  }
  return total
}

async function estimateTokens(text, model) {
  if (!text || typeof text !== 'string') return 0

  if (SDK && process.env.ANTHROPIC_API_KEY) {
    const client = getAnthropicClient()
    if (client) {
      try {
        const response = await client.beta.messages.countTokens({
          model: model || DEFAULT_COUNT_MODEL,
          messages: [{ role: 'user', content: text }],
        })
        if (typeof response.input_tokens === 'number') {
          return response.input_tokens
        }
      } catch {
      }
    }
  }

  return roughEstimate(text)
}

async function estimateMessagesTokens(messages, model, tools = []) {
  if (!messages || messages.length === 0) return 0

  if (SDK && process.env.ANTHROPIC_API_KEY) {
    const result = await countTokensWithSDK(messages, model || DEFAULT_COUNT_MODEL, tools)
    if (result !== null) return result
  }

  return roughMessagesEstimate(messages)
}

function estimateTokensSync(text) {
  return roughEstimate(text)
}

function estimateMessagesTokensSync(messages) {
  return roughMessagesEstimate(messages)
}

const MODEL_CONTEXTS = {
  'gpt-4': 8192,
  'gpt-4-32k': 32768,
  'gpt-4-turbo': 128000,
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'claude-3-opus': 200000,
  'claude-3-sonnet': 200000,
  'claude-3-5-sonnet': 200000,
  'claude-3-5-haiku': 200000,
  'claude-2': 100000,
  'claude-instant': 100000,
  'minimax-cn/MiniMax-M2': 100000,
  'minimax-cn/MiniMax-M2.5': 100000,
  minimax: 100000,
  default: 128000,
}

function getModelContextWindow(model) {
  if (!model) return MODEL_CONTEXTS.default
  const lower = model.toLowerCase()
  for (const [key, val] of Object.entries(MODEL_CONTEXTS)) {
    if (lower.includes(key.toLowerCase())) return val
  }
  return MODEL_CONTEXTS.default
}

function getRemainingContext(currentTokens, model) {
  const maxTokens = getModelContextWindow(model)
  const remaining = Math.max(0, maxTokens - currentTokens)
  const usagePercent = Math.round((currentTokens / maxTokens) * 100)
  return { remaining, maxTokens, usagePercent }
}

function formatContextStatus(tokens, model) {
  const { remaining, maxTokens, usagePercent } = getRemainingContext(tokens, model)
  const used = maxTokens - remaining
  return `[Token Counter] 使用: ${used.toLocaleString()} / ${maxTokens.toLocaleString()} (${usagePercent}%) | 剩余: ${remaining.toLocaleString()}`
}

if (require.main === module) {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.log('Usage:')
    console.log('  node token-counter.js <text>           # Estimate single text')
    console.log('  node token-counter.js --file <path>   # Estimate file')
    console.log('  node token-counter.js --model <name> # Specify model')
    console.log('  node token-counter.js --sync          # Force sync (rough) mode')
    console.log('')
    console.log('Examples:')
    console.log('  node token-counter.js "你好世界"')
    console.log('  node token-counter.js --model claude-sonnet-4-6 "Hello world"')
    process.exit(0)
  }

  let model = DEFAULT_COUNT_MODEL
  let text = ''
  let sync = false

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--model' && args[i + 1]) {
      model = args[i + 1]
      i++
    } else if (args[i] === '--file' && args[i + 1]) {
      const fs = require('fs')
      text = fs.readFileSync(args[i + 1], 'utf-8')
      i++
    } else if (args[i] === '--sync') {
      sync = true
    } else {
      text = args.slice(i).join(' ')
    }
  }

  async function run() {
    const hasKey = !!process.env.ANTHROPIC_API_KEY
    console.log(`Mode: ${hasKey ? 'SDK (Anthropic countTokens)' : 'Rough (char×0.75)'}`)
    console.log(`Model: ${model}`)

    const tokens = sync
      ? roughEstimate(text)
      : await estimateTokens(text, model)

    console.log(`Token 估算: ${tokens} tokens`)
    console.log(`字符数: ${text.length}`)
    console.log(`Rough estimate (sync): ${roughEstimate(text)} tokens`)
  }

  run().catch(console.error)
}

module.exports = {
  estimateTokens,
  estimateTokensSync,
  estimateMessagesTokens,
  estimateMessagesTokensSync,
  countTokensWithSDK,
  getModelContextWindow,
  getRemainingContext,
  formatContextStatus,
  roughEstimate,
  roughMessagesEstimate,
  DEFAULT_COUNT_MODEL,
}
