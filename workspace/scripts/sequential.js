/**
 * 顺序执行封装器 - 防止并发竞态
 *
 * 功能：将一个异步函数包装成顺序执行的版本，确保并发调用时任务串行化排队执行，
 * 同时保证每个调用返回正确的值。
 *
 * 适用场景：文件写入、数据库更新等不能并发执行的操作。
 *
 * @param {Function} fn - 要包装的异步函数
 * @returns {Function} 包装后的函数，调用时会自动排队
 */
function sequential(fn) {
  // 队列，用于存放待执行的任务项
  // 每项包含：args（参数）、resolve（成功回调）、reject（失败回调）、context（this上下文）
  const queue = []

  // 标记是否正在处理队列，防止重复触发 processQueue
  let processing = false

  // 核心：不断从队列中取出任务执行，直到队列清空
  async function processQueue() {
    // 已经在处理中，直接返回
    if (processing) return
    // 队列空了，也返回
    if (queue.length === 0) return

    // 开始处理，标记为忙
    processing = true

    // 循环处理队列中的所有任务
    while (queue.length > 0) {
      // 取出队首任务
      const { args, resolve, reject, context } = queue.shift()

      try {
        // 执行原始函数，绑定正确的 this 上下文
        const result = await fn.apply(context, args)
        resolve(result)
      } catch (error) {
        // 执行出错了，传递给调用者的 reject
        reject(error)
      }
    }

    // 处理完了，标记为空闲
    processing = false

    // 处理期间可能有新任务入队，再次检查并继续处理
    if (queue.length > 0) {
      void processQueue()
    }
  }

  // 返回包装后的函数
  return function (...args) {
    // 每个调用返回一个 Promise，同时把自己注册到队列中
    return new Promise((resolve, reject) => {
      queue.push({ args, resolve, reject, context: this })
      void processQueue()
    })
  }
}

// 使用示例：
// const writeQueue = sequential(async (data) => {
//   // 防止多个进程同时写 memory/ 文件
//   fs.writeFileSync('memory/2026-04-03.md', data)
// })
// writeQueue('hello')  // 自动排队，不会并发冲突

module.exports = { sequential }
