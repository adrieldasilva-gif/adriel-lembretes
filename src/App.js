import React, { useState, useEffect, useRef, useCallback } from 'react';

// ─── CATEGORY CONFIG ────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'pagamentos',    label: 'Pagamentos',     icon: '💰', color: '#c9a84c' },
  { id: 'relatorios',    label: 'Relatórios',     icon: '📋', color: '#6b9fd4' },
  { id: 'cobrancas',     label: 'Cobranças',      icon: '📞', color: '#d4756b' },
  { id: 'rh',            label: 'RH / Colaboradores', icon: '👥', color: '#8bc48b' },
  { id: 'pessoal',       label: 'Pessoal',        icon: '🏃', color: '#b68cd4' },
  { id: 'processos',     label: 'Processos',      icon: '📁', color: '#d4a56b' },
  { id: 'reunioes',      label: 'Reuniões',       icon: '📅', color: '#6bd4c8' },
  { id: 'urgente',       label: 'Urgente',        icon: '⚠️', color: '#d46b6b' },
];

const FREQUENCIES = [
  { id: 'mensal',     label: 'Mensal' },
  { id: 'semanal',    label: 'Semanal' },
  { id: 'quinzenal',  label: 'Quinzenal' },
  { id: 'anual',      label: 'Anual' },
  { id: 'unico',      label: 'Único' },
];

const WEEKDAYS = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];

// ─── STORAGE HELPERS ────────────────────────────────────────────────
const STORAGE_KEY = 'adriel_agenda_v1';

const defaultActivities = [
  { id: '1', atividade: 'Pagamento Sandro', descricao: 'Pagamento mensal do personal trainer', categoria: 'pagamentos', frequencia: 'mensal', diaMes: 10, diaSemana: '', dataEspecifica: '', destinatario: 'Adriel mesmo', contato: 'WhatsApp', observacao: 'Confirmar valor com Sandro antes', ativo: true },
  { id: '2', atividade: 'Pagamento Marketing', descricao: 'Link de marketing pessoal', categoria: 'pagamentos', frequencia: 'mensal', diaMes: 10, diaSemana: '', dataEspecifica: '', destinatario: 'Adriel mesmo', contato: 'WhatsApp', observacao: 'Verificar fatura antes', ativo: true },
  { id: '3', atividade: 'Relatório Stephanie', descricao: 'Solicitar relatório mensal de final de mês', categoria: 'relatorios', frequencia: 'mensal', diaMes: 28, diaSemana: '', dataEspecifica: '', destinatario: 'Stephanie (HBJ)', contato: 'WhatsApp', observacao: 'Solicitar por escrito', ativo: true },
  { id: '4', atividade: 'Relatório Josiane', descricao: 'Enviar relatório de exames de ultrassom', categoria: 'relatorios', frequencia: 'mensal', diaMes: 10, diaSemana: '', dataEspecifica: '', destinatario: 'Josiane (HBJ)', contato: 'E-mail', observacao: 'Enviar em PDF, formato padrão', ativo: true },
  { id: '5', atividade: 'Reunião de equipe', descricao: 'Reunião semanal de gestão', categoria: 'reunioes', frequencia: 'semanal', diaMes: '', diaSemana: 'Terça-feira', dataEspecifica: '', destinatario: 'Equipe', contato: 'Presencial', observacao: 'Preparar pauta com antecedência', ativo: true },
];

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return defaultActivities;
}

