import React, { useState, useEffect, useRef, useCallback } from 'react';

// ─── CONFIG ─────────────────────────────────────────────────────────
const SHEET_ID = '1CAGcyhkH4-3JZZpHDmpqpZ6rwIk-UHst';
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`;
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
  // Pula linhas até achar o cabeçalho (linha com "ATIVIDADE")
  const headerIdx = lines.findIndex(l => l.toUpperCase().includes('ATIVIDADE'));
  if (headerIdx === -1) return [];
  const dataLines = lines.slice(headerIdx + 1);

  return dataLines
    .filter(l => l && !l.startsWith(',,,'))
    .map((line, i) => {
      // Parse CSV respeitando aspas
      const cols = parseCSVLine(line);
      const atividade   = (cols[0] || '').trim();
      const descricao   = (cols[1] || '').trim();
      const frequencia  = normFreq((cols[2] || '').trim());
      const lembrete    = (cols[3] || '').trim();
      const destinatario = (cols[4] || '').trim();

      if (!atividade) return null;

      // Extrai dia do mês ou dia da semana do campo "Lembrete"
      const { diaMes, diaSemana } = parseLembrete(lembrete, frequencia);

      // Infere categoria pelo nome da atividade e descrição
      const categoria = inferCategoria(atividade, descricao);

      return {
        id: `sheet_${i}`,
        atividade,
        descricao,
        categoria,
        frequencia,
        diaMes,
        diaSemana,
        dataEspecifica: '',
        destinatario,
        contato: '',
        observacao: lembrete,
        ativo: true,
        fromSheet: true,
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
    // "todo dia 20 de cada mês" → 20
    const match = lower.match(/dia\s+(\d{1,2})/);
    if (match) diaMes = parseInt(match[1]);
  }

  if (frequencia === 'semanal') {
    // "toda terça feira" / "toda sexta feira"
    const map = {
      'segunda': 'Segunda-feira',
      'terca': 'Terça-feira',
      'terça': 'Terça-feira',
      'quarta': 'Quarta-feira',
      'quinta': 'Quinta-feira',
      'sexta': 'Sexta-feira',
      'sabado': 'Sábado',
      'sábado': 'Sábado',
      'domingo': 'Domingo',
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
  if (text.includes('reunião') || text.includes('reuniao') || text.includes('apresentação')) return 'reunioes';
  if (text.includes('podcast')) return 'reunioes';
  return 'pessoal';
}

// ─── DATE HELPERS ───────────────────────────────────────────────────
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

// ─── BLANK ACTIVITY ─────────────────────────────────────────────────
function blankActivity() {
  return {
    id: Date.now().toString(),
    atividade: '', descricao: '', categoria: 'pessoal',
    frequencia: 'mensal', diaMes: '', diaSemana: '',
    dataEspecifica: '', destinatario: '', contato: '',
    observacao: '', ativo: true, fromSheet: false,
  };
}

// ─── VOICE PARSER ───────────────────────────────────────────────────
function parseVoiceText(text) {
  const lower = text.toLowerCase();
  const activity = blankActivity();
  activity.atividade = text.split(' ').slice(0, 6).join(' ');
  activity.descricao = text;
  activity.categoria = inferCategoria(text, '');

  const diaMatch = text.match(/dia\s+(\d{1,2})/i);
  if (diaMatch) { activity.frequencia = 'mensal'; activity.diaMes = parseInt(diaMatch[1]); }

  WEEKDAYS.forEach(d => {
    if (lower.includes(d.toLowerCase())) {
      activity.frequencia = 'semanal';
      activity.diaSemana = d;
    }
  });

  const destMatch = text.match(/para\s+([A-ZÁÉÍÓÚ][a-záéíóú]+(?:\s+[A-ZÁÉÍÓÚ][a-záéíóú]+)?)/);
  if (destMatch) activity.destinatario = destMatch[1];

  return activity;
}

// ─── LOCAL EXTRAS (atividades adicionadas manualmente no app) ────────
const LOCAL_KEY = 'adriel_local_extras_v1';
function loadLocalExtras() {
  try { const r = localStorage.getItem(LOCAL_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
}
function saveLocalExtras(data) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(data)); } catch {}
}

// ─── MAIN APP ───────────────────────────────────────────────────────
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

  // Combina atividades da planilha + extras locais
  const activities = [...sheetActivities, ...localExtras];

  // ── FETCH PLANILHA ────────────────────────────────────────────────
  const fetchSheet = useCallback(async () => {
    try {
      const res = await fetch(SHEET_CSV_URL);
      if (!res.ok) throw new Error('Erro ao buscar planilha');
      const text = await res.text();
      const parsed = parseCSV(text);
      setSheetActivities(parsed);
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

  // ── CLOCK ────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── PERSIST LOCAL EXTRAS ─────────────────────────────────────────
  useEffect(() => { saveLocalExtras(localExtras); }, [localExtras]);

  const showToast = useCallback((msg, type = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  }, []);

  // ── VOICE ────────────────────────────────────────────────────────
  const startRecording = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { showToast('Reconhecimento de voz não suportado', 'err'); return; }
    const rec = new SR();
    rec.lang = 'pt-BR';
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (e) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
      setVoiceText(transcript);
      if (e.results[0].isFinal) {
        setVoiceParsed(parseVoiceText(transcript));
        setRecording(false);
      }
    };
    rec.onerror = () => { setRecording(false); showToast('Erro ao gravar. Tente novamente.', 'err'); };
    rec.onend = () => setRecording(false);
    recognitionRef.current = rec;
    rec.start();
    setRecording(true);
    setVoiceText('');
    setVoiceParsed(null);
  }, [showToast]);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    setRecording(false);
  }, []);

  const acceptVoice = useCallback(() => {
    if (!voiceParsed) return;
    setEditItem({ ...voiceParsed });
    setVoiceText('');
    setVoiceParsed(null);
    setView('form');
  }, [voiceParsed]);

  // ── CRUD (apenas para extras locais) ─────────────────────────────
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
    showToast('Atividade excluída', 'warn');
    setView('all');
  }, [showToast]);

  const toggleActive = useCallback((id) => {
    // Para itens da planilha, armazena override local
    const isSheet = sheetActivities.find(a => a.id === id);
    if (isSheet) {
      setSheetActivities(prev => prev.map(a => a.id === id ? { ...a, ativo: !a.ativo } : a));
    } else {
      setLocalExtras(prev => prev.map(a => a.id === id ? { ...a, ativo: !a.ativo } : a));
    }
  }, [sheetActivities]);

  // ── COMPUTED ─────────────────────────────────────────────────────
  const todayItems = getTodayActivities(activities);
  const allFiltered = activities.filter(a => {
    const matchText = !filter ||
      a.atividade.toLowerCase().includes(filter.toLowerCase()) ||
      a.destinatario.toLowerCase().includes(filter.toLowerCase()) ||
      a.descricao.toLowerCase().includes(filter.toLowerCase());
    const matchCat = !filterCat || a.categoria === filterCat;
    return matchText && matchCat;
  });

  const grouped = todayItems.reduce((acc, a) => {
    if (!acc[a.categoria]) acc[a.categoria] = [];
    acc[a.categoria].push(a);
    return acc;
  }, {});

  const catOf = (id) => CATEGORIES.find(c => c.id === id) || CATEGORIES[4];

  // ── RENDER ───────────────────────────────────────────────────────
  return (
    <div style={styles.root}>
      {/* HEADER */}
      <header style={styles.header}>
        <div style={styles.headerTop}>
          <div>
            <div style={styles.greeting}>Bom dia, Adriel</div>
            <div style={styles.clock}>{formatTime(now)}</div>
          </div>
          <div style={styles.dateBox}>
            <div style={styles.dateDay}>{now.getDate()}</div>
            <div style={styles.dateMonth}>{now.toLocaleDateString('pt-BR',{month:'short'}).replace('.','').toUpperCase()}</div>
          </div>
        </div>
        <div style={styles.dateStr}>{formatDate(now)}</div>

        {/* SYNC STATUS */}
        <div style={styles.syncRow}>
          {loading && <span style={styles.syncLoading}>⟳ Carregando planilha…</span>}
          {!loading && !syncError && lastSync && (
            <span style={styles.syncOk}>
              ✓ Planilha sincronizada · {lastSync.toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'})}
              <button onClick={fetchSheet} style={styles.syncBtn}>↻</button>
            </span>
          )}
          {syncError && (
            <span style={styles.syncErr}>
              ⚠ Erro ao sincronizar
              <button onClick={fetchSheet} style={styles.syncBtn}>Tentar novamente</button>
            </span>
          )}
        </div>
      </header>

      {/* NAV */}
      <nav style={styles.nav}>
        {[
          { id: 'today', label: `Hoje (${todayItems.length})` },
          { id: 'all',   label: `Todas (${activities.length})` },
        ].map(t => (
          <button key={t.id} onClick={() => setView(t.id)} style={{
            ...styles.navBtn, ...(view === t.id ? styles.navBtnActive : {})
          }}>{t.label}</button>
        ))}
        <button onClick={() => { setEditItem(blankActivity()); setView('form'); }} style={styles.navAdd}>+ Nova</button>
      </nav>

      {/* VOICE BAR */}
      <div style={styles.voiceBar}>
        <button
          onMouseDown={startRecording} onTouchStart={startRecording}
          onMouseUp={stopRecording}   onTouchEnd={stopRecording}
          style={{ ...styles.voiceBtn, ...(recording ? styles.voiceBtnActive : {}) }}
        >
          <span style={styles.voiceIcon}>{recording ? '⏹' : '🎙'}</span>
          <span style={styles.voiceLabel}>{recording ? 'Gravando…' : 'Segurar para falar'}</span>
        </button>
        {voiceText && (
          <div style={styles.voicePreview}>
            <span style={styles.voiceTranscript}>"{voiceText}"</span>
            {voiceParsed && (
              <button onClick={acceptVoice} style={styles.voiceAccept}>Confirmar →</button>
            )}
          </div>
        )}
      </div>

      {/* CONTENT */}
      <main style={styles.main}>
        {/* TODAY */}
        {view === 'today' && (
          <div>
            {loading ? (
              <div style={styles.empty}>
                <div style={styles.emptyIcon}>⟳</div>
                <div style={styles.emptyTitle}>Carregando…</div>
              </div>
            ) : todayItems.length === 0 ? (
              <div style={styles.empty}>
                <div style={styles.emptyIcon}>✅</div>
                <div style={styles.emptyTitle}>Nada para hoje</div>
                <div style={styles.emptyText}>Nenhuma atividade programada para este dia.</div>
              </div>
            ) : (
              Object.entries(grouped)
                .sort(([a],[b]) => a === 'urgente' ? -1 : b === 'urgente' ? 1 : 0)
                .map(([catId, items]) => {
                  const cat = catOf(catId);
                  return (
                    <div key={catId} style={styles.catSection}>
                      <div style={styles.catHeader}>
                        <span style={{ ...styles.catDot, background: cat.color }} />
                        <span style={styles.catName}>{cat.icon} {cat.label}</span>
                        <span style={styles.catCount}>{items.length}</span>
                      </div>
                      {items.map(a => (
                        <ActivityCard key={a.id} activity={a} catColor={cat.color}
                          onEdit={() => { setEditItem({...a}); setView('form'); }}
                          onDelete={() => setDeleteConfirm(a.id)}
                          onToggle={() => toggleActive(a.id)}
                        />
                      ))}
                    </div>
                  );
                })
            )}
          </div>
        )}

        {/* ALL */}
        {view === 'all' && (
          <div>
            <div style={styles.filterRow}>
              <input style={styles.searchInput} placeholder="Buscar atividade ou pessoa…"
                value={filter} onChange={e => setFilter(e.target.value)} />
              <select style={styles.catSelect} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                <option value="">Todas</option>
                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
              </select>
            </div>
            {allFiltered.length === 0 ? (
              <div style={styles.empty}>
                <div style={styles.emptyIcon}>🔍</div>
                <div style={styles.emptyTitle}>Nenhum resultado</div>
              </div>
            ) : (
              allFiltered.map(a => {
                const cat = catOf(a.categoria);
                return (
                  <ActivityCard key={a.id} activity={a} catColor={cat.color}
                    onEdit={() => { setEditItem({...a}); setView('form'); }}
                    onDelete={() => setDeleteConfirm(a.id)}
                    onToggle={() => toggleActive(a.id)}
                    showCat
                  />
                );
              })
            )}
          </div>
        )}

        {/* FORM */}
        {view === 'form' && editItem && (
          <ActivityForm item={editItem} onSave={saveActivity}
            onCancel={() => { setView('all'); setEditItem(null); }}
            onDelete={() => setDeleteConfirm(editItem.id)}
          />
        )}
      </main>

      {/* DELETE CONFIRM */}
      {deleteConfirm && (
        <div style={styles.overlay}>
          <div style={styles.dialog}>
            <div style={styles.dialogTitle}>Excluir atividade?</div>
            <div style={styles.dialogText}>Esta ação não pode ser desfeita.</div>
            <div style={styles.dialogBtns}>
              <button onClick={() => setDeleteConfirm(null)} style={styles.btnSecondary}>Cancelar</button>
              <button onClick={() => deleteActivity(deleteConfirm)} style={styles.btnDanger}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div style={{ ...styles.toast, ...(toast.type==='err' ? styles.toastErr : toast.type==='warn' ? styles.toastWarn : {}) }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ─── ACTIVITY CARD ───────────────────────────────────────────────────
function ActivityCard({ activity: a, catColor, onEdit, onDelete, onToggle, showCat }) {
  const cat = CATEGORIES.find(c => c.id === a.categoria) || CATEGORIES[4];
  return (
    <div style={{ ...styles.card, opacity: a.ativo ? 1 : 0.45, borderLeft: `3px solid ${catColor}` }}>
      <div style={styles.cardTop}>
        <div style={styles.cardTitle}>{a.atividade}</div>
        <div style={styles.cardActions}>
          {a.fromSheet && <span style={styles.sheetBadge}>📊</span>}
          <button onClick={onToggle} title={a.ativo ? 'Pausar' : 'Ativar'} style={styles.iconBtn}>{a.ativo ? '⏸' : '▶'}</button>
          {!a.fromSheet && <button onClick={onEdit} title="Editar" style={styles.iconBtn}>✏️</button>}
          {!a.fromSheet && <button onClick={onDelete} title="Excluir" style={styles.iconBtnDanger}>🗑</button>}
        </div>
      </div>
      {a.descricao && <div style={styles.cardDesc}>{a.descricao}</div>}
      <div style={styles.cardMeta}>
        {showCat && <span style={{ ...styles.badge, background: catColor+'22', color: catColor }}>{cat.icon} {cat.label}</span>}
        {a.destinatario && <span style={styles.badgeNeutral}>→ {a.destinatario}</span>}
        {a.frequencia && <span style={styles.badgeNeutral}>{FREQUENCIES.find(f=>f.id===a.frequencia)?.label || a.frequencia}</span>}
        {a.frequencia === 'mensal' && a.diaMes && <span style={styles.badgeNeutral}>dia {a.diaMes}</span>}
        {a.frequencia === 'semanal' && a.diaSemana && <span style={styles.badgeNeutral}>{a.diaSemana}</span>}
      </div>
      {a.observacao && <div style={styles.cardObs}>⚑ {a.observacao}</div>}
    </div>
  );
}

// ─── ACTIVITY FORM ───────────────────────────────────────────────────
function ActivityForm({ item, onSave, onCancel, onDelete }) {
  const [form, setForm] = useState(item);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const isNew = !item.atividade;

  return (
    <div style={styles.form}>
      <div style={styles.formHeader}>
        <span style={styles.formTitle}>{isNew ? 'Nova atividade' : 'Editar atividade'}</span>
        {!isNew && !item.fromSheet && <button onClick={onDelete} style={styles.formDelete}>Excluir</button>}
      </div>
      {item.fromSheet && (
        <div style={styles.sheetNote}>📊 Esta atividade vem da planilha. Edite diretamente no Google Sheets.</div>
      )}

      <div style={styles.formGroup}>
        <label style={styles.label}>Atividade *</label>
        <input style={styles.input} value={form.atividade} onChange={e=>set('atividade',e.target.value)} placeholder="Nome curto da atividade" disabled={form.fromSheet} />
      </div>
      <div style={styles.formGroup}>
        <label style={styles.label}>Descrição</label>
        <textarea style={styles.textarea} value={form.descricao} onChange={e=>set('descricao',e.target.value)} rows={2} disabled={form.fromSheet} />
      </div>
      <div style={styles.formRow}>
        <div style={{ flex:1 }}>
          <label style={styles.label}>Categoria</label>
          <select style={styles.select} value={form.categoria} onChange={e=>set('categoria',e.target.value)}>
            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
          </select>
        </div>
        <div style={{ flex:1 }}>
          <label style={styles.label}>Frequência</label>
          <select style={styles.select} value={form.frequencia} onChange={e=>set('frequencia',e.target.value)} disabled={form.fromSheet}>
            {FREQUENCIES.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </div>
      </div>
      {form.frequencia === 'mensal' && (
        <div style={styles.formGroup}>
          <label style={styles.label}>Dia do mês</label>
          <input style={styles.input} type="number" min="1" max="31" value={form.diaMes} onChange={e=>set('diaMes',e.target.value)} disabled={form.fromSheet} />
        </div>
      )}
      {form.frequencia === 'semanal' && (
        <div style={styles.formGroup}>
          <label style={styles.label}>Dia da semana</label>
          <select style={styles.select} value={form.diaSemana} onChange={e=>set('diaSemana',e.target.value)} disabled={form.fromSheet}>
            <option value="">Selecione</option>
            {WEEKDAYS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      )}
      <div style={styles.formRow}>
        <div style={{ flex:1 }}>
          <label style={styles.label}>Destinatário</label>
          <input style={styles.input} value={form.destinatario} onChange={e=>set('destinatario',e.target.value)} disabled={form.fromSheet} />
        </div>
        <div style={{ flex:1 }}>
          <label style={styles.label}>Canal</label>
          <input style={styles.input} value={form.contato} onChange={e=>set('contato',e.target.value)} placeholder="WhatsApp / E-mail…" />
        </div>
      </div>
      <div style={styles.formGroup}>
        <label style={styles.label}>Observação</label>
        <input style={styles.input} value={form.observacao} onChange={e=>set('observacao',e.target.value)} />
      </div>
      <div style={styles.formGroup}>
        <label style={styles.toggleRow}>
          <span style={styles.label}>Ativo</span>
          <div onClick={() => set('ativo', !form.ativo)} style={{ ...styles.toggle, background: form.ativo ? '#c9a84c' : '#333' }}>
            <div style={{ ...styles.toggleThumb, transform: form.ativo ? 'translateX(18px)' : 'translateX(2px)' }} />
          </div>
        </label>
      </div>
      <div style={styles.formFooter}>
        <button onClick={onCancel} style={styles.btnSecondary}>Cancelar</button>
        {!item.fromSheet && <button onClick={() => onSave(form)} style={styles.btnPrimary} disabled={!form.atividade}>Salvar</button>}
      </div>
    </div>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────
const styles = {
  root: { minHeight:'100dvh', background:'#0a0a0a', color:'#e8e4d9', fontFamily:"'DM Sans', sans-serif", maxWidth:480, margin:'0 auto', position:'relative', paddingBottom:40 },
  header: { padding:'52px 24px 16px', borderBottom:'1px solid #1e1e1e', background:'linear-gradient(180deg, #111 0%, #0a0a0a 100%)' },
  headerTop: { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 },
  greeting: { fontFamily:"'DM Serif Display', serif", fontSize:26, color:'#e8e4d9', letterSpacing:'-0.5px' },
  clock: { fontSize:13, color:'#c9a84c', fontVariantNumeric:'tabular-nums', letterSpacing:'0.05em', marginTop:2 },
  dateBox: { textAlign:'center', background:'#c9a84c', borderRadius:8, padding:'6px 12px', minWidth:52 },
  dateDay: { fontFamily:"'DM Serif Display', serif", fontSize:24, color:'#0a0a0a', lineHeight:1 },
  dateMonth: { fontSize:10, color:'#0a0a0a', fontWeight:500, letterSpacing:'0.1em', marginTop:2 },
  dateStr: { fontSize:12, color:'#666', letterSpacing:'0.03em', marginBottom:8 },
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
  voiceBtn: { display:'flex', alignItems:'center', gap:10, width:'100%', padding:'10px 16px', background:'#141414', border:'1px solid #2a2a2a', borderRadius:10, cursor:'pointer', fontFamily:"'DM Sans', sans-serif", transition:'all 0.2s' },
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
  card: { background:'#111', borderRadius:12, padding:'14px 16px', marginBottom:10, borderLeft:'3px solid #333', transition:'opacity 0.2s' },
  cardTop: { display:'flex', alignItems:'flex-start', gap:8, marginBottom:4 },
  cardTitle: { flex:1, fontSize:15, fontWeight:500, color:'#e8e4d9', lineHeight:1.3 },
  cardActions: { display:'flex', gap:4, flexShrink:0, alignItems:'center' },
  sheetBadge: { fontSize:12, opacity:0.6 },
  iconBtn: { background:'transparent', border:'none', cursor:'pointer', fontSize:14, padding:'2px 4px', borderRadius:4 },
  iconBtnDanger: { background:'transparent', border:'none', cursor:'pointer', fontSize:14, padding:'2px 4px', borderRadius:4, opacity:0.6 },
  cardDesc: { fontSize:13, color:'#777', marginBottom:8, lineHeight:1.4 },
  cardMeta: { display:'flex', flexWrap:'wrap', gap:6, marginBottom:4 },
  badge: { fontSize:11, padding:'3px 8px', borderRadius:99, fontWeight:500 },
  badgeNeutral: { fontSize:11, padding:'3px 8px', borderRadius:99, background:'#1e1e1e', color:'#888' },
  cardObs: { fontSiz
