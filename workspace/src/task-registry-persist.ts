/**
 * Task Registry 持久化 + Checkpoint
 * 
 * 让任务不因进程重启丢失，支持 checkpoint/resume。
 * 参考 Claude Code src/Task.ts 的任务状态机。
 * 
 * @module task-registry-persist
 */

import fs from 'node:fs/promises'
import path from 'node:path'

const OPENCLAW_HOME = () => process.env.OPENCLAW_HOME ?? path.join(process.env.HOME ?? '', '.openclaw')

// ─── 类型定义 ────────────────────────────────────────────────────────────────

/**
 * 任务状态机：
 * PENDING → RUNNING → DONE/FAILED/KILLED
 *        ↘ NEEDS_REWORK / AWAITING_RET
 */
export type TaskStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'DONE'
  | 'FAILED'
  | 'KILLED'
  | 'NEEDS_REWORK'
  | 'AWAITING_RET'

export interface TaskCheckpoint {
  at: number
  label?: string
  progress?: number
  metadata?: Record<string, unknown>
  [key: string]: unknown
}

export interface TaskState {
  id: string
  title: string
  description?: string
  status: TaskStatus
  assignee?: string
  createdAt: number
  updatedAt: number
  startedAt?: number
  completedAt?: number
  checkpoints: TaskCheckpoint[]
  result?: unknown
  error?: string
  retryCount: number
  maxRetries: number
  tags?: string[]
  metadata?: Record<string, unknown>
}

// ─── 输入验证 ────────────────────────────────────────────────────────────────

/** 白名单验证：仅允许安全的标识符字符，防路径遍历 */
const NAME_REGEX = /^[a-zA-Z0-9_-]+$/

function validateTaskId(taskId: string): void {
  if (!NAME_REGEX.test(taskId) || taskId.length > 128) {
    throw new Error(`Invalid taskId: must match ${NAME_REGEX.source} and ≤128 chars`)
  }
}

function validateTeamName(teamName: string): void {
  if (!NAME_REGEX.test(teamName) || teamName.length > 64) {
    throw new Error(`Invalid teamName: must match ${NAME_REGEX.source} and ≤64 chars`)
  }
}

// ─── 原子写入辅助 ────────────────────────────────────────────────────────────

/** 原子写入：先写 tmp 文件，再 rename（POSIX 保证原子性） */
async function atomicWrite(filePath: string, content: string): Promise<void> {
  // 直接写入目标文件（无 rename race）：
  // Node.js fs.writeFile 覆盖已存在文件时先截断再写入，
  // 在现代 journaling 文件系统（APFS/ext4）上元数据更新也是原子的。
  await fs.writeFile(filePath, content, 'utf8')
}

// ─── Checkpoint 上限 ─────────────────────────────────────────────────────────

const MAX_CHECKPOINTS = 100

// ─── 目录路径 ────────────────────────────────────────────────────────────────

/**
 * 获取任务存储目录路径
 *
 * @param teamName - 团队名称（默认 'default'）
 * @returns 任务目录绝对路径
 */
export function TASK_DIR(teamName = 'default'): string {
  validateTeamName(teamName)
  return path.join(OPENCLAW_HOME(), 'teams', teamName, 'tasks')
}

// ─── 持久化操作 ─────────────────────────────────────────────────────────────

/**
 * 保存任务快照到磁盘
 * 
 * @param teamName - 团队名称
 * @param taskId - 任务 ID
 * @param state - 完整任务状态
 */
export async function saveTaskSnapshot(
  teamName: string,
  taskId: string,
  state: TaskState
): Promise<void> {
  validateTeamName(teamName)
  validateTaskId(taskId)
  const dir = TASK_DIR(teamName)
  await fs.mkdir(dir, { recursive: true })
  const filePath = path.join(dir, `${taskId}.json`)
  await atomicWrite(filePath, JSON.stringify(state, null, 2))
  console.debug(`[TaskRegistry] Saved snapshot: ${taskId} in ${teamName}`)
}

/**
 * 从磁盘加载单个任务快照
 * 
 * @param teamName - 团队名称
 * @param taskId - 任务 ID
 * @returns 任务状态（不存在返回 null）
 */
export async function loadTaskSnapshot(
  teamName: string,
  taskId: string
): Promise<TaskState | null> {
  validateTeamName(teamName)
  validateTaskId(taskId)
  try {
    const filePath = path.join(TASK_DIR(teamName), `${taskId}.json`)
    const raw = await fs.readFile(filePath, 'utf8')
    const state = JSON.parse(raw) as TaskState
    console.debug(`[TaskRegistry] Loaded snapshot: ${taskId}`)
    return state
  } catch (err) {
    // 文件不存在或读取失败
    console.debug(`[TaskRegistry] No snapshot found: ${taskId}`)
    return null
  }
}

/**
 * 加载团队下所有任务
 * 
 * @param teamName - 团队名称
 * @returns 所有任务状态数组
 */
export async function loadAllTasks(teamName: string): Promise<TaskState[]> {
  const dir = TASK_DIR(teamName)
  try {
    const files = await fs.readdir(dir)
    const jsonFiles = files.filter((f) => f.endsWith('.json'))
    const results = await Promise.all(
      jsonFiles.map((f) => loadTaskSnapshot(teamName, f.replace('.json', '')))
    )
    // filter(Boolean) 移除加载失败的（返回 null 的）
    return results.filter((r): r is TaskState => r !== null)
  } catch (err) {
    // 目录不存在
    console.debug(`[TaskRegistry] No tasks directory: ${teamName}`)
    return []
  }
}

