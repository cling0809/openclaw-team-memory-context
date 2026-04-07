/**
 * @fileoverview OpenClaw Skill Engine - 可执行的条件模板系统
 * 
 * 支持在 Skill Markdown 中使用条件逻辑、变量插值、循环和工具调用，
 * 将纯文本模板升级为可执行的环境。
 * 
 * @module skill-engine
 * @version 1.0.0
 */

import fs from 'node:fs/promises'
import path from 'node:path'

const OPENCLAW_HOME = () => process.env.OPENCLAW_HOME ?? path.join(process.env.HOME ?? '', '.openclaw')
const OPENCLAW_WORKSPACE = () => process.env.OPENCLAW_WORKSPACE ?? path.join(OPENCLAW_HOME(), 'workspace')

// ============================================================
// 1. Skill 上下文与类型定义
// ============================================================

/**
 * Skill 执行时的上下文对象
 * 
 * @interface SkillContext
 * @description 包含变量、用户信息、会话信息等执行环境数据
 */
export interface SkillContext {
  /** 用户定义的变量映射表 */
  variables: Record<string, string | number | boolean>
  /** 当前用户 ID */
  userId?: string
  /** 当前会话 Key */
  sessionKey?: string
  /** 执行时间戳（毫秒） */
  timestamp: number
  /** 扩展属性槽 */
  [key: string]: unknown
}

/**
 * Skill 模板解析后的块结构
 * 
 * @interface SkillBlock
 * @description 表示解析后的一个逻辑块，可能是文本、条件、循环、工具调用或引用
 */
export interface SkillBlock {
  /** 块类型 */
  type: 'text' | 'condition' | 'loop' | 'tool' | 'include'
  /** 原始文本内容或表达式 */
  content: string
  /** 子块（用于 condition 和 loop） */
  children?: SkillBlock[]
  /** 条件表达式（type=condition） */
  condition?: string
  /** 循环变量名（type=loop） */
  loopVar?: string
  /** 循环项数组（type=loop） */
  loopItems?: unknown[]
  /** 工具名称（type=tool） */
  toolName?: string
  /** 工具参数（type=tool） */
  toolArgs?: Record<string, unknown>
}

/**
 * Skill 元数据（从 YAML frontmatter 解析）
 * 
 * @interface SkillMeta
 */
export interface SkillMeta {
  /** Skill 名称 */
  name: string
  /** Skill 描述 */
  description: string
  /** 版本号 */
  version: string
  /** 最后更新时间 */
  updated: string
  /** 触发词列表 */
  triggers?: string[]
  /** 变量定义 */
  variables?: Record<string, {
    type: string
    default?: unknown
    description?: string
  }>
  /** Skill 文件路径 */
  path?: string
}

// ============================================================
// 2. Skill 模板解析器
// ============================================================

/**
 * 解析 Skill Markdown 模板，提取条件块、循环块和变量
 * 
 * @function parseSkillTemplate
 * @param {string} content - Skill Markdown 原始内容
 * @returns {SkillBlock[]} 解析后的块数组
 * 
 * @description
 * 将 Markdown 内容解析为结构化的块数组，支持：
 * - `{{variable}}` - 变量插值
 * - `{{#if condition}}...{{/if}}` - 条件块
 * - `{{#each item in items}}...{{/each}}` - 循环块
 * 
 * @example
 * ```typescript
 * const blocks = parseSkillTemplate(skillContent)
 * ```
 */
