import React, { useState, useEffect, useRef, useCallback } from 'react';

const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSuCNTWYJOSI__LSvV-t3JFJoUAdsM4P1N8rpPeGinRIdg9VrDmNV8go1vxOJbxkIrJ11q72JR0wPw8/pub?gid=2144223317&single=true&output=csv';
const REFRESH_INTERVAL = 60000; // atualiza a cada 60 segundos

const CATEGORIES = [
  { id: 'pagamentos',  label: 'Pagamentos',          icon: '💰', color: '#c9a84c' },
  { id: 'relatorios',  label: 'Relatórios',           icon: '📋', color: '#6b9fd4' },
  { id: 'cobrancas',   label: 'Cobranças',            icon: '📞', color: '#d4756b' },
  { id: 'rh',          label: 'RH / Colaboradores',   icon: '👥', color: '#8bc48b' },
  { id: 'pessoal',     label: 'Pessoal',              icon: '🏃', color: '#b68cd4' },
  { id: 'processos',   label: 'Processos',            icon: '📁', color: '#d4a56b' },
  { id: 'reunioes',    label: 'Reuniões',             icon: '📅', color: '#6bd4c8' },
  { id: 'urgente',     label: 'Urgente',              icon: '⚠️', color: '#d46b6b' },
];

const FREQUENCIES = [
  { id: 'mensal',    label: 'Mensal' },
  { id: 'semanal',   label: 'Semanal' },
  { id: 'quinzenal', label: 'Quinzenal' },
  { id: 'anual',     label: 'Anual' },
  { id: 'unico',     label: 'Único' },
];

const WEEKDAYS = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];

// ─── GOOGLE SHEETS PARSER ────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const headerIdx = lines.findIndex(l => l.toUpperCase().includes('ATIVIDADE'));
  if (headerIdx === -1) return [];
  const dataLines = lines.slice(headerIdx + 1);

  return dataLines
    .filter(l => l && !l.startsWith(',,,'))
    .map((line, i) => {
      const cols = parseCSVLine(line);
      const atividade    = (cols[0] || '').trim();
      const descricao    = (cols[1] || '').trim();
      const frequencia   = normFreq((cols[2] || '').trim());
      const lembrete     = (cols[3] || '').trim();
      const destinatario = (cols[4] || '').trim();

      if (!atividade) return null;

      const { diaMes, diaSemana } = parseLembrete(lembrete, frequencia);
      const categoria = inferCategoria(atividade, descricao);

      return {
        id: `sheet_${i}`,
        atividade, descricao, categoria, frequencia,
        diaMes, diaSemana, dataEspecifica: '',
        destinatario, contato: '', observacao: lembrete,
        ativo: true, fromSheet: true,
      };
    })
    .filter(Boolean);
}

function parseCSVLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { result.push(cur); cur = ''; }
    else { cur += ch; }
  }
  result.push(cur);
  return result;
}

function normFreq(f) {
  const lower = f.toLowerCase();
  if (lower.includes('mensal')) return 'mensal';
  if (lower.includes('semanal')) return 'semanal';
  if (lower.includes('quinzenal')) return 'quinzenal';
  if (lower.includes('anual')) return 'anual';
  return 'mensal';
}

function parseLembrete(lembrete, frequencia) {
  const lower = lembrete.toLowerCase();
  let diaMes = '';
  let diaSemana = '';
  if (frequencia === 'mensal') {
    const match = lower.match(/dia\s+(\d{1,2})/);
    if (match) diaMes = parseInt(match[1]);
  }
  if (frequencia === 'semanal') {
    const map = {
      'segunda': 'Segunda-feira', 'terca': 'Terça-feira', 'terça': 'Terça-feira',
      'quarta': 'Quarta-feira', 'quinta': 'Quinta-feira', 'sexta': 'Sexta-feira',
      'sabado': 'Sábado', 'sábado': 'Sábado', 'domingo': 'Domingo',
    };
    for (const [key, val] of Object.entries(map)) {
      if (lower.includes(key)) { diaSemana = val; break; }
    }
  }
  return { diaMes, diaSemana };
}

