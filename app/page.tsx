'use client';
import { useEffect, useMemo, useState } from 'react';
import { MEMORY_AREAS, type MemoryItem, type MemoryAreaId } from '@/lib/types';
import { sampleMemories } from '@/data/sample_memories';

export default function Home() {
  const [provider, setProvider] = useState<'openai'|'deepseek'>('openai');
  const [question, setQuestion] = useState('');
  const [questionDate, setQuestionDate] = useState<string>('');
  const [additionalInfo, setAdditionalInfo] = useState('');

  const [memoryDate, setMemoryDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [memoryArea, setMemoryArea] = useState<MemoryAreaId>('love_and_relationships');
  const [memoryRelatedPeople, setMemoryRelatedPeople] = useState<string>('');
  const [memoryContent, setMemoryContent] = useState('');
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const STORAGE_KEY = 'tools-mvp-memories';

  const [loading, setLoading] = useState(false);
  const [selectedMemories, setSelectedMemories] = useState<MemoryItem[]>([]);
  const [resultText, setResultText] = useState<string>('');
  const memoryCount = useMemo(() => memories.length, [memories]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setMemories(JSON.parse(raw));
    } catch {}
  }, []);

  const saveMemories = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memories));
    alert('Memory 已保存到本地（localStorage）。');
  };

  const clearAndLoadSample = () => {
    if (confirm('确定要清除所有旧数据并加载 20 条示例数据吗？')) {
      localStorage.removeItem(STORAGE_KEY);
      setMemories(sampleMemories);
      alert('已清除旧数据并加载 20 条示例数据！');
    }
  };

  const addMemory = () => {
    const content = memoryContent.trim();
    if (!content) return;
    const relatedPeople = memoryRelatedPeople.trim()
      .split(/[，,、\s]+/)
      .map(p => p.trim())
      .filter(Boolean);
    
    const newMemory: MemoryItem = {
      id: String(Date.now()),
      date: memoryDate,
      area: memoryArea,
      relatedPeople,
      content
    };
    
    setMemories((prev) => [...prev, newMemory]);
    setMemoryContent('');
    setMemoryRelatedPeople('');
  };

  const removeMemory = (id: string) => {
    setMemories((prev) => prev.filter((m) => m.id !== id));
  };

  const onDrawAndInterpret = async () => {
    if (!question.trim()) {
      alert('请先在输入框里键入你的问题～');
      return;
    }
    setLoading(true);
    setSelectedMemories([]);
    setResultText('');
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          question,
          questionDate,
          additionalInfo,
          memories
        })
      });
      const data = await res.json();
      console.log('[DEBUG] /api/chat response', data);

      if (!data.ok) {
        alert('服务失败：' + data.error);
        return;
      }
      // 1) 在页面上打印提取到的 Memory
      setSelectedMemories(data.selectedMemories || []);
      // 2) 显示解读结果
      setResultText(data.interpretation || '');
    } catch (err: any) {
      alert('请求失败：' + (err?.message || 'unknown'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: 24, fontFamily: 'ui-sans-serif, system-ui' }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Tarot Tools MVP</h1>
      <p style={{ color: '#555', marginBottom: 24 }}>阶段 2：后端 API + tools 选 memory + 解读</p>

      {/* Provider 选择 */}
      <section style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
        <label>模型提供方：</label>
        <select value={provider} onChange={(e) => setProvider(e.target.value as 'openai'|'deepseek')}>
          <option value="openai">OpenAI</option>
          <option value="deepseek">DeepSeek</option>
        </select>
      </section>

      {/* 输入问题 */}
      <section style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>你的问题 / 主题：</label>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="例如：我该如何推进目前的感情关系？"
          rows={4}
          style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #ddd' }}
        />
      </section>

      {/* 提问日期 + 附加信息 */}
      <section style={{ marginBottom: 24, display: 'grid', gridTemplateColumns: '220px 1fr', gap: 12 }}>
        <div>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>提问日期：</label>
          <input
            type="date"
            value={questionDate}
            onChange={(e) => setQuestionDate(e.target.value)}
            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>附加信息（可选）：</label>
          <textarea
            value={additionalInfo}
            onChange={(e) => setAdditionalInfo(e.target.value)}
            placeholder="例如：我们上周为小事争执；我想提升沟通质量；TA的星座是..."
            rows={3}
            style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #ddd' }}
          />
        </div>
      </section>

      {/* 抽牌并解读 */}
      <section style={{ marginBottom: 32 }}>
        <button
          onClick={onDrawAndInterpret}
          disabled={loading}
          style={{
            padding: '10px 16px',
            fontWeight: 600,
            borderRadius: 10,
            border: '1px solid #111',
            background: loading ? '#999' : '#111',
            color: '#fff',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? '处理中…' : '🃏 抽牌并解读'}
        </button>
      </section>

      {/* Memory 面板 */}
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, marginBottom: 12 }}>Memory（你可以自定义，后续工具会引用）</h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: 14 }}>存入日期：</label>
            <input
              type="date"
              value={memoryDate}
              onChange={(e) => setMemoryDate(e.target.value)}
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: 14 }}>所属领域：</label>
            <select
              value={memoryArea}
              onChange={(e) => setMemoryArea(e.target.value as MemoryAreaId)}
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd' }}
            >
              {Object.values(MEMORY_AREAS).map(area => (
                <option key={area.id} value={area.id}>
                  {area.emoji} {area.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: 14 }}>相关人物（可选，用逗号或空格分隔）：</label>
          <input
            value={memoryRelatedPeople}
            onChange={(e) => setMemoryRelatedPeople(e.target.value)}
            placeholder="例如：小明、小红"
            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd' }}
          />
        </div>
        
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <textarea
            value={memoryContent}
            onChange={(e) => setMemoryContent(e.target.value)}
            placeholder="输入 memory 的具体内容"
            rows={3}
            style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #ddd' }}
          />
          <button
            onClick={addMemory}
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid #ccc',
              background: '#f5f5f5',
              cursor: 'pointer',
              alignSelf: 'flex-start'
            }}
          >
            ＋
          </button>
        </div>

        {memoryCount === 0 ? (
          <p style={{ color: '#777' }}>暂无 memory。请填写日期、领域、相关人物和内容后添加。</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {memories.map((m) => {
              const areaInfo = MEMORY_AREAS[m.area] || MEMORY_AREAS.love_and_relationships;
              const date = new Date(m.date);
              const year = date.getFullYear();
              const month = date.getMonth() + 1;
              const day = date.getDate();
              const relatedPeople = m.relatedPeople || [];
              const peopleText = relatedPeople.length > 0 ? `（涉及：${relatedPeople.join('、')}）` : '';
              
              return (
                <li key={m.id}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                             padding: '10px 12px', border: '1px solid #eee', borderRadius: 8, marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                      {year}年{month}月{day}日 {areaInfo.emoji} {areaInfo.name}{peopleText}
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
                  </div>
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
              );
            })}
          </ul>
        )}

        <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
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
          <button
            onClick={clearAndLoadSample}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #f44336',
              background: '#fff',
              color: '#f44336',
              cursor: 'pointer'
            }}
          >
            清除旧数据并加载示例
          </button>
          <span style={{ color: '#555', alignSelf: 'center' }}>当前 {memoryCount} 条</span>
        </div>
      </section>

      {/* 结果展示 */}
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 20, marginBottom: 12 }}>本次选中的 Memory</h2>
        {selectedMemories.length === 0 ? (
          <p style={{ color: '#777' }}>（点击“抽牌并解读”后，会显示被工具选中的 memory）</p>
        ) : (
          <ol>
            {selectedMemories.map((m) => {
              const areaInfo = MEMORY_AREAS[m.area] || MEMORY_AREAS.love_and_relationships;
              const date = new Date(m.date);
              const year = date.getFullYear();
              const month = date.getMonth() + 1;
              const day = date.getDate();
              const relatedPeople = m.relatedPeople || [];
              const peopleText = relatedPeople.length > 0 ? `（涉及：${relatedPeople.join('、')}）` : '';
              
              return (
                <li key={m.id} style={{ marginBottom: 6 }}>
                  {year}年{month}月{day}日 {areaInfo.emoji} {areaInfo.name}{peopleText}：{m.content}
                </li>
              );
            })}
          </ol>
        )}

        <h2 style={{ fontSize: 20, margin: '16px 0 8px' }}>解读结果</h2>
        {resultText ? (
          <div style={{ whiteSpace: 'pre-wrap', border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
            {resultText}
          </div>
        ) : (
          <p style={{ color: '#777' }}>（生成的解读会显示在这里）</p>
        )}
      </section>
    </main>
  );
}
