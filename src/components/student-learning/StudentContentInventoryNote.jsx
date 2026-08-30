export default function StudentContentInventoryNote({ inventory }) {
  const formalText = inventory.formal.status === 'available' && Number.isInteger(inventory.formal.currentCount)
    ? `正式阅读题库当前有 ${inventory.formal.currentCount} 道发布题目，由系统按学习目标调度。`
    : '正式阅读内容由系统按学习目标调度，当前库存数量暂不可读取。';
  return (
    <div className="rounded-lg bg-slate-100 px-4 py-3 text-xs leading-5 text-slate-600">
      <p>{formalText}</p>
      <p className="mt-1">基础知识巩固另有 {inventory.knowledge.approvedCount} 道已审核轻量题，两类内容不合并计算。</p>
    </div>
  );
}
