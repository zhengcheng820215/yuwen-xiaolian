import { useEffect, useState } from 'react';
import { loadProgressiveLoadStage4Review } from '../api/progressiveLoadStage4Review.ts';

export default function ProgressiveLoadStage4Review() {
  const [state, setState] = useState({ status: 'loading' });
  useEffect(() => {
    loadProgressiveLoadStage4Review()
      .then((data) => setState({ status: 'ready', data }))
      .catch((error) => setState({ status: 'error', message: error instanceof Error ? error.message : String(error) }));
  }, []);
  if (state.status === 'loading') return <main style={styles.page}><h1>正在读取递进训练观察数据…</h1></main>;
  if (state.status === 'error') return <main style={styles.page}><h1>暂时无法读取</h1><p>{state.message}</p></main>;
  const { governance, calibration } = state.data;
  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <p style={styles.eyebrow}>内部观察 · 不面向学生</p>
        <h1 style={styles.title}>阅读训练递进负担观察</h1>
        <p style={styles.subtitle}>这里只呈现版本事实、样本完整性和限制，不据此直接判断学生能力或教育效果。</p>
      </header>
      <section style={styles.card}>
        <h2>历史题治理</h2>
        <p>共 {governance.total} 个受控上下文；已选择 {governance.selected}，已接入既有治理链 {governance.linked}，失效 {governance.stale}，已解决 {governance.resolved}。</p>
        {governance.contexts.length === 0 ? <p style={styles.muted}>当前没有进入小批次治理的历史题。</p> : governance.contexts.map((item) => (
          <article key={item.governanceContextId} style={styles.row}>
            <strong>{item.sourceResourceVersionId}</strong>
            <span>优先级 {item.priority} · {item.status}</span>
            <span>{item.findingCodes.join('、')}</span>
          </article>
        ))}
      </section>
      <section style={styles.card}>
        <h2>真实校准样本</h2>
        <p>已记录 {calibration.eventCount} 条过程事实，形成 {calibration.projectionCount} 个版本级投影。</p>
        {calibration.projections.length === 0 ? <p style={styles.muted}>尚无合格真实样本，继续正常使用即可。</p> : calibration.projections.map((item) => (
          <article key={item.projectionId} style={styles.row}>
            <strong>{item.resourceVersionId}</strong>
            <span>{statusLabel(item.status)} · 有效独立首答 {item.validInitialAttemptCount} · 学习者 {item.distinctLearnerCount}</span>
            {item.limitations.map((text) => <span key={text} style={styles.muted}>{text}</span>)}
          </article>
        ))}
      </section>
    </main>
  );
}

function statusLabel(status) {
  return ({ awaiting_data: '等待真实数据', collecting: '持续收集中', insufficient_sample: '样本不足', review_ready: '可以复核', calibrated: '当前规则已确认', integrity_blocked: '身份完整性异常' })[status] || status;
}

const styles = {
  page: { minHeight: '100vh', background: '#f6f8fb', padding: '48px', color: '#172033', fontFamily: 'system-ui, sans-serif' },
  header: { maxWidth: 1080, margin: '0 auto 28px' },
  eyebrow: { color: '#6d28d9', fontWeight: 700 },
  title: { margin: '6px 0 8px', fontSize: 34 },
  subtitle: { color: '#526079', lineHeight: 1.7 },
  card: { maxWidth: 1080, margin: '0 auto 22px', background: '#fff', border: '1px solid #dbe3ef', borderRadius: 14, padding: 28 },
  row: { display: 'grid', gap: 7, padding: '18px 0', borderTop: '1px solid #edf1f7' },
  muted: { color: '#6b7891' },
};
