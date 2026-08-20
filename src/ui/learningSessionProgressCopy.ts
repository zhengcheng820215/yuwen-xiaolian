export function formatNextTaskAction(nextTaskNumber: number, totalTaskCount: number): string {
  return `进入第 ${nextTaskNumber} 题（共 ${totalTaskCount} 题）`;
}

export function formatNextTaskContinuation(nextTaskNumber: number, totalTaskCount: number): string {
  return `本题结果已经保存，接下来进入第 ${nextTaskNumber} 题（共 ${totalTaskCount} 题）。`;
}