export function parseSkillTemplate(content: string): SkillBlock[] {
  const blocks: SkillBlock[] = []
  let pos = 0
  const src = content

  function parseConditionBlockFrom(openTagPos: number, condition: string): { block: SkillBlock; endPos: number } {
    const children: SkillBlock[] = []

    // Find the closing }} of the opening {{#if ...}} tag, then start content scanning from there
    const openTagClose = src.indexOf('}}', openTagPos)
    if (openTagClose === -1) return { block: { type: 'condition', condition, children }, endPos: src.length }
    let cur = openTagClose + 2  // start AFTER the opening {{#if EXPR}}

    while (cur < src.length) {
      const nextOpen = src.indexOf('{{', cur)
      if (nextOpen === -1) break

      const next5 = src.slice(nextOpen, nextOpen + 9)

      if (src.startsWith('{{#if ', nextOpen)) {
        // Capture text between end of opening tag and nested {{
        const textBetween = src.slice(cur, nextOpen)
        if (textBetween.trim()) children.push({ type: 'text', content: textBetween })
        const condEnd = src.indexOf('}}', nextOpen)
        if (condEnd === -1) break
        const innerCond = src.slice(nextOpen + 6, condEnd).trim()
        const { block: innerBlock, endPos: innerEnd } = parseConditionBlockFrom(nextOpen, innerCond)
        children.push(innerBlock)
        cur = innerEnd
        continue
      }

      // {{#if}} empty condition
      if (nextOpen + 5 < src.length && src.slice(nextOpen, nextOpen + 5) === '{{#if' && src[nextOpen + 5] === '}') {
        const { block: innerBlock, endPos: innerEnd } = parseConditionBlockFrom(nextOpen, '')
        children.push(innerBlock)
        cur = innerEnd
        continue
      }

      if (src.startsWith('{{/if}}', nextOpen) || (nextOpen + 6 <= src.length && src.slice(nextOpen + 3, nextOpen + 6) === '/if')) {
        // Push text content before the closing tag as a child
        const textContent = src.slice(cur, nextOpen)
        if (textContent.trim()) children.push({ type: 'text', content: textContent })
        const closeEnd = src.indexOf('}}', nextOpen)
        const endPos = closeEnd === -1 ? src.length : closeEnd + 2
        return { block: { type: 'condition', condition, children }, endPos }
      }

      if (src.startsWith('{{#ea', nextOpen)) {
        // Capture text between end of opening tag and nested {{
        const textBetween = src.slice(cur, nextOpen)
        if (textBetween.trim()) children.push({ type: 'text', content: textBetween })
        const loopEnd = src.indexOf('}}', nextOpen)
        if (loopEnd === -1) break
        const loopExpr = src.slice(nextOpen + 9, loopEnd)
        const varMatch = loopExpr.match(/^each\s+(\S+)\s+in\s+(\S+)/)
        if (!varMatch) { cur = nextOpen + 2; continue }
        const [, loopVar, itemsExpr] = varMatch
        const { block: loopBlock, endPos: loopEndPos } = parseLoopBlockFrom(nextOpen, loopVar.trim(), itemsExpr.trim())
        children.push(loopBlock)
        cur = loopEndPos
        continue
      }

      if (src.startsWith('{{#to', nextOpen)) {
        const closeBrace = src.indexOf('}}', nextOpen)
        if (closeBrace === -1) { cur = nextOpen + 2; continue }
        const inner = src.slice(nextOpen + 2, closeBrace)
        const toolMatch = inner.match(/^#tool\s+(\S+)(.*)/)
        if (toolMatch) {
          const toolArgs = parseToolArgs(toolMatch[2].trim())
          children.push({ type: 'tool', content: toolMatch[1], toolName: toolMatch[1], toolArgs })
        }
        cur = closeBrace + 2
        continue
      }

      if (src.startsWith('{{#in', nextOpen)) {
        const closeBrace = src.indexOf('}}', nextOpen)
        if (closeBrace === -1) { cur = nextOpen + 2; continue }
        const inner = src.slice(nextOpen + 2, closeBrace)
        const refMatch = inner.match(/^>\s*(.+)/)
        if (refMatch) children.push({ type: 'include', content: refMatch[1].trim() })
        cur = closeBrace + 2
        continue
      }

      if (nextOpen > cur) {
        const raw = src.slice(cur, nextOpen)
        // Only process if has embedded {{}}
        if (raw.includes('{{')) {
          children.push({ type: 'text', content: processVariableInterpolation(raw) })
        } else {
          children.push({ type: 'text', content: raw })
        }
      }
      cur = nextOpen + 2
      continue
    }

    const remaining = src.slice(cur)
    if (remaining.trim()) children.push({ type: 'text', content: remaining })
    return { block: { type: 'condition', condition, children }, endPos: src.length }
  }

  function parseLoopBlockFrom(openTagPos: number, loopVar: string, itemsExpr: string): { block: SkillBlock; endPos: number } {
    const children: SkillBlock[] = []

    // Find the closing }} of the opening {{#each ...}} tag, then start content scanning from there
    const openTagClose = src.indexOf('}}', openTagPos)
    if (openTagClose === -1) return { block: { type: 'loop', content: itemsExpr, loopVar, children }, endPos: src.length }
    let cur = openTagClose + 2  // start AFTER the opening {{#each EXPR}}

    while (cur < src.length) {
      const nextOpen = src.indexOf('{{', cur)
      if (nextOpen === -1) break

      const next5 = src.slice(nextOpen, nextOpen + 9)

      if (src.startsWith('{{#if ', nextOpen)) {
        // Capture text between end of opening tag and nested {{
        const textBetween = src.slice(cur, nextOpen)
        if (textBetween.trim()) children.push({ type: 'text', content: textBetween })
        const condEnd = src.indexOf('}}', nextOpen)
        if (condEnd === -1) break
        const innerCond = src.slice(nextOpen + 6, condEnd).trim()
        const { block: innerBlock, endPos: innerEnd } = parseConditionBlockFrom(nextOpen, innerCond)
        children.push(innerBlock)
        cur = innerEnd
        continue
      }

      if (src.startsWith('{{/ea}}', nextOpen) || (nextOpen + 6 <= src.length && src.slice(nextOpen + 3, nextOpen + 6) === '/ea')) {
        // Push text content before the closing tag as a child
        const textContent = src.slice(cur, nextOpen)
        if (textContent.trim()) children.push({ type: 'text', content: textContent })
        const closeEnd = src.indexOf('}}', nextOpen)
        const endPos = closeEnd === -1 ? src.length : closeEnd + 2
        return { block: { type: 'loop', content: itemsExpr, loopVar, children }, endPos }
      }

      if (src.startsWith('{{#ea', nextOpen)) {
        const loopEnd = src.indexOf('}}', nextOpen)
        if (loopEnd === -1) break
        const loopExpr2 = src.slice(nextOpen + 9, loopEnd)
        const varMatch2 = loopExpr2.match(/^each\s+(\S+)\s+in\s+(\S+)/)
        if (!varMatch2) { cur = nextOpen + 2; continue }
        const [, lv2, ie2] = varMatch2
        const { block: lb2, endPos: le2 } = parseLoopBlockFrom(nextOpen, lv2.trim(), ie2.trim())
        children.push(lb2)
        cur = le2
        continue
      }

      if (src.startsWith('{{#to', nextOpen)) {
        const closeBrace = src.indexOf('}}', nextOpen)
        if (closeBrace === -1) { cur = nextOpen + 2; continue }
        const inner = src.slice(nextOpen + 2, closeBrace)
        const toolMatch = inner.match(/^#tool\s+(\S+)(.*)/)
        if (toolMatch) {
          const toolArgs = parseToolArgs(toolMatch[2].trim())
          children.push({ type: 'tool', content: toolMatch[1], toolName: toolMatch[1], toolArgs })
        }
        cur = closeBrace + 2
        continue
      }

      if (nextOpen > cur) {
        const raw = src.slice(cur, nextOpen)
        // Only process if has embedded {{}}
        if (raw.includes('{{')) {
          children.push({ type: 'text', content: processVariableInterpolation(raw) })
        } else {
          children.push({ type: 'text', content: raw })
        }
      }
      cur = nextOpen + 2
      continue
    }

    const remaining = src.slice(cur)
    if (remaining.trim()) children.push({ type: 'text', content: remaining })
    return { block: { type: 'loop', content: itemsExpr, loopVar, children }, endPos: src.length }
  }

  while (pos < src.length) {
    const openIdx = src.indexOf('{{', pos)
    if (openIdx === -1) {
      const remaining = src.slice(pos)
      if (remaining.trim()) blocks.push({ type: 'text', content: remaining })
      break
    }

    if (openIdx > pos) {
      const text = src.slice(pos, openIdx)
      // Only apply processVariableInterpolation if text contains {{
      // otherwise pass as-is (plain text needs no processing)
      if (text.includes('{{')) {
        blocks.push({ type: 'text', content: processVariableInterpolation(text) })
      } else {
        blocks.push({ type: 'text', content: text })
      }
    }

    const next5 = src.slice(openIdx, openIdx + 9)

    if (src.startsWith('{{#if ', openIdx)) {
      const condEnd = src.indexOf('}}', openIdx)
      if (condEnd === -1) { pos = openIdx + 2; continue }
      const condition = src.slice(openIdx + 6, condEnd).trim()
      const { block, endPos } = parseConditionBlockFrom(openIdx, condition)
      blocks.push(block)
      pos = endPos
      continue
    }

    // {{#if}} empty condition
    if (openIdx + 5 < src.length && src.slice(openIdx, openIdx + 5) == '{{#if' && src[openIdx + 5] == '}') {
      const condEnd = src.indexOf('}}', openIdx)
      if (condEnd === -1) { pos = openIdx + 2; continue }
      const { block, endPos } = parseConditionBlockFrom(openIdx, '')
      blocks.push(block)
      pos = endPos
      continue
    }

    if (src.startsWith('{{#ea', openIdx)) {
      const loopEnd = src.indexOf('}}', openIdx)
      if (loopEnd === -1) { pos = openIdx + 2; continue }
      const loopExpr = src.slice(openIdx + 9, loopEnd)
      const varMatch = loopExpr.match(/^each\s+(\S+)\s+in\s+(\S+)/)
      if (!varMatch) { pos = openIdx + 2; continue }
      const [, loopVar, itemsExpr] = varMatch
      const { block, endPos } = parseLoopBlockFrom(openIdx, loopVar.trim(), itemsExpr.trim())
      blocks.push(block)
      pos = endPos
      continue
    }

    if (src.startsWith('{{#to', openIdx)) {
      const closeBrace = src.indexOf('}}', openIdx)
      if (closeBrace === -1) { pos = openIdx + 2; continue }
      const inner = src.slice(openIdx + 2, closeBrace)
      const toolMatch = inner.match(/^#tool\s+(\S+)(.*)/)
      if (toolMatch) {
        const toolArgs = parseToolArgs(toolMatch[2].trim())
        blocks.push({ type: 'tool', content: toolMatch[1], toolName: toolMatch[1], toolArgs })
      }
      pos = closeBrace + 2
      continue
    }

    if (src.startsWith('{{>', openIdx)) {
      const closeBrace = src.indexOf('}}', openIdx)
      if (closeBrace === -1) { pos = openIdx + 2; continue }
      const inner = src.slice(openIdx + 2, closeBrace)
      const refMatch = inner.match(/^>\s*(.+)/)
      if (refMatch) blocks.push({ type: 'include', content: refMatch[1].trim() })
      pos = closeBrace + 2
      continue
    }

    if (src.startsWith('{{/if', openIdx) || src.startsWith('{{/lo', openIdx)) {
      const closeBrace = src.indexOf('}}', openIdx)
      if (closeBrace === -1) { pos = openIdx + 2; continue }
      blocks.push({ type: 'text', content: src.slice(openIdx, closeBrace + 2) })
      pos = closeBrace + 2
      continue
    }

    const closeBrace = src.indexOf('}}', openIdx)
    if (closeBrace === -1) { pos = openIdx + 2; continue }
    // Push variable interpolation as-is, interpolateAll will resolve it
    blocks.push({ type: 'text', content: src.slice(openIdx, closeBrace + 2) })
    pos = closeBrace + 2
    continue
  }

  return blocks
}

function parseConditionBlock(lines: string[], startIdx: number, condition: string): { block: SkillBlock; consumed: number } {
  const children: SkillBlock[] = []
  let i = startIdx

  while (i < lines.length) {
    const line = lines[i]
    
    // 嵌套 if
    const nestedIfMatch = line.match(/^\s*\{\{#if\s+(.+?)\}\}\s*$/)
    if (nestedIfMatch) {
      const nestedCondition = nestedIfMatch[1].trim()
      const nested = parseConditionBlock(lines, i + 1, nestedCondition)
      children.push(nested.block)
      i += nested.consumed
      continue
    }
    
    // 结束标记
    if (line.match(/^\s*\{\{\/if\}\}\s*$/)) {
      i++ // consume {{/if}}
      break
    }
    
    // 嵌套循环
    const nestedEachMatch = line.match(/^\s*\{\{#each\s+(.+?)\s+in\s+(.+?)\}\}\s*$/)
    if (nestedEachMatch) {
      const loopVar = nestedEachMatch[1].trim()
      const loopExpr = nestedEachMatch[2].trim()
      const { block, consumed } = parseLoopBlock(lines, i + 1, loopVar, loopExpr)
      children.push(block)
      i += consumed
      continue
    }
    
    const processedLine = processVariableInterpolation(line)
    children.push({ type: 'text', content: processedLine })
    i++
  }

  return {
    block: { type: 'condition', condition, children },
    consumed: i - startIdx + 1
  }
}

/**
 * 解析循环块
 * 
 * @private
 * @param {string[]} lines - 所有行
 * @param {number} startIdx - 起始索引
 * @param {string} loopVar - 循环变量名
 * @param {string} loopExpr - 循环表达式（数组路径）
 * @returns {{ block: SkillBlock; consumed: number }}
 */
function parseLoopBlock(lines: string[], startIdx: number, loopVar: string, loopExpr: string): { block: SkillBlock; consumed: number } {
  const children: SkillBlock[] = []
  let i = startIdx

  while (i < lines.length) {
    const line = lines[i]
    
    // 循环结束
    if (line.match(/^\s*\{\{\/each\}\}\s*$/)) {
      i++
      break
    }
    
    // 嵌套循环
    const nestedEachMatch = line.match(/^\s*\{\{#each\s+(.+?)\s+in\s+(.+?)\}\}\s*$/)
    if (nestedEachMatch) {
      const nestedLoopVar = nestedEachMatch[1].trim()
      const nestedLoopExpr = nestedEachMatch[2].trim()
      const { block, consumed } = parseLoopBlock(lines, i + 1, nestedLoopVar, nestedLoopExpr)
      children.push(block)
      i += consumed
      continue
    }
    
    // 嵌套条件
    const nestedIfMatch = line.match(/^\s*\{\{#if\s+(.+?)\}\}\s*$/)
    if (nestedIfMatch) {
      const nestedCondition = nestedIfMatch[1].trim()
      const { block, consumed } = parseConditionBlock(lines, i + 1, nestedCondition)
      children.push(block)
      i += consumed
      continue
    }
    
    const processedLine = processVariableInterpolation(line)
    // 替换循环变量为占位符，稍后替换
    children.push({ 
      type: 'text', 
      content: processedLine.replace(new RegExp(`\\{\\{${escapeRegExp(loopVar)}\\}\\}`, 'g'), '{{__loop_var__}}')
    })
    i++
  }

  return {
    block: { type: 'loop', loopVar, content: loopExpr, children },
    consumed: i - startIdx + 1
  }
}

/**
 * 工具调用参数解析
 * 
 * @private
 * @param {string} argsStr - 参数字符串（如 `arg1=value1 arg2="value 2"`）
 * @returns {Record<string, unknown>}
 */
function parseToolArgs(argsStr: string): Record<string, unknown> {
  const args: Record<string, unknown> = {}
  if (!argsStr.trim()) return args

  // 匹配 key=value 或 key="value" 或 key='value'
  const matches = argsStr.matchAll(/(\w+)=(?:'([^']*)'|"([^"]*)"|([^'\s]+))/g)
  for (const match of matches) {
    const key = match[1]
    const rawValue = match[2] ?? match[3] ?? match[4] ?? ''
    // Type inference: try number, then boolean, else keep as string
    let value: unknown = rawValue
    if (/^\d+(\.\d+)?$/.test(rawValue)) {
      value = Number(rawValue)
    } else if (rawValue === 'true') {
      value = true
    } else if (rawValue === 'false') {
      value = false
    }
    args[key] = value
  }
  return args
}

/**
 * 转义正则表达式特殊字符
 * 
 * @private
 * @param {string} string - 待转义字符串
 * @returns {string}
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 变量插值预处理
 * 
 * @private
 * @param {string} line - 单行文本
 * @returns {string} 预处理后的文本
 */
function processVariableInterpolation(line: string): string {
  return line.replace(/\{\{([^}]+)\}\}/g, (_, expr) => {
    // 支持嵌套属性：{{user.name}}、{{meta.count}}
    // 这里只做标记，实际插值在 render 时进行
    return `{{${expr}}}`
  })
}

// ============================================================
// 3. 条件表达式求值器（安全的 sandbox）
// ============================================================

/**
 * 安全地求值条件表达式
 * 
 * @function evaluateCondition
 * @param {string} condition - 条件表达式
 * @param {SkillContext} ctx - 执行上下文
 * @returns {boolean} 表达式结果
 * 
 * @description
 * 使用沙箱环境求值条件表达式，支持：
 * - 逻辑运算符：`&&`、`||`、`!`
 * - 比较运算符：`==`、`!=`、`>`、`<`、`>=`、`<=`
 * - 括号分组：`()`
 * 
 * **安全保证**：
 * - 仅允许预定义的运算符和标识符
 * - 变量通过 ctx 访问，无任意代码执行
 * - 未知变量返回字符串字面量（做比较时自动类型转换）
 * 
 * @example
 * ```typescript
 * const ctx = { variables: { depth: 5 } }
 * evaluateCondition('depth > 3', ctx) // true
 * ```
 */
// ─── 安全常量 ────────────────────────────────────────────────────────────────

const PROTECTED_PROPERTIES = new Set([
  '__proto__', 'constructor', 'prototype',
  'toString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf',
  'propertyIsEnumerable',
])

const MAX_LOOP_ITEMS = 10000
const MAX_RENDER_DEPTH = 50

// ─── 安全的条件表达式解释器（无 new Function） ─────────────────────────────────

/**
 * 安全求值条件表达式。
 * 不使用 new Function()，仅支持预定义运算符和标识符白名单。
 * 攻击向量全部被阻断：
 *   - 参数覆盖：ctx 参数不可变
 *   - 代码注入：无 Function/eval/require 可访问
 *   - 原型链：无 __proto__/constructor/prototype 可访问
 */
function evaluateCondition(condition: string, ctx: SkillContext): boolean {
  try {
    // Tokenize：分割成词元
    const tokens = tokenize(condition)
    // 解析为 AST
    const ast = parseExpression(tokens)
    // 求值（只从 ctx.variables 取值）
    return evalAST(ast, ctx.variables)
  } catch {
    return false
  }
}

type Token = { type: 'op' | 'value' | 'bool' | 'paren'; value: string }

function tokenize(expr: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < expr.length) {
    const ch = expr[i]!
    // 跳过空白
    if (/\s/.test(ch)) { i++; continue }
    // 运算符和括号
    if (/[&|=!><]/.test(ch)) {
      let op = ch
      if (i + 1 < expr.length && expr[i + 1] === '=') { op += '='; i++ }
      if (op === '&' && i + 1 < expr.length && expr[i + 1] === '&') { op = '&&'; i++ }
      if (op === '|' && i + 1 < expr.length && expr[i + 1] === '|') { op = '||'; i++ }
      tokens.push({ type: 'op', value: op })
      i++; continue
    }
    if (ch === '(' || ch === ')') { tokens.push({ type: 'paren', value: ch }); i++; continue }
    // 标识符或数字
    if (/[a-zA-Z_]/.test(ch)) {
      const identStart = i
      i++ // skip first char (already matched /[a-zA-Z_]/)
      while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) { i++ }
      const ident = expr.slice(identStart, i)
      if (ident === 'true') { tokens.push({ type: 'bool', value: 'true' }) }
      else if (ident === 'false') { tokens.push({ type: 'bool', value: 'false' }) }
      else if (ident === 'null') { tokens.push({ type: 'value', value: 'null' }) }
      else if (ident === 'undefined') { tokens.push({ type: 'value', value: 'undefined' }) }
      else { tokens.push({ type: 'value', value: ident }) }
      continue
    }
    // 数字
    if (/[0-9.]/.test(ch)) {
      const numStart = i
      i++
      while (i < expr.length && /[0-9.]/.test(expr[i])) { i++ }
      const num = expr.slice(numStart, i)
      tokens.push({ type: 'value', value: num })
      continue
    }
    // 未知字符，跳过
    i++
  }
  return tokens
}

type AST = { op: string; left?: AST; right?: AST; value?: string | boolean | null; varName?: string }

function parseExpression(tokens: Token[]): AST {
  return parseOr(tokens, { pos: 0 })
}

function parseOr(tokens: Token[], state: { pos: number }): AST {
  let left = parseAnd(tokens, state)
  while (state.pos < tokens.length && tokens[state.pos]!.type === 'op' && tokens[state.pos]!.value === '||') {
    state.pos++
    const right = parseAnd(tokens, state)
    left = { op: '||', left, right }
  }
  return left
}

function parseAnd(tokens: Token[], state: { pos: number }): AST {
  let left = parseUnary(tokens, state)
  while (state.pos < tokens.length && tokens[state.pos]!.type === 'op' && tokens[state.pos]!.value === '&&') {
    state.pos++
    const right = parseUnary(tokens, state)
    left = { op: '&&', left, right }
  }
  return left
}

function parseUnary(tokens: Token[], state: { pos: number }): AST {
  if (state.pos < tokens.length && tokens[state.pos]!.type === 'op' && tokens[state.pos]!.value === '!') {
    state.pos++
    return { op: '!', right: parseUnary(tokens, state) }
  }
  return parseCompare(tokens, state)
}

function parseCompare(tokens: Token[], state: { pos: number }): AST {
  let left = parsePrimary(tokens, state)
  while (state.pos < tokens.length && tokens[state.pos]!.type === 'op' && ['==', '!=', '>', '<', '>=', '<='].includes(tokens[state.pos]!.value)) {
    const op = tokens[state.pos++].value
    const right = parsePrimary(tokens, state)
    left = { op, left, right }
  }
  return left
}

function parsePrimary(tokens: Token[], state: { pos: number }): AST {
  const tok = tokens[state.pos]
  if (!tok) return { op: 'literal', value: null }
  if (tok.type === 'paren' && tok.value === '(') {
    state.pos++
    const expr = parseOr(tokens, state)
    if (tokens[state.pos]?.value === ')') state.pos++
    return expr
  }
  if (tok.type === 'bool') {
    state.pos++
    return { op: 'literal', value: tok.value === 'true' }
  }
  if (tok.type === 'value') {
    state.pos++
    const v = tok.value
    if (v === 'null' || v === 'undefined') return { op: 'literal', value: null }
    if (/^\d+(\.\d+)?$/.test(v)) return { op: 'literal', value: Number(v) }
    // Handle property access: var.prop or var.prop.sub
    // Continue consuming '.' and property names to build full property path
    let varName = v
    while (state.pos < tokens.length && tokens[state.pos]!.type === 'value' && tokens[state.pos]!.value === '.') {
      state.pos++ // skip '.'
      if (state.pos < tokens.length && tokens[state.pos]!.type === 'value') {
        const nextVal = tokens[state.pos]!.value
        // Skip if next token is a number or another operator
        if (/^\d+(\.\d+)?$/.test(nextVal) || nextVal === 'true' || nextVal === 'false' || nextVal === 'null' || nextVal === 'undefined') {
          break
        }
        varName += '.' + nextVal
        state.pos++
      } else {
        break
      }
    }
    // 未知标识符：作为变量引用存储（eval 时查 variables，未找到 → false）
    return { op: 'var', varName }
  }
  return { op: 'literal', value: null }
}

function evalAST(ast: AST, variables: Record<string, unknown>): boolean {
  function getVal(node: AST): unknown {
    if (node.op === 'var') {
      const name = node.varName!
      if (name.includes('.')) {
        // Handle property access like variables.depth
        const parts = name.split('.')
        let val: unknown
        if (parts[0] === 'variables') {
          // variables.depth -> access variables['depth']
          val = variables
          for (let i = 1; i < parts.length; i++) {
            const part = parts[i]
            if (PROTECTED_PROPERTIES.has(part)) return undefined
            if (val && typeof val === 'object') {
              val = (val as Record<string, unknown>)[part]
            } else {
              return undefined
            }
          }
          return val
        } else {
          // user.name -> access variables['user']['name']
          val = variables
          for (const part of parts) {
            if (PROTECTED_PROPERTIES.has(part)) return undefined
            if (val && typeof val === 'object') {
              val = (val as Record<string, unknown>)[part]
            } else {
              return undefined
            }
          }
          return val
        }
      }
      return variables[name]
    }
    if (node.op === 'literal') return node.value
    return evalAST(node, variables)
  }
  function toNum(v: unknown): number {
    if (typeof v === 'number') return v
    if (v === null || v === undefined) return 0
    if (typeof v === 'boolean') return v ? 1 : 0
    if (typeof v === 'string') { const n = Number(v); return isNaN(n) ? 0 : n }
    return 0
  }
  function isTrue(v: unknown): boolean {
    if (typeof v === 'boolean') return v
    if (v === null || v === undefined) return false
    if (typeof v === 'number') return v !== 0
    if (typeof v === 'string') return v.length > 0
    return Boolean(v)
  }

  switch (ast.op) {
    case '||': return isTrue(evalAST(ast.left!, variables)) || isTrue(evalAST(ast.right!, variables))
    case '&&': return isTrue(evalAST(ast.left!, variables)) && isTrue(evalAST(ast.right!, variables))
    case '!': return !isTrue(evalAST(ast.right!, variables))
    case '==': return getVal(ast.left!) === getVal(ast.right!)
    case '!=': return getVal(ast.left!) !== getVal(ast.right!)
    case '>': return toNum(getVal(ast.left!)) > toNum(getVal(ast.right!))
    case '<': return toNum(getVal(ast.left!)) < toNum(getVal(ast.right!))
    case '>=': return toNum(getVal(ast.left!)) >= toNum(getVal(ast.right!))
    case '<=': return toNum(getVal(ast.left!)) <= toNum(getVal(ast.right!))
    case 'var': {
      const name = ast.varName!
      if (name.includes('.')) {
        // Handle property access like variables.depth or user.name
        // 'variables.depth' means ctx.variables.depth, so we start from variables object
        // 'user.name' means a nested property on the root object (variables itself)
        const parts = name.split('.')
        let val: unknown
        if (parts[0] === 'variables') {
          // variables.depth -> access variables['depth']
          val = variables
          for (let i = 1; i < parts.length; i++) {
            const part = parts[i]
            if (PROTECTED_PROPERTIES.has(part)) return false
            if (val && typeof val === 'object') {
              val = (val as Record<string, unknown>)[part]
            } else {
              return false
            }
          }
        } else {
          // user.name -> access variables['user']['name']
          val = variables
          for (const part of parts) {
            if (PROTECTED_PROPERTIES.has(part)) return false
            if (val && typeof val === 'object') {
              val = (val as Record<string, unknown>)[part]
            } else {
              return false
            }
          }
        }
        return isTrue(val)
      }
      return isTrue(variables[name])
    }
    case 'literal': return isTrue(ast.value)
    default: return false
  }
}

// ============================================================
// 4. Skill 执行引擎
// ============================================================

/**
 * 工具执行器类型定义
 * 
 * @typedef {function} ToolExecutor
 * @param {string} name - 工具名称
 * @param {Record<string, unknown>} args - 工具参数
 * @returns {Promise<unknown>} 工具执行结果
 */
export type ToolExecutor = (name: string, args: Record<string, unknown>) => Promise<unknown>

/**
 * 执行 Skill 模板
 * 
 * @function executeSkill
 * @param {string} skillContent - Skill Markdown 内容
 * @param {SkillContext} context - 执行上下文
 * @param {ToolExecutor} executor - 工具执行器
 * @returns {Promise<string>} 渲染后的文本
 * 
 * @description
 * 解析并执行 Skill 模板，返回渲染后的文本。
 * 支持条件分支、循环、变量插值和工具调用。
 * 
 * @example
 * ```typescript
 * const result = await executeSkill(
 *   skillContent,
 *   { variables: { name: 'test' }, timestamp: Date.now() },
 *   async (name, args) => { /* 执行工具 *\/ }
 * )
 * ```
 */
export async function executeSkill(
  skillContent: string,
  context: SkillContext,
  executor: ToolExecutor
): Promise<string> {
  const blocks = parseSkillTemplate(skillContent)
  return renderBlocks(blocks, context, executor)
}

/**
 * 渲染块数组为文本
 * 
 * @private
 * @param {SkillBlock[]} blocks - 块数组
 * @param {SkillContext} ctx - 执行上下文
 * @param {ToolExecutor} executor - 工具执行器
 * @returns {Promise<string>}
 */
// 递归渲染深度计数器（模块级，不污染 ctx）
let _renderDepth = 0

async function renderBlocks(
  blocks: SkillBlock[],
  ctx: SkillContext,
  executor: ToolExecutor
): Promise<string> {
  // 递归深度保护，防止栈溢出
  if (++_renderDepth > MAX_RENDER_DEPTH) {
    _renderDepth--
    throw new Error(`Skill template recursion limit exceeded (max ${MAX_RENDER_DEPTH})`)
  }

  const parts: string[] = []

  try {
    for (const block of blocks) {
      switch (block.type) {
        case 'text':
          parts.push(interpolateAll(block.content, ctx))
          break

        case 'condition':
          if (evaluateCondition(block.condition!, ctx)) {
            const rendered = await renderBlocks(block.children || [], ctx, executor)
            parts.push(rendered)
          }
          break

        case 'loop': {
          const rawItems = resolveValue(block.content, ctx)
          if (Array.isArray(rawItems)) {
            // DoS 保护：限制循环项数量
            const items = rawItems.slice(0, MAX_LOOP_ITEMS)
            for (const item of items) {
              const loopCtx = { ...ctx, __loop_var__: item }
              const rendered = await renderBlocks(block.children || [], loopCtx, executor)
              // 替换循环变量占位符
              parts.push(rendered.replace(/\{\{__loop_var__\}\}/g, String(item)))
            }
          }
          break
        }

        case 'tool':
          if (block.toolName) {
            try {
              const result = await executor(block.toolName, block.toolArgs || {})
              parts.push(String(result))
            } catch (e) {
              parts.push(`[Tool error: ${e}]`)
            }
          }
          break

        case 'include': {
          // 支持 {{> other-skill}} 引用其他 skill
          const included = await loadAndExecuteOtherSkill(block.content, ctx, executor)
          parts.push(included)
          break
        }
      }
    }
  } finally {
    _renderDepth--
  }

  return parts.join('')
}

/**
 * 对文本中的所有变量进行插值
 * 
 * @private
 * @param {string} text - 原始文本
 * @param {SkillContext} ctx - 执行上下文
 * @returns {string} 插值后的文本
 */
function interpolateAll(text: string, ctx: SkillContext): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (_, expr) => {
    return String(resolveValue(expr.trim(), ctx))
  })
}

/**
 * 解析属性访问表达式
 * 
 * @private
 * @param {string} expr - 表达式（如 `user.name` 或 `variables.depth`）
 * @param {SkillContext} ctx - 执行上下文
 * @returns {unknown} 解析后的值
 */
function resolveValue(expr: string, ctx: SkillContext): unknown {
  // 支持特殊变量
  if (expr === 'timestamp') {
    return ctx.timestamp
  }
  if (expr === 'userId') {
    return ctx.userId
  }
  if (expr === 'sessionKey') {
    return ctx.sessionKey
  }

  // 支持属性访问：user.name → variables.user.name
  // 阻断原型链特殊属性访问
  const parts = expr.split('.')

  // 简单变量名：直接查 variables[varName]
  if (parts.length === 1) {
    if (PROTECTED_PROPERTIES.has(parts[0])) return undefined
    return ctx.variables[parts[0]] ?? expr
  }

  // 多层属性访问：user.name → variables.user.name
  let value: unknown = ctx.variables
  for (const part of parts) {
    if (PROTECTED_PROPERTIES.has(part)) return undefined
    if (value && typeof value === 'object') {
      value = (value as Record<string, unknown>)[part]
    } else {
      return expr // fallback to raw expr
    }
  }
  return value ?? expr
}

/**
 * 加载并执行引用的 Skill
 * 
 * @private
 * @param {string} skillName - Skill 名称
 * @param {SkillContext} ctx - 执行上下文
 * @param {ToolExecutor} executor - 工具执行器
 * @returns {Promise<string>}
 */
async function loadAndExecuteOtherSkill(
  skillName: string,
  ctx: SkillContext,
  executor: ToolExecutor
): Promise<string> {
  try {
    const content = await loadSkill(skillName)
    // 去除 frontmatter，只执行 body
    const { body } = parseSkillFrontmatter(content)
    return await executeSkill(body, ctx, executor)
  } catch {
    return `[Skill not found: ${skillName}]`
  }
}

// ============================================================
// 5. Skill 文件加载 + 缓存
// ============================================================

/** Skill 缓存表 */
const SKILL_CACHE = new Map<string, { content: string; mtime: number }>()

/** 默认 Skill 目录 */
const SKILL_DIR = () => process.env.OPENCLAW_SKILL_DIR ?? path.join(OPENCLAW_WORKSPACE(), 'skills')

/**
 * 加载 Skill 文件（带 mtime 缓存）
 * 
 * @function loadSkill
 * @param {string} name - Skill 名称（不含 .md 后缀）
 * @returns {Promise<string>} Skill 文件内容
 * 
 * @description
 * 从 Skill 目录加载指定的 Skill 文件。
 * 使用 mtime 做缓存失效：当文件修改时间变化时自动重新加载。
 * 
 * @example
 * ```typescript
 * const content = await loadSkill('repo-dive')
 * ```
 */
export async function loadSkill(name: string): Promise<string> {
  const candidatePaths = [
    path.join(SKILL_DIR(), `${name}.md`),
    path.join(SKILL_DIR(), name, 'SKILL.md'),
  ]

  let filePath: string | null = null
  for (const candidate of candidatePaths) {
    try {
      await fs.stat(candidate)
      filePath = candidate
      break
    } catch {
      // try next location
    }
  }

  if (!filePath) {
    throw new Error(`Skill not found: ${name}`)
  }

  const stat = await fs.stat(filePath)
  
  const cached = SKILL_CACHE.get(name)
  if (cached && cached.mtime === stat.mtimeMs) {
    return cached.content
  }

  const content = await fs.readFile(filePath, 'utf8')
  SKILL_CACHE.set(name, { content, mtime: stat.mtimeMs })
  return content
}

/**
 * 失效 Skill 缓存
 * 
 * @function invalidateSkillCache
 * @param {string} [name] - Skill 名称，不传则清除所有缓存
 * 
 * @example
 * ```typescript
 * // 清除单个 Skill 缓存
 * invalidateSkillCache('repo-dive')
 * 
 * // 清除所有缓存
 * invalidateSkillCache()
 * ```
 */
export function invalidateSkillCache(name?: string): void {
  if (name) {
    SKILL_CACHE.delete(name)
  } else {
    SKILL_CACHE.clear()
  }
}

// ============================================================
// 6. Skill YAML frontmatter 解析
// ============================================================

/**
 * 解析 YAML frontmatter
 * 
 * @function parseSkillFrontmatter
 * @param {string} content - Skill 文件原始内容
 * @returns {{ meta: Partial<SkillMeta>; body: string }} 解析后的元数据和正文
 * 
 * @description
 * 解析 Markdown 文件头部的 YAML 元数据。
 * 格式：
 * ```markdown
 * ---
 * name: xxx
 * description: xxx
 * ---
 * 正文内容
 * ```
 * 
 * @example
 * ```typescript
 * const { meta, body } = parseSkillFrontmatter(content)
 * console.log(meta.name) // 'repo-dive'
 * ```
 */
export function parseSkillFrontmatter(content: string): { meta: Partial<SkillMeta>; body: string } {
  const match = content.match(/^---\n([\s\S]+?)\n---\n([\s\S]*)$/)
  if (!match) return { meta: {}, body: content }

  const yamlStr = match[1]
  const body = match[2]
  const meta: Partial<SkillMeta> = {}

  for (const line of yamlStr.split('\n')) {
    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) continue
    
    const key = line.slice(0, colonIndex).trim()
    const rawValue = line.slice(colonIndex + 1).trim()
    
    if (!key) continue
    
    if (key === 'triggers') {
      meta.triggers = rawValue.split(',').map(s => s.trim())
    } else if (key === 'variables') {
      // 简化处理：variables 部分需要更复杂的 YAML 解析
      // 这里做基础支持
      meta.variables = {}
    } else {
      // 去除引号
      const value = rawValue.replace(/^['"]|['"]$/g, '')
      ;(meta as Record<string, unknown>)[key] = value
    }
  }

  return { meta, body }
}

// ============================================================
// 7. Skill 发现 + 匹配
// ============================================================

/**
 * 发现目录下所有 Skill
 * 
 * @function discoverSkills
 * @param {string} [dir] - Skill 目录路径，默认使用 SKILL_DIR
 * @returns {Promise<Array<SkillMeta & { path: string }>>} Skill 列表
 * 
 * @description
 * 递归扫描指定目录，查找所有 `.md` 文件并解析其 frontmatter。
 * 
 * @example
 * ```typescript
 * const skills = await discoverSkills()
 * skills.forEach(s => console.log(s.name, s.path))
 * ```
 */
export async function discoverSkills(dir?: string): Promise<Array<SkillMeta & { path: string }>> {
  const skillDir = dir || SKILL_DIR()
  const skills: Array<SkillMeta & { path: string }> = []
  
  async function walk(skillPath: string): Promise<void> {
    try {
      const entries = await fs.readdir(skillPath, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(skillPath, entry.name)
        if (entry.isDirectory()) {
          await walk(fullPath)
        } else if (entry.name.endsWith('.md')) {
          try {
            const content = await fs.readFile(fullPath, 'utf8')
            const { meta } = parseSkillFrontmatter(content)
            skills.push({ ...meta, path: fullPath } as SkillMeta & { path: string })
          } catch {
            // 忽略无法读取的文件
          }
        }
      }
    } catch {
      // 忽略无法访问的目录
    }
  }

  await walk(skillDir)
  return skills
}

/**
 * 按关键词匹配 Skill
 * 
 * @function matchSkills
 * @param {string} query - 查询关键词
 * @param {number} [limit=5] - 返回数量上限
 * @returns {Promise<Array<SkillMeta & { path: string; score: number }>>} 匹配的 Skill 列表
 * 
 * @description
 * 在所有发现的 Skill 中按关键词搜索并评分排序。
 * 评分规则：
 * - 名称匹配：2 分
 * - 描述匹配：1 分
 * - 触发词匹配：1.5 分
 * 
 * @example
 * ```typescript
 * const results = await matchSkills('代码分析', 3)
 * console.log(results[0].name) // 最相关的 Skill 名称
 * ```
 */
export async function matchSkills(
  query: string, 
  limit = 5
): Promise<Array<SkillMeta & { path: string; score: number }>> {
  const all = await discoverSkills()
  const q = query.toLowerCase()
  
  return all
    .map(skill => {
      const nameMatch = skill.name?.toLowerCase().includes(q) ? 2 : 0
      const descMatch = skill.description?.toLowerCase().includes(q) ? 1 : 0
      const triggerMatch = skill.triggers?.some(t => t.toLowerCase().includes(q)) ? 1.5 : 0
      return { ...skill, score: nameMatch + descMatch + triggerMatch }
    })
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

// ============================================================
// 8. Skill Markdown 语法规范
// ============================================================

/**
 * @section Skill Markdown 语法规范 v1.0
 * 
 * ## 概述
 * 
 * Skill Markdown 是 OpenClaw Skill 系统的模板格式，支持在纯 Markdown 中
 * 嵌入条件逻辑、变量插值、循环和工具调用，实现可执行的 Skill 模板。
 * 
 * ## 文件结构
 * 
 * ```markdown
 * ---
 * name: skill-name
 * description: Skill 描述
 * version: 1.0.0
 * updated: 2024-01-01
 * triggers: 触发词1, 触发词2
 * variables:
 *   var_name:
 *     type: string
 *     default: default_value
 *     description: 变量描述
 * ---
 * 
 * # 正文内容
 * 
 * ```
 * 
 * ## 变量插值
 * 
 * 使用 `{{variableName}}` 或 `{{obj.property}}` 进行变量插值：
 * 
 * ```markdown
 * 欢迎，{{user.name}}！
 * 路径：`{{variables.repo_path}}`
 * ```
 * 
 * **内置变量**：
 * - `{{timestamp}}` - 执行时间戳
 * - `{{userId}}` - 当前用户 ID
 * - `{{sessionKey}}` - 当前会话 Key
 * 
 * ## 条件块
 * 
 * 使用 `{{#if condition}}...{{/if}}` 实现条件渲染：
 * 
 * ```markdown
 * {{#if variables.depth > 3}}
 * > 注意：深度较大可能耗时较长
 * {{/if}}
 * ```
 * 
 * **支持的运算符**：
 * - 比较：`==`、`!=`、`>`、`<`、`>=`、`<=`
 * - 逻辑：`&&`、`||`、`!`
 * - 分组：`()`
 * 
 * ## 循环块
 * 
 * 使用 `{{#each item in items}}...{{/each}}` 实现循环渲染：
 * 
 * ```markdown
 * {{#each variables.triggers as trigger}}
 * - [ ] {{trigger}}
 * {{/each}}
 * ```
 * 
 * 循环变量 `{{trigger}}` 在循环体内可用。
 * 
 * ## 工具调用
 * 
 * 使用 `{{#tool toolName arg1=value1 arg2="value 2"}}` 调用工具：
 * 
 * ```markdown
 * {{#tool exec command="ls -la"}}
 * ```
 * 
 * 工具调用的结果将插入到渲染结果中。
 * 
 * ## Skill 引用
 * 
 * 使用 `{{> other-skill}}` 引用其他 Skill：
 * 
 * ```markdown
 * {{> common-header}}
 * ```
 * 
 * 引用的 Skill 会被加载并执行，其结果插入到当前位置。
 * 
 * ## 完整示例
 * 
 * ```markdown
 * ---
 * name: repo-dive
 * description: 系统性阅读代码仓库
 * version: 1.0.0
 * updated: 2026-04-04
 * triggers: 代码分析, 读仓库, 代码审查
 * variables:
 *   repo_path:
 *     type: string
 *     default: .
 *     description: 仓库路径
 *   depth:
 *     type: number
 *     default: 2
 *     description: 遍历深度
 * ---
 * 
 * # {{name}} - {{description}}
 * 
 * 目标路径：`{{variables.repo_path}}`
 * 
 * {{#if variables.depth > 3}}
 * > 注意：深度 {{variables.depth}} 可能耗时较长
 * {{/if}}
 * 
 * ## 执行摘要
 * 
 * - 路径：`{{variables.repo_path}}`
 * - 深度：`{{variables.depth}}`
 * - 时间：`{{timestamp}}`
 * 
 * {{#each variables.triggers as trigger}}
 * - [ ] {{trigger}}
 * {{/each}}
 * ```
 */