function inferCategoria(atividade, descricao) {
  const text = (atividade + ' ' + descricao).toLowerCase();
  if (text.includes('pix') || text.includes('pagamento') || text.includes('honorário') || text.includes('honorario')) return 'pagamentos';
  if (text.includes('relatório') || text.includes('relatorio') || text.includes('exame')) return 'relatorios';
  if (text.includes('cobrança') || text.includes('cobranca')) return 'cobrancas';
  if (text.includes('pdi') || text.includes('colabora') || text.includes('equipe') || text.includes('processo')) return 'rh';
  if (text.includes('reunião') || text.includes('reuniao') || text.includes('apresentação') || text.includes('podcast')) return 'reunioes';
  return 'pessoal';
}

function getTodayActivities(activities) {
  const now = new Date();
  const dayOfMonth = now.getDate();
  const dayOfWeek = WEEKDAYS[now.getDay()];
  const mmdd = `${String(now.getMonth()+1).padStart(2,'0')}/${String(dayOfMonth).padStart(2,'0')}`;
  return activities.filter(a => {
    if (!a.ativo) return false;
    if (a.frequencia === 'mensal') return Number(a.diaMes) === dayOfMonth;
    if (a.frequencia === 'quinzenal') return [1, 16].includes(dayOfMonth);
    if (a.frequencia === 'semanal') return a.diaSemana === dayOfWeek;
    if (a.frequencia === 'anual' || a.frequencia === 'unico') return a.dataEspecifica === mmdd;
    return false;
  });
}