function saveData(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

// ─── DATE HELPERS ───────────────────────────────────────────────────
function getTodayActivities(activities) {
  const now = new Date();
  const dayOfMonth = now.getDate();
  const dayOfWeek = WEEKDAYS[now.getDay()];
  const mmdd = `${String(now.getMonth()+1).padStart(2,'0')}/${String(dayOfMonth).padStart(2,'0')}`;

  return activities.filter(a => {
    if (!a.ativo) return false;
    if (a.frequencia === 'mensal' || a.frequencia === 'quinzenal') {
      const dias = a.frequencia === 'quinzenal'
        ? [1, 16]
        : [Number(a.diaMes)];
      return dias.includes(dayOfMonth);
    }
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
    observacao: '', ativo: true,
  };
}

// ─── VOICE PARSER ───────────────────────────────────────────────────
function parseVoiceText(text) {
  const lower = text.toLowerCase();
  const activity = blankActivity();
  activity.atividade = text.split(' ').slice(0, 6).join(' ');
  activity.descricao = text;

  CATEGORIES.forEach(c => {
    if (lower.includes(c.label.toLowerCase()) || lower.includes(c.id)) {
      activity.categoria = c.id;
    }
  });
  if (lower.includes('pagar') || lower.includes('pagamento')) activity.categoria = 'pagamentos';
  if (lower.includes('relatório') || lower.includes('relatorio')) activity.categoria = 'relatorios';
  if (lower.includes('reunião') || lower.includes('reuniao')) activity.categoria = 'reunioes';
  if (lower.includes('urgente')) activity.categoria = 'urgente';

  const diaMatch = text.match(/dia\s+(\d{1,2})/i);
  if (diaMatch) { activity.frequencia = 'mensal'; activity.diaMes = parseInt(diaMatch[1]); }

  WEEKDAYS.forEach(d => {
    if (lower.includes(d.toLowerCase())) {
      activity.frequencia = 'semanal';
      activity.diaSemana = d;
    }
  });

  const destMatch = text.match(/para\s+([A-Z][a-záéíóú]+(?:\s+[A-Z][a-záéíóú]+)?)/);
  if (destMatch) activity.destinatario = destMatch[1];

  return activity;
}

// ─── MAIN APP ───────────────────────────────────────────────────────
export default function App() {
  const [activities, setActivities] = useState(loadData);
  const [view, setView] = useState('today'); // 'today' | 'all' | 'form'
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
  const timerRef = useRef(null);

  // Clock
  useEffect(() => {
    timerRef.current = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  // Persist
  useEffect(() => { saveData(activities); }, [activities]);

  const showToast = useCallback((msg, type = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  }, []);

  // ── VOICE ──────────────────────────────────────────────────────────
  const startRecording = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { showToast('Reconhecimento de voz não suportado neste navegador', 'err'); return; }
    const rec = new SpeechRecognition();
    rec.lang = 'pt-BR';
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (e) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
      setVoiceText(transcript);
      if (e.results[0].isFinal) {
        const parsed = parseVoiceText(transcript);
        setVoiceParsed(parsed);
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

  // ── CRUD ──────────────────────────────────────────────────────────
  const saveActivity = useCallback((item) => {
    setActivities(prev => {
      const exists = prev.find(a => a.id === item.id);
      return exists ? prev.map(a => a.id === item.id ? item : a) : [...prev, item];
    });
    showToast(item.atividade ? `"${item.atividade}" salvo!` : 'Atividade salva!');
    setView('all');
    setEditItem(null);
  }, [showToast]);

  const deleteActivity = useCallback((id) => {
    setActivities(prev => prev.filter(a => a.id !== id));
    setDeleteConfirm(null);
    showToast('Atividade excluída', 'warn');
    setView('all');
  }, [showToast]);

  const toggleActive = useCallback((id) => {
    setActivities(prev => prev.map(a => a.id === id ? { ...a, ativo: !a.ativo } : a));
  }, []);

  // ── COMPUTED ─────────────────────────────────────────────────────
  const todayItems = getTodayActivities(activities);
  const allFiltered = activities.filter(a => {
    const matchText = !filter || a.atividade.toLowerCase().includes(filter.toLowerCase()) || a.destinatario.toLowerCase().includes(filter.toLowerCase()) || a.descricao.toLowerCase().includes(filter.toLowerCase());
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
      </header>

      {/* NAV */}
      <nav style={styles.nav}>
        {[
          { id: 'today', label: `Hoje (${todayItems.length})` },
          { id: 'all', label: `Todas (${activities.length})` },
        ].map(t => (
          <button key={t.id} onClick={() => setView(t.id)} style={{
            ...styles.navBtn,
            ...(view === t.id ? styles.navBtnActive : {})
          }}>{t.label}</button>
        ))}
        <button onClick={() => { setEditItem(blankActivity()); setView('form'); }} style={styles.navAdd}>+ Nova</button>
      </nav>

      {/* VOICE BAR */}
      <div style={styles.voiceBar}>
        <button
          onMouseDown={startRecording}
          onTouchStart={startRecording}
          onMouseUp={stopRecording}
          onTouchEnd={stopRecording}
          style={{ ...styles.voiceBtn, ...(recording ? styles.voiceBtnActive : {}) }}
          title="Segure para falar"
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
        {/* TODAY VIEW */}
        {view === 'today' && (
          <div>
            {todayItems.length === 0 ? (
              <div style={styles.empty}>
                <div style={styles.emptyIcon}>✅</div>
                <div style={styles.emptyTitle}>Nada para hoje</div>
                <div style={styles.emptyText}>Nenhuma atividade programada para este dia.</div>
              </div>
            ) : (
              Object.entries(grouped).sort(([a],[b]) => a === 'urgente' ? -1 : b === 'urgente' ? 1 : 0).map(([catId, items]) => {
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

        {/* ALL VIEW */}
        {view === 'all' && (
          <div>
            <div style={styles.filterRow}>
              <input
                style={styles.searchInput}
                placeholder="Buscar atividade ou pessoa…"
                value={filter}
                onChange={e => setFilter(e.target.value)}
              />
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

        {/* FORM VIEW */}
        {view === 'form' && editItem && (
          <ActivityForm
            item={editItem}
            onSave={saveActivity}
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
        <div style={{ ...styles.toast, ...(toast.type === 'err' ? styles.toastErr : toast.type === 'warn' ? styles.toastWarn : {}) }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ─── ACTIVITY CARD ──────────────────────────────────────────────────
function ActivityCard({ activity: a, catColor, onEdit, onDelete, onToggle, showCat }) {
  const cat = CATEGORIES.find(c => c.id === a.categoria) || CATEGORIES[4];
  return (
    <div style={{ ...styles.card, opacity: a.ativo ? 1 : 0.45, borderLeft: `3px solid ${catColor}` }}>
      <div style={styles.cardTop}>
        <div style={styles.cardTitle}>{a.atividade}</div>
        <div style={styles.cardActions}>
          <button onClick={onToggle} title={a.ativo ? 'Pausar' : 'Ativar'} style={styles.iconBtn}>{a.ativo ? '⏸' : '▶'}</button>
          <button onClick={onEdit} title="Editar" style={styles.iconBtn}>✏️</button>
          <button onClick={onDelete} title="Excluir" style={styles.iconBtnDanger}>🗑</button>
        </div>
      </div>
      {a.descricao && <div style={styles.cardDesc}>{a.descricao}</div>}
      <div style={styles.cardMeta}>
        {showCat && <span style={{ ...styles.badge, background: catColor + '22', color: catColor }}>{cat.icon} {cat.label}</span>}
        {a.destinatario && <span style={styles.badgeNeutral}>→ {a.destinatario}</span>}
        {a.frequencia && <span style={styles.badgeNeutral}>{FREQUENCIES.find(f=>f.id===a.frequencia)?.label || a.frequencia}</span>}
        {a.frequencia === 'mensal' && a.diaMes && <span style={styles.badgeNeutral}>dia {a.diaMes}</span>}
        {a.frequencia === 'semanal' && a.diaSemana && <span style={styles.badgeNeutral}>{a.diaSemana}</span>}
      </div>
      {a.observacao && <div style={styles.cardObs}>⚑ {a.observacao}</div>}
    </div>
  );
}

// ─── ACTIVITY FORM ──────────────────────────────────────────────────
function ActivityForm({ item, onSave, onCancel, onDelete }) {
  const [form, setForm] = useState(item);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const isNew = !item.atividade;

  return (
    <div style={styles.form}>
      <div style={styles.formHeader}>
        <span style={styles.formTitle}>{isNew ? 'Nova atividade' : 'Editar atividade'}</span>
        {!isNew && <button onClick={onDelete} style={styles.formDelete}>Excluir</button>}
      </div>

      <div style={styles.formGroup}>
        <label style={styles.label}>Atividade *</label>
        <input style={styles.input} value={form.atividade} onChange={e=>set('atividade',e.target.value)} placeholder="Nome curto da atividade" />
      </div>

      <div style={styles.formGroup}>
        <label style={styles.label}>Descrição</label>
        <textarea style={styles.textarea} value={form.descricao} onChange={e=>set('descricao',e.target.value)} placeholder="Descreva o que deve ser feito" rows={2} />
      </div>

      <div style={styles.formRow}>
        <div style={{ flex: 1 }}>
          <label style={styles.label}>Categoria</label>
          <select style={styles.select} value={form.categoria} onChange={e=>set('categoria',e.target.value)}>
            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={styles.label}>Frequência</label>
          <select style={styles.select} value={form.frequencia} onChange={e=>set('frequencia',e.target.value)}>
            {FREQUENCIES.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </div>
      </div>

      {(form.frequencia === 'mensal') && (
        <div style={styles.formGroup}>
          <label style={styles.label}>Dia do mês</label>
          <input style={styles.input} type="number" min="1" max="31" value={form.diaMes} onChange={e=>set('diaMes',e.target.value)} placeholder="Ex: 10" />
        </div>
      )}

      {(form.frequencia === 'semanal') && (
        <div style={styles.formGroup}>
          <label style={styles.label}>Dia da semana</label>
          <select style={styles.select} value={form.diaSemana} onChange={e=>set('diaSemana',e.target.value)}>
            <option value="">Selecione</option>
            {WEEKDAYS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      )}

      {(form.frequencia === 'anual' || form.frequencia === 'unico') && (
        <div style={styles.formGroup}>
          <label style={styles.label}>Data (MM/DD)</label>
          <input style={styles.input} value={form.dataEspecifica} onChange={e=>set('dataEspecifica',e.target.value)} placeholder="Ex: 06/10" />
        </div>
      )}

      <div style={styles.formRow}>
        <div style={{ flex: 1 }}>
          <label style={styles.label}>Destinatário</label>
          <input style={styles.input} value={form.destinatario} onChange={e=>set('destinatario',e.target.value)} placeholder="Para quem?" />
        </div>
        <div style={{ flex: 1 }}>
          <label style={styles.label}>Canal</label>
          <input style={styles.input} value={form.contato} onChange={e=>set('contato',e.target.value)} placeholder="WhatsApp / E-mail…" />
        </div>
      </div>

      <div style={styles.formGroup}>
        <label style={styles.label}>Observação</label>
        <input style={styles.input} value={form.observacao} onChange={e=>set('observacao',e.target.value)} placeholder="Detalhe importante" />
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
        <button onClick={() => onSave(form)} style={styles.btnPrimary} disabled={!form.atividade}>Salvar</button>
      </div>
    </div>
  );
}

// ─── STYLES ─────────────────────────────────────────────────────────
const styles = {
  root: {
    minHeight: '100dvh',
    background: '#0a0a0a',
    color: '#e8e4d9',
    fontFamily: "'DM Sans', sans-serif",
    maxWidth: 480,
    margin: '0 auto',
    position: 'relative',
    paddingBottom: 40,
  },
  header: {
    padding: '52px 24px 24px',
    borderBottom: '1px solid #1e1e1e',
    background: 'linear-gradient(180deg, #111 0%, #0a0a0a 100%)',
  },
  headerTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  greeting: { fontFamily: "'DM Serif Display', serif", fontSize: 26, color: '#e8e4d9', letterSpacing: '-0.5px' },
  clock: { fontSize: 13, color: '#c9a84c', fontVariantNumeric: 'tabular-nums', letterSpacing: '0.05em', marginTop: 2 },
  dateBox: { textAlign: 'center', background: '#c9a84c', borderRadius: 8, padding: '6px 12px', minWidth: 52 },
  dateDay: { fontFamily: "'DM Serif Display', serif", fontSize: 24, color: '#0a0a0a', lineHeight: 1 },
  dateMonth: { fontSize: 10, color: '#0a0a0a', fontWeight: 500, letterSpacing: '0.1em', marginTop: 2 },
  dateStr: { fontSize: 12, color: '#666', letterSpacing: '0.03em' },

  nav: { display: 'flex', gap: 8, padding: '12px 16px', borderBottom: '1px solid #1a1a1a', alignItems: 'center' },
  navBtn: { flex: 1, padding: '8px 0', background: 'transparent', border: '1px solid #2a2a2a', borderRadius: 8, color: '#888', fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  navBtnActive: { background: '#1a1a1a', border: '1px solid #c9a84c', color: '#c9a84c' },
  navAdd: { padding: '8px 14px', background: '#c9a84c', border: 'none', borderRadius: 8, color: '#0a0a0a', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap' },

  voiceBar: { padding: '12px 16px', borderBottom: '1px solid #1a1a1a', background: '#0d0d0d' },
  voiceBtn: {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
    padding: '10px 16px', background: '#141414', border: '1px solid #2a2a2a',
    borderRadius: 10, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", transition: 'all 0.2s',
  },
  voiceBtnActive: { background: '#1a1209', border: '1px solid #c9a84c', boxShadow: '0 0 0 3px #c9a84c22' },
  voiceIcon: { fontSize: 18 },
  voiceLabel: { fontSize: 13, color: '#888' },
  voicePreview: { marginTop: 10, padding: '10px 12px', background: '#111', borderRadius: 8, border: '1px solid #222' },
  voiceTranscript: { fontSize: 13, color: '#aaa', fontStyle: 'italic', display: 'block', marginBottom: 8 },
  voiceAccept: { fontSize: 12, background: '#c9a84c', color: '#0a0a0a', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontWeight: 500, fontFamily: "'DM Sans', sans-serif" },

  main: { padding: '16px', paddingBottom: 40 },

  catSection: { marginBottom: 24 },
  catHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 },
  catDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  catName: { fontSize: 13, fontWeight: 500, color: '#888', letterSpacing: '0.05em', textTransform: 'uppercase', flex: 1 },
  catCount: { fontSize: 11, color: '#555', background: '#1a1a1a', padding: '2px 8px', borderRadius: 99 },

  card: {
    background: '#111', borderRadius: 12, padding: '14px 16px',
    marginBottom: 10, borderLeft: '3px solid #333',
    transition: 'opacity 0.2s',
  },
  cardTop: { display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: 500, color: '#e8e4d9', lineHeight: 1.3 },
  cardActions: { display: 'flex', gap: 4, flexShrink: 0 },
  iconBtn: { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 14, padding: '2px 4px', borderRadius: 4 },
  iconBtnDanger: { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 14, padding: '2px 4px', borderRadius: 4, opacity: 0.6 },
  cardDesc: { fontSize: 13, color: '#777', marginBottom: 8, lineHeight: 1.4 },
  cardMeta: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  badge: { fontSize: 11, padding: '3px 8px', borderRadius: 99, fontWeight: 500 },
  badgeNeutral: { fontSize: 11, padding: '3px 8px', borderRadius: 99, background: '#1e1e1e', color: '#888' },
  cardObs: { fontSize: 11, color: '#555', marginTop: 6, fontStyle: 'italic' },

  filterRow: { display: 'flex', gap: 8, marginBottom: 16 },
  searchInput: {
    flex: 1, padding: '10px 12px', background: '#111', border: '1px solid #2a2a2a',
    borderRadius: 8, color: '#e8e4d9', fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: 'none',
  },
  catSelect: {
    padding: '10px 8px', background: '#111', border: '1px solid #2a2a2a',
    borderRadius: 8, color: '#888', fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: 'none',
  },

  empty: { textAlign: 'center', paddingTop: 60, paddingBottom: 60 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontFamily: "'DM Serif Display', serif", color: '#e8e4d9', marginBottom: 6 },
  emptyText: { fontSize: 13, color: '#555' },

  form: { background: '#0d0d0d' },
  formHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  formTitle: { fontFamily: "'DM Serif Display', serif", fontSize: 22, color: '#e8e4d9' },
  formDelete: { fontSize: 12, color: '#d46b6b', background: 'transparent', border: '1px solid #d46b6b33', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  formGroup: { marginBottom: 16 },
  formRow: { display: 'flex', gap: 12, marginBottom: 16 },
  label: { display: 'block', fontSize: 11, color: '#666', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 },
  input: { width: '100%', padding: '10px 12px', background: '#111', border: '1px solid #222', borderRadius: 8, color: '#e8e4d9', fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: 'none' },
  textarea: { width: '100%', padding: '10px 12px', background: '#111', border: '1px solid #222', borderRadius: 8, color: '#e8e4d9', fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: 'none', resize: 'vertical' },
  select: { width: '100%', padding: '10px 12px', background: '#111', border: '1px solid #222', borderRadius: 8, color: '#e8e4d9', fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: 'none' },
  toggleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' },
  toggle: { width: 42, height: 24, borderRadius: 99, transition: 'background 0.2s', position: 'relative', flexShrink: 0 },
  toggleThumb: { position: 'absolute', top: 3, width: 18, height: 18, background: '#fff', borderRadius: '50%', transition: 'transform 0.2s' },
  formFooter: { display: 'flex', gap: 10, marginTop: 24, paddingTop: 16, borderTop: '1px solid #1a1a1a' },
  btnPrimary: { flex: 1, padding: '12px', background: '#c9a84c', border: 'none', borderRadius: 8, color: '#0a0a0a', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  btnSecondary: { flex: 1, padding: '12px', background: 'transparent', border: '1px solid #2a2a2a', borderRadius: 8, color: '#888', fontSize: 14, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  btnDanger: { flex: 1, padding: '12px', background: '#d46b6b', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },

  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 },
  dialog: { background: '#111', borderRadius: 16, padding: 24, width: '100%', maxWidth: 320, border: '1px solid #2a2a2a' },
  dialogTitle: { fontFamily: "'DM Serif Display', serif", fontSize: 20, color: '#e8e4d9', marginBottom: 8 },
  dialogText: { fontSize: 13, color: '#666', marginBottom: 20 },
  dialogBtns: { display: 'flex', gap: 10 },

  toast: {
    position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
    background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e8e4d9',
    padding: '12px 20px', borderRadius: 99, fontSize: 13, zIndex: 200,
    whiteSpace: 'nowrap', boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
  },
  toastErr: { background: '#1a0808', border: '1px solid #d46b6b44', color: '#d46b6b' },
  toastWarn: { background: '#0d0d08', border: '1px solid #c9a84c44', color: '#c9a84c' },
};