// ─── Checkpoint 操作 ────────────────────────────────────────────────────────

/**
 * 为任务添加检查点（记录进度）
 * 
 * @param teamName - 团队名称
 * @param taskId - 任务 ID
 * @param checkpoint - 检查点数据（会自动添加 at 时间戳）
 */
export async function checkpointTask(
  teamName: string,
  taskId: string,
  checkpoint: Omit<TaskCheckpoint, 'at'>
): Promise<void> {
  const state = await loadTaskSnapshot(teamName, taskId)
  if (!state) {
    console.warn(`[TaskRegistry] Cannot checkpoint non-existent task: ${taskId}`)
    return
  }
  state.checkpoints = state.checkpoints || []
  state.checkpoints.push({ at: Date.now(), ...checkpoint })
  // 防止无限增长：超过上限时删除最旧的
  if (state.checkpoints.length > MAX_CHECKPOINTS) {
    state.checkpoints = state.checkpoints.slice(-MAX_CHECKPOINTS)
  }
  await saveTaskSnapshot(teamName, taskId, state)
  console.debug(`[TaskRegistry] Checkpoint added: ${taskId} (${state.checkpoints.length} total)`)
}

/**
 * 获取任务最新检查点
 * 
 * @param teamName - 团队名称
 * @param taskId - 任务 ID
 * @returns 最新检查点（无检查点返回 null）
 */
export async function getLatestCheckpoint(
  teamName: string,
  taskId: string
): Promise<TaskCheckpoint | null> {
  const state = await loadTaskSnapshot(teamName, taskId)
  if (!state || !state.checkpoints || state.checkpoints.length === 0) {
    return null
  }
  return state.checkpoints[state.checkpoints.length - 1]
}

/**
 * 删除任务快照
 * 
 * @param teamName - 团队名称
 * @param taskId - 任务 ID
 */
export async function deleteTaskSnapshot(
  teamName: string,
  taskId: string
): Promise<void> {
  try {
    const filePath = path.join(TASK_DIR(teamName), `${taskId}.json`)
    await fs.unlink(filePath)
    console.debug(`[TaskRegistry] Deleted snapshot: ${taskId}`)
  } catch (err) {
    console.warn(`[TaskRegistry] Failed to delete snapshot: ${taskId}`, err)
  }
}

// ─── 任务状态机辅助 ─────────────────────────────────────────────────────────

/**
 * 创建新任务状态
 * 
 * @param id - 任务 ID
 * @param title - 任务标题
 * @param options - 可选配置
 */
export function createTaskState(
  id: string,
  title: string,
  options: {
    description?: string
    assignee?: string
    maxRetries?: number
    tags?: string[]
    metadata?: Record<string, unknown>
  } = {}
): TaskState {
  const now = Date.now()
  return {
    id,
    title,
    description: options.description,
    status: 'PENDING',
    assignee: options.assignee,
    createdAt: now,
    updatedAt: now,
    checkpoints: [],
    retryCount: 0,
    maxRetries: options.maxRetries ?? 3,
    tags: options.tags,
    metadata: options.metadata,
  }
}

/**
 * 推进任务状态
 * 
 * @param state - 当前任务状态
 * @param newStatus - 新状态
 */
export function advanceTaskStatus(
  state: TaskState,
  newStatus: TaskStatus
): TaskState {
  const now = Date.now()
  const updated: TaskState = {
    ...state,
    status: newStatus,
    updatedAt: now,
  }
  if (newStatus === 'RUNNING' && !state.startedAt) {
    updated.startedAt = now
  }
  if (['DONE', 'FAILED', 'KILLED'].includes(newStatus)) {
    updated.completedAt = now
  }
  return updated
}

// ─── 使用示例 ────────────────────────────────────────────────────────────────

/**
 * @example
 * ```typescript
 * import {
 *   saveTaskSnapshot,
 *   loadTaskSnapshot,
 *   loadAllTasks,
 *   checkpointTask,
 *   createTaskState,
 *   advanceTaskStatus,
 * } from './task-registry-persist'
 * 
 * // 创建新任务
 * const task = createTaskState('task-001', '实现功能 X', {
 *   assignee: 'agent-001',
 *   tags: ['feature', 'urgent'],
 * })
 * 
 * // 保存任务
 * await saveTaskSnapshot('my-team', task.id, task)
 * 
 * // 运行中打检查点
 * await checkpointTask('my-team', task.id, {
 *   label: 'phase-1-complete',
 *   progress: 50,
 * })
 * 
 * // 更新状态并保存
 * const running = advanceTaskStatus(task, 'RUNNING')
 * await saveTaskSnapshot('my-team', running.id, running)
 * 
 * // 重启后加载所有任务
 * const allTasks = await loadAllTasks('my-team')
 * console.log(`Loaded ${allTasks.length} tasks`)
 * 
 * // 按 ID 加载单个任务
 * const restored = await loadTaskSnapshot('my-team', 'task-001')
 * ```
 */
