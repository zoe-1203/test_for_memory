'use client';
import { useEffect, useMemo, useState } from 'react';

type MemoryItem = { id: string; text: string };

export default function Home() {
  // ---- 输入问题 ----
  const [question, setQuestion] = useState('');

  // ---- Memory（可增删、持久化 localStorage）----
  const [memoryText, setMemoryText] = useState('');
  const [memories, setMemories] = useState<MemoryItem[]>([]);

  // localStorage key
  const STORAGE_KEY = 'tools-mvp-memories';

  // 初始读 localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setMemories(JSON.parse(raw));
    } catch {}
  }, []);

  // 保存到 localStorage
  const saveMemories = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memories));
    alert('Memory 已保存到本地（localStorage）。');
  };

  // 增加一条 memory
  const addMemory = () => {
    const text = memoryText.trim();
    if (!text) return;
    setMemories((prev) => [...prev, { id: String(Date.now()), text }]);
    setMemoryText('');
  };

  // 删除一条 memory
  const removeMemory = (id: string) => {
    setMemories((prev) => prev.filter((m) => m.id !== id));
  };

  // ---- 抽牌按钮的点击（阶段 1 先打日志）----
  const onDrawClick = () => {
    console.log('[DEBUG] 点击抽牌：', { question, memories });
    if (!question.trim()) {
      alert('请先在输入框里键入你的问题～');
      return;
    }
    alert('已触发“抽牌”逻辑（阶段 1）。请打开浏览器控制台查看日志。');
  };

  const memoryCount = useMemo(() => memories.length, [memories]);

  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: 24, fontFamily: 'ui-sans-serif, system-ui' }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Tarot Tools MVP</h1>
      <p style={{ color: '#555', marginBottom: 24 }}>
        阶段 1：先完成 UI 与交互（输入问题、抽牌按钮、Memory 增删保存）。点击抽牌会在控制台打日志。
      </p>

      {/* 输入问题 */}
      <section style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>你的问题 / 主题：</label>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="例如：我该如何推进目前的感情关系？"
          rows={4}
          style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #ddd' }}
        />
      </section>

      {/* 抽牌按钮 */}
      <section style={{ marginBottom: 32 }}>
        <button
          onClick={onDrawClick}
          style={{
            padding: '10px 16px',
            fontWeight: 600,
            borderRadius: 10,
            border: '1px solid #111',
            background: '#111',
            color: '#fff',
            cursor: 'pointer'
          }}
        >
          🃏 抽牌并解读（阶段 1：仅日志）
        </button>
      </section>

      {/* Memory 面板 */}
      <section>
        <h2 style={{ fontSize: 20, marginBottom: 12 }}>Memory（你可以自定义，后续工具会引用）</h2>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            value={memoryText}
            onChange={(e) => setMemoryText(e.target.value)}
            placeholder="输入一条 memory（按下 + 号添加）"
            style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #ddd' }}
          />
          <button
            onClick={addMemory}
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid #ccc',
              background: '#f5f5f5',
              cursor: 'pointer'
            }}
          >
            ＋
          </button>
        </div>

        {memoryCount === 0 ? (
          <p style={{ color: '#777' }}>暂无 memory。可以添加如：对方星座、你们沟通频率、你的边界需求、过往塔罗结论等。</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {memories.map((m) => (
              <li key={m.id}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                           padding: '10px 12px', border: '1px solid #eee', borderRadius: 8, marginBottom: 8 }}>
                <span style={{ whiteSpace: 'pre-wrap' }}>{m.text}</span>
                <button
                  onClick={() => removeMemory(m.id)}
                  style={{
                    marginLeft: 12,
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: '1px solid #ddd',
                    background: '#fff',
                    cursor: 'pointer'
                  }}
                >
                  删除
                </button>
              </li>
            ))}
          </ul>
        )}

        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button
            onClick={saveMemories}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #111',
              background: '#111',
              color: '#fff',
              cursor: 'pointer'
            }}
          >
            保存到本地
          </button>
          <span style={{ color: '#555', alignSelf: 'center' }}>当前 {memoryCount} 条</span>
        </div>
      </section>
    </main>
  );
}