function formatDate(d) {
  const days = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
  const months = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  return `${days[d.getDay()]}, ${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
}

function formatTime(d) {
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function blankActivity() {
  return {
    id: Date.now().toString(),
    atividade: '', descricao: '', categoria: 'pessoal',
    frequencia: 'mensal', diaMes: '', diaSemana: '',
    dataEspecifica: '', destinatario: '', contato: '',
    observacao: '', ativo: true, fromSheet: false,
  };
}

function parseVoiceText(text) {
  const lower = text.toLowerCase();
  const activity = blankActivity();
  activity.atividade = text.split(' ').slice(0, 6).join(' ');
  activity.descricao = text;
  activity.categoria = inferCategoria(text, '');
  const diaMatch = text.match(/dia\s+(\d{1,2})/i);
  if (diaMatch) { activity.frequencia = 'mensal'; activity.diaMes = parseInt(diaMatch[1]); }
  WEEKDAYS.forEach(d => {
    if (lower.includes(d.toLowerCase())) { activity.frequencia = 'semanal'; activity.diaSemana = d; }
  });
  const destMatch = text.match(/para\s+([A-ZÁÉÍÓÚ][a-záéíóú]+(?:\s+[A-ZÁÉÍÓÚ][a-záéíóú]+)?)/);
  if (destMatch) activity.destinatario = destMatch[1];
  return activity;
}

const LOCAL_KEY = 'adriel_local_extras_v1';
function loadLocalExtras() {
  try { const r = localStorage.getItem(LOCAL_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
}
function saveLocalExtras(data) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(data)); } catch {}
}

export default function App() {
  const [sheetActivities, setSheetActivities] = useState([]);
  const [localExtras, setLocalExtras] = useState(loadLocalExtras);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState(null);
  const [syncError, setSyncError] = useState(false);
  const [view, setView] = useState('today');
  const [editItem, setEditItem] = useState(null);
  const [now, setNow] = useState(new Date());
  const [recording, setRecording] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [voiceParsed, setVoiceParsed] = useState(null);
  const [filter, setFilter] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [toast, setToast] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const recognitionRef = useRef(null);

  const activities = [...sheetActivities, ...localExtras];

  const fetchSheet = useCallback(async () => {
    try {
      const res = await fetch(SHEET_CSV_URL);
      if (!res.ok) throw new Error('erro');
      const text = await res.text();
      setSheetActivities(parseCSV(text));
      setLastSync(new Date());
      setSyncError(false);
    } catch {
      setSyncError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSheet();
    const interval = setInterval(fetchSheet, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchSheet]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { saveLocalExtras(localExtras); }, [localExtras]);

  const showToast = useCallback((msg, type = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  }, []);

  const startRecording = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { showToast('Voz não suportada', 'err'); return; }
    const rec = new SR();
    rec.lang = 'pt-BR';
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (e) => {
      const t = Array.from(e.results).map(r => r[0].transcript).join('');
      setVoiceText(t);
      if (e.results[0].isFinal) { setVoiceParsed(parseVoiceText(t)); setRecording(false); }
    };
    rec.onerror = () => { setRecording(false); showToast('Erro ao gravar', 'err'); };
    rec.onend = () => setRecording(false);
    recognitionRef.current = rec;
    rec.start();
    setRecording(true);
    setVoiceText('');
    setVoiceParsed(null);
  }, [showToast]);

  const stopRecording = useCallback(() => { recognitionRef.current?.stop(); setRecording(false); }, []);

  const acceptVoice = useCallback(() => {
    if (!voiceParsed) return;
    setEditItem({ ...voiceParsed });
    setVoiceText('');
    setVoiceParsed(null);
    setView('form');
  }, [voiceParsed]);

  const saveActivity = useCallback((item) => {
    setLocalExtras(prev => {
      const exists = prev.find(a => a.id === item.id);
      return exists ? prev.map(a => a.id === item.id ? item : a) : [...prev, item];
    });
    showToast(`"${item.atividade}" salvo!`);
    setView('all');
    setEditItem(null);
  }, [showToast]);

  const deleteActivity = useCallback((id) => {
    setLocalExtras(prev => prev.filter(a => a.id !== id));
    setDeleteConfirm(null);
    showToast('Excluído', 'warn');
    setView('all');
  }, [showToast]);

  const toggleActive = useCallback((id) => {
    if (sheetActivities.find(a => a.id === id)) {
      setSheetActivities(prev => prev.map(a => a.id === id ? { ...a, ativo: !a.ativo } : a));
    } else {
      setLocalExtras(prev => prev.map(a => a.id === id ? { ...a, ativo: !a.ativo } : a));
    }
  }, [sheetActivities]);

  const todayItems = getTodayActivities(activities);
  const allFiltered = activities.filter(a => {
    const matchText = !filter || a.atividade.toLowerCase().includes(filter.toLowerCase()) || a.destinatario.toLowerCase().includes(filter.toLowerCase());
    const matchCat = !filterCat || a.categoria === filterCat;
    return matchText && matchCat;
  });
  const grouped = todayItems.reduce((acc, a) => { if (!acc[a.categoria]) acc[a.categoria] = []; acc[a.categoria].push(a); return acc; }, {});
  const catOf = (id) => CATEGORIES.find(c => c.id === id) || CATEGORIES[4];

  return (
    <div style={S.root}>
      <header style={S.header}>
        <div style={S.headerTop}>
          <div>
            <div style={S.greeting}>Bom dia, Adriel</div>
            <div style={S.clock}>{formatTime(now)}</div>
          </div>
          <div style={S.dateBox}>
            <div style={S.dateDay}>{now.getDate()}</div>
            <div style={S.dateMonth}>{now.toLocaleDateString('pt-BR',{month:'short'}).replace('.','').toUpperCase()}</div>
          </div>
        </div>
        <div style={S.dateStr}>{formatDate(now)}</div>
        <div style={S.syncRow}>
          {loading && <span style={S.syncLoading}>⟳ Carregando planilha…</span>}
          {!loading && !syncError && lastSync && (
            <span style={S.syncOk}>✓ Sincronizado {lastSync.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})} <button onClick={fetchSheet} style={S.syncBtn}>↻</button></span>
          )}
          {syncError && <span style={S.syncErr}>⚠ Erro ao sincronizar <button onClick={fetchSheet} style={S.syncBtn}>Tentar</button></span>}
        </div>
      </header>

      <nav style={S.nav}>
        {[{id:'today',label:`Hoje (${todayItems.length})`},{id:'all',label:`Todas (${activities.length})`}].map(t => (
          <button key={t.id} onClick={() => setView(t.id)} style={{...S.navBtn,...(view===t.id?S.navBtnActive:{})}}>{t.label}</button>
        ))}
        <button onClick={() => { setEditItem(blankActivity()); setView('form'); }} style={S.navAdd}>+ Nova</button>
      </nav>

      <div style={S.voiceBar}>
        <button onMouseDown={startRecording} onTouchStart={startRecording} onMouseUp={stopRecording} onTouchEnd={stopRecording}
          style={{...S.voiceBtn,...(recording?S.voiceBtnActive:{})}}>
          <span style={S.voiceIcon}>{recording ? '⏹' : '🎙'}</span>
          <span style={S.voiceLabel}>{recording ? 'Gravando…' : 'Segurar para falar'}</span>
        </button>
        {voiceText && (
          <div style={S.voicePreview}>
            <span style={S.voiceTranscript}>"{voiceText}"</span>
            {voiceParsed && <button onClick={acceptVoice} style={S.voiceAccept}>Confirmar →</button>}
          </div>
        )}
      </div>

      <main style={S.main}>
        {view === 'today' && (
          <div>
            {loading ? (
              <div style={S.empty}><div style={S.emptyIcon}>⟳</div><div style={S.emptyTitle}>Carregando…</div></div>
            ) : todayItems.length === 0 ? (
              <div style={S.empty}><div style={S.emptyIcon}>✅</div><div style={S.emptyTitle}>Nada para hoje</div><div style={S.emptyText}>Nenhuma atividade programada.</div></div>
            ) : (
              Object.entries(grouped).sort(([a],[b]) => a==='urgente'?-1:b==='urgente'?1:0).map(([catId, items]) => {
                const cat = catOf(catId);
                return (
                  <div key={catId} style={S.catSection}>
                    <div style={S.catHeader}>
                      <span style={{...S.catDot,background:cat.color}} />
                      <span style={S.catName}>{cat.icon} {cat.label}</span>
                      <span style={S.catCount}>{items.length}</span>
                    </div>
                    {items.map(a => <ActivityCard key={a.id} activity={a} catColor={cat.color} onEdit={() => { setEditItem({...a}); setView('form'); }} onDelete={() => setDeleteConfirm(a.id)} onToggle={() => toggleActive(a.id)} />)}
                  </div>
                );
              })
            )}
          </div>
        )}

        {view === 'all' && (
          <div>
            <div style={S.filterRow}>
              <input style={S.searchInput} placeholder="Buscar…" value={filter} onChange={e => setFilter(e.target.value)} />
              <select style={S.catSelect} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                <option value="">Todas</option>
                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
              </select>
            </div>
            {allFiltered.map(a => { const cat = catOf(a.categoria); return <ActivityCard key={a.id} activity={a} catColor={cat.color} onEdit={() => { setEditItem({...a}); setView('form'); }} onDelete={() => setDeleteConfirm(a.id)} onToggle={() => toggleActive(a.id)} showCat />; })}
          </div>
        )}

        {view === 'form' && editItem && (
          <ActivityForm item={editItem} onSave={saveActivity} onCancel={() => { setView('all'); setEditItem(null); }} onDelete={() => setDeleteConfirm(editItem.id)} />
        )}
      </main>

      {deleteConfirm && (
        <div style={S.overlay}>
          <div style={S.dialog}>
            <div style={S.dialogTitle}>Excluir atividade?</div>
            <div style={S.dialogText}>Esta ação não pode ser desfeita.</div>
            <div style={S.dialogBtns}>
              <button onClick={() => setDeleteConfirm(null)} style={S.btnSecondary}>Cancelar</button>
              <button onClick={() => deleteActivity(deleteConfirm)} style={S.btnDanger}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div style={{...S.toast,...(toast.type==='err'?S.toastErr:toast.type==='warn'?S.toastWarn:{})}}>{toast.msg}</div>}
    </div>
  );
}

function ActivityCard({ activity: a, catColor, onEdit, onDelete, onToggle, showCat }) {
  const cat = CATEGORIES.find(c => c.id === a.categoria) || CATEGORIES[4];
  return (
    <div style={{...S.card, opacity:a.ativo?1:0.45, borderLeft:`3px solid ${catColor}`}}>
      <div style={S.cardTop}>
        <div style={S.cardTitle}>{a.atividade}</div>
        <div style={S.cardActions}>
          {a.fromSheet && <span style={S.sheetBadge}>📊</span>}
          <button onClick={onToggle} style={S.iconBtn}>{a.ativo ? '⏸' : '▶'}</button>
          {!a.fromSheet && <button onClick={onEdit} style={S.iconBtn}>✏️</button>}
          {!a.fromSheet && <button onClick={onDelete} style={S.iconBtnDanger}>🗑</button>}
        </div>
      </div>
      {a.descricao && <div style={S.cardDesc}>{a.descricao}</div>}
      <div style={S.cardMeta}>
        {showCat && <span style={{...S.badge,background:catColor+'22',color:catColor}}>{cat.icon} {cat.label}</span>}
        {a.destinatario && <span style={S.badgeNeutral}>→ {a.destinatario}</span>}
        {a.frequencia && <span style={S.badgeNeutral}>{FREQUENCIES.find(f=>f.id===a.frequencia)?.label||a.frequencia}</span>}
        {a.frequencia==='mensal' && a.diaMes && <span style={S.badgeNeutral}>dia {a.diaMes}</span>}
        {a.frequencia==='semanal' && a.diaSemana && <span style={S.badgeNeutral}>{a.diaSemana}</span>}
      </div>
      {a.observacao && <div style={S.cardObs}>⚑ {a.observacao}</div>}
    </div>
  );
}

function ActivityForm({ item, onSave, onCancel, onDelete }) {
  const [form, setForm] = useState(item);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div style={S.form}>
      <div style={S.formHeader}>
        <span style={S.formTitle}>{!item.atividade ? 'Nova atividade' : 'Editar'}</span>
        {item.atividade && !item.fromSheet && <button onClick={onDelete} style={S.formDelete}>Excluir</button>}
      </div>
      {item.fromSheet && <div style={S.sheetNote}>📊 Edite diretamente no Google Sheets.</div>}
      <div style={S.formGroup}><label style={S.label}>Atividade *</label><input style={S.input} value={form.atividade} onChange={e=>set('atividade',e.target.value)} disabled={form.fromSheet} /></div>
      <div style={S.formGroup}><label style={S.label}>Descrição</label><textarea style={S.textarea} value={form.descricao} onChange={e=>set('descricao',e.target.value)} rows={2} disabled={form.fromSheet} /></div>
      <div style={S.formRow}>
        <div style={{flex:1}}><label style={S.label}>Categoria</label><select style={S.select} value={form.categoria} onChange={e=>set('categoria',e.target.value)}>{CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}</select></div>
        <div style={{flex:1}}><label style={S.label}>Frequência</label><select style={S.select} value={form.frequencia} onChange={e=>set('frequencia',e.target.value)} disabled={form.fromSheet}>{FREQUENCIES.map(f=><option key={f.id} value={f.id}>{f.label}</option>)}</select></div>
      </div>
      {form.frequencia==='mensal' && <div style={S.formGroup}><label style={S.label}>Dia do mês</label><input style={S.input} type="number" min="1" max="31" value={form.diaMes} onChange={e=>set('diaMes',e.target.value)} disabled={form.fromSheet} /></div>}
      {form.frequencia==='semanal' && <div style={S.formGroup}><label style={S.label}>Dia da semana</label><select style={S.select} value={form.diaSemana} onChange={e=>set('diaSemana',e.target.value)} disabled={form.fromSheet}><option value="">Selecione</option>{WEEKDAYS.map(d=><option key={d} value={d}>{d}</option>)}</select></div>}
      <div style={S.formRow}>
        <div style={{flex:1}}><label style={S.label}>Destinatário</label><input style={S.input} value={form.destinatario} onChange={e=>set('destinatario',e.target.value)} disabled={form.fromSheet} /></div>
        <div style={{flex:1}}><label style={S.label}>Canal</label><input style={S.input} value={form.contato} onChange={e=>set('contato',e.target.value)} /></div>
      </div>
      <div style={S.formGroup}><label style={S.label}>Observação</label><input style={S.input} value={form.observacao} onChange={e=>set('observacao',e.target.value)} /></div>
      <div style={S.formGroup}>
        <label style={S.toggleRow}><span style={S.label}>Ativo</span>
          <div onClick={() => set('ativo', !form.ativo)} style={{...S.toggle, background:form.ativo?'#c9a84c':'#333'}}>
            <div style={{...S.toggleThumb, transform:form.ativo?'translateX(18px)':'translateX(2px)'}} />
          </div>
        </label>
      </div>
      <div style={S.formFooter}>
        <button onClick={onCancel} style={S.btnSecondary}>Cancelar</button>
        {!item.fromSheet && <button onClick={() => onSave(form)} style={S.btnPrimary} disabled={!form.atividade}>Salvar</button>}
      </div>
    </div>
  );
}

const S = {
  root: { minHeight:'100dvh', background:'#0a0a0a', color:'#e8e4d9', fontFamily:"'DM Sans', sans-serif", maxWidth:480, margin:'0 auto', paddingBottom:40 },
  header: { padding:'52px 24px 16px', borderBottom:'1px solid #1e1e1e', background:'linear-gradient(180deg, #111 0%, #0a0a0a 100%)' },
  headerTop: { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 },
  greeting: { fontFamily:"'DM Serif Display', serif", fontSize:26, color:'#e8e4d9', letterSpacing:'-0.5px' },
  clock: { fontSize:13, color:'#c9a84c', fontVariantNumeric:'tabular-nums', marginTop:2 },
  dateBox: { textAlign:'center', background:'#c9a84c', borderRadius:8, padding:'6px 12px', minWidth:52 },
  dateDay: { fontFamily:"'DM Serif Display', serif", fontSize:24, color:'#0a0a0a', lineHeight:1 },
  dateMonth: { fontSize:10, color:'#0a0a0a', fontWeight:500, letterSpacing:'0.1em', marginTop:2 },
  dateStr: { fontSize:12, color:'#666', marginBottom:8 },
  syncRow: { display:'flex', alignItems:'center', gap:8, marginTop:6 },
  syncLoading: { fontSize:11, color:'#888', fontStyle:'italic' },
  syncOk: { fontSize:11, color:'#5a9e6f', display:'flex', alignItems:'center', gap:6 },
  syncErr: { fontSize:11, color:'#d46b6b', display:'flex', alignItems:'center', gap:6 },
  syncBtn: { background:'transparent', border:'1px solid currentColor', borderRadius:4, color:'inherit', fontSize:11, padding:'2px 6px', cursor:'pointer', fontFamily:"'DM Sans', sans-serif" },
  nav: { display:'flex', gap:8, padding:'12px 16px', borderBottom:'1px solid #1a1a1a', alignItems:'center' },
  navBtn: { flex:1, padding:'8px 0', background:'transparent', border:'1px solid #2a2a2a', borderRadius:8, color:'#888', fontSize:13, cursor:'pointer', fontFamily:"'DM Sans', sans-serif" },
  navBtnActive: { background:'#1a1a1a', border:'1px solid #c9a84c', color:'#c9a84c' },
  navAdd: { padding:'8px 14px', background:'#c9a84c', border:'none', borderRadius:8, color:'#0a0a0a', fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:"'DM Sans', sans-serif", whiteSpace:'nowrap' },
  voiceBar: { padding:'12px 16px', borderBottom:'1px solid #1a1a1a', background:'#0d0d0d' },
  voiceBtn: { display:'flex', alignItems:'center', gap:10, width:'100%', padding:'10px 16px', background:'#141414', border:'1px solid #2a2a2a', borderRadius:10, cursor:'pointer', fontFamily:"'DM Sans', sans-serif" },
  voiceBtnActive: { background:'#1a1209', border:'1px solid #c9a84c', boxShadow:'0 0 0 3px #c9a84c22' },
  voiceIcon: { fontSize:18 },
  voiceLabel: { fontSize:13, color:'#888' },
  voicePreview: { marginTop:10, padding:'10px 12px', background:'#111', borderRadius:8, border:'1px solid #222' },
  voiceTranscript: { fontSize:13, color:'#aaa', fontStyle:'italic', display:'block', marginBottom:8 },
  voiceAccept: { fontSize:12, background:'#c9a84c', color:'#0a0a0a', border:'none', borderRadius:6, padding:'6px 12px', cursor:'pointer', fontWeight:500, fontFamily:"'DM Sans', sans-serif" },
  main: { padding:'16px', paddingBottom:40 },
  catSection: { marginBottom:24 },
  catHeader: { display:'flex', alignItems:'center', gap:8, marginBottom:10 },
  catDot: { width:8, height:8, borderRadius:'50%', flexShrink:0 },
  catName: { fontSize:13, fontWeight:500, color:'#888', letterSpacing:'0.05em', textTransform:'uppercase', flex:1 },
  catCount: { fontSize:11, color:'#555', background:'#1a1a1a', padding:'2px 8px', borderRadius:99 },
  card: { background:'#111', borderRadius:12, padding:'14px 16px', marginBottom:10, transition:'opacity 0.2s' },
  cardTop: { display:'flex', alignItems:'flex-start', gap:8, marginBottom:4 },
  cardTitle: { flex:1, fontSize:15, fontWeight:500, color:'#e8e4d9', lineHeight:1.3 },
  cardActions: { display:'flex', gap:4, flexShrink:0, alignItems:'center' },
  sheetBadge: { fontSize:12, opacity:0.6 },
  iconBtn: { background:'transparent', border:'none', cursor:'pointer', fontSize:14, padding:'2px 4px' },
  iconBtnDanger: { background:'transparent', border:'none', cursor:'pointer', fontSize:14, padding:'2px 4px', opacity:0.6 },
  cardDesc: { fontSize:13, color:'#777', marginBottom:8, lineHeight:1.4 },
  cardMeta: { display:'flex', flexWrap:'wrap', gap:6, marginBottom:4 },
  badge: { fontSize:11, padding:'3px 8px', borderRadius:99, fontWeight:500 },
  badgeNeutral: { fontSize:11, padding:'3px 8px', borderRadius:99, background:'#1e1e1e', color:'#888' },
  cardObs: { fontSize:11, color:'#555', marginTop:6, fontStyle:'italic' },
  filterRow: { display:'flex', gap:8, marginBottom:16 },
  searchInput: { flex:1, padding:'10px 12px', background:'#111', border:'1px solid #2a2a2a', borderRadius:8, color:'#e8e4d9', fontSize:14, fontFamily:"'DM Sans', sans-serif", outline:'none' },
  catSelect: { padding:'10px 8px', background:'#111', border:'1px solid #2a2a2a', borderRadius:8, color:'#888', fontSize:13, fontFamily:"'DM Sans', sans-serif", outline:'none' },
  empty: { textAlign:'center', paddingTop:60, paddingBottom:60 },
  emptyIcon: { fontSize:40, marginBottom:12 },
  emptyTitle: { fontSize:18, fontFamily:"'DM Serif Display', serif", color:'#e8e4d9', marginBottom:6 },
  emptyText: { fontSize:13, color:'#555' },
  form: { background:'#0d0d0d' },
  formHeader: { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 },
  formTitle: { fontFamily:"'DM Serif Display', serif", fontSize:22, color:'#e8e4d9' },
  formDelete: { fontSize:12, color:'#d46b6b', background:'transparent', border:'1px solid #d46b6b33', padding:'6px 12px', borderRadius:6, cursor:'pointer', fontFamily:"'DM Sans', sans-serif" },
  sheetNote: { fontSize:12, color:'#6b9fd4', background:'#0d1520', border:'1px solid #1a2a3a', borderRadius:8, padding:'10px 12px', marginBottom:16 },
  formGroup: { marginBottom:16 },
  formRow: { display:'flex', gap:12, marginBottom:16 },
  label: { display:'block', fontSize:11, color:'#666', fontWeight:500, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 },
  input: { width:'100%', padding:'10px 12px', background:'#111', border:'1px solid #222', borderRadius:8, color:'#e8e4d9', fontSize:14, fontFamily:"'DM Sans', sans-serif", outline:'none' },
  textarea: { width:'100%', padding:'10px 12px', background:'#111', border:'1px solid #222', borderRadius:8, color:'#e8e4d9', fontSize:14, fontFamily:"'DM Sans', sans-serif", outline:'none', resize:'vertical' },
  select: { width:'100%', padding:'10px 12px', background:'#111', border:'1px solid #222', borderRadius:8, color:'#e8e4d9', fontSize:14, fontFamily:"'DM Sans', sans-serif", outline:'none' },
  toggleRow: { display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer' },
  toggle: { width:42, height:24, borderRadius:99, transition:'background 0.2s', position:'relative', flexShrink:0 },
  toggleThumb: { position:'absolute', top:3, width:18, height:18, background:'#fff', borderRadius:'50%', transition:'transform 0.2s' },
  formFooter: { display:'flex', gap:10, marginTop:24, paddingTop:16, borderTop:'1px solid #1a1a1a' },
  btnPrimary: { flex:1, padding:'12px', background:'#c9a84c', border:'none', borderRadius:8, color:'#0a0a0a', fontSize:14, fontWeight:500, cursor:'pointer', fontFamily:"'DM Sans', sans-serif" },
  btnSecondary: { flex:1, padding:'12px', background:'transparent', border:'1px solid #2a2a2a', borderRadius:8, color:'#888', fontSize:14, cursor:'pointer', fontFamily:"'DM Sans', sans-serif" },
  btnDanger: { flex:1, padding:'12px', background:'#d46b6b', border:'none', borderRadius:8, color:'#fff', fontSize:14, fontWeight:500, cursor:'pointer', fontFamily:"'DM Sans', sans-serif" },
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:24 },
  dialog: { background:'#111', borderRadius:16, padding:24, width:'100%', maxWidth:320, border:'1px solid #2a2a2a' },
  dialogTitle: { fontFamily:"'DM Serif Display', serif", fontSize:20, color:'#e8e4d9', marginBottom:8 },
  dialogText: { fontSize:13, color:'#666', marginBottom:20 },
  dialogBtns: { display:'flex', gap:10 },
  toast: { position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', background:'#1a1a1a', border:'1px solid #2a2a2a', color:'#e8e4d9', padding:'12px 20px', borderRadius:99, fontSize:13, zIndex:200, whiteSpace:'nowrap', boxShadow:'0 4px 20px rgba(0,0,0,0.5)' },
  toastErr: { background:'#1a0808', border:'1px solid #d46b6b44', color:'#d46b6b' },
  toastWarn: { background:'#0d0d08', border:'1px solid #c9a84c44', color:'#c9a84c' },
};
