import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { movimentosDB } from './data/movements';
import { supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js'; 
import type { 
  AtletaPerfil, ItemLousa, Modalidade, 
  ResultadoProcessamento, TimelineStateItem, WodDatabaseRecord, UserProfile
} from './types';
import { calcularFisica, parseClockTime } from './utils/physicsEngine';
import { Trophy, Dumbbell, Copy, Download, Share2, Save, LogOut, X } from 'lucide-react';

export default function App() {
  // === AUTENTICAÇÃO E PERFIL ===
  const [session, setSession] = useState<Session | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);
  
  // === GESTÃO DE COACH E ATLETAS ===
  const [myAthletes, setMyAthletes] = useState<UserProfile[]>([]);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>('me');
  const [coachIdInput, setCoachIdInput] = useState('');

  // === ESTADOS DO MOTOR ===
  const [activeTab, setActiveTab] = useState<'prescricao' | 'analise' | 'atleta' | 'historico'>('prescricao');
  const [tipoTreino, setTipoTreino] = useState<Modalidade>('FOR_TIME');
  const [tempoAlvo, setTempoAlvo] = useState('05:00');
  const [roundsPrescritos, setRoundsPrescritos] = useState(3);
  const [roundsReal, setRoundsReal] = useState(0);
  const [tempoReal, setTempoReal] = useState('');
  const [tempoDescanso, setTempoDescanso] = useState(0);

  // === RASTREAMENTO DO WOD ATUAL ===
  const [currentWodId, setCurrentWodId] = useState<string | null>(null);
  const [currentShortCode, setCurrentShortCode] = useState<string | null>(null);

  // Atleta base que alimenta o motor de física
  const [atleta, setAtleta] = useState<AtletaPerfil>({
    estatura: 1.75, peso: 80, sexo: 'M', nivelTecnico: 'intermediario', envergadura: 1.75, perna: 0.85, bf: 15
  });

  const [lousa, setLousa] = useState<ItemLousa[]>([
    { originalId: crypto.randomUUID(), movId: 'thruster', phase: 'round', reps: 21, carga: 43, tecnica: 'tng', extraVal: '' }
  ]);
  const [timelineState, setTimelineState] = useState<Record<string, TimelineStateItem>>({});
  
  const [resultado, setResultado] = useState<ResultadoProcessamento | null>(null);
  const [savedWods, setSavedWods] = useState<WodDatabaseRecord[]>([]);

  // Formato do Perfil para o Onboarding
  const [onboardForm, setOnboardForm] = useState({
    full_name: '', apelido: '',is_coach: false, estatura: 1.75, peso: 80, sexo: 'M', 
    nivel_tecnico: 'intermediario', envergadura: 1.75, perna: 0.85, bf: 15
  });

  // === EFEITOS ===
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadProfile(session.user.id);
      else setLoadingAuth(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) loadProfile(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session && userProfile && !isNewUser) fetchWodsFromSupabase();
  }, [session, userProfile, isNewUser, selectedAthleteId]); // Refetch se mudar o atleta selecionado

  // === FUNÇÕES DE LOGIN / PERFIL ===
  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUserProfile(null);
    setSavedWods([]);
  };

  const loadProfile = async (userId: string) => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    
    if (error || !data) {
      setIsNewUser(true); // Se não achou perfil, vai pro Onboarding
      setLoadingAuth(false);
      return;
    }

    setUserProfile(data as UserProfile);
    syncAtletaState(data);
    
    if (data.is_coach) {
      const { data: athletes } = await supabase.from('profiles').select('*').eq('coach_id', userId);
      if (athletes) setMyAthletes(athletes as UserProfile[]);
    }
    
    setIsNewUser(false);
    setLoadingAuth(false);
  };

  const syncAtletaState = (prof: any) => {
    setAtleta({
      estatura: prof.estatura, peso: prof.peso, sexo: prof.sexo,
      nivelTecnico: prof.nivel_tecnico, envergadura: prof.envergadura,
      perna: prof.perna, bf: prof.bf
    });
  };

  const saveOnboardingProfile = async () => {
    if (!session) return;
    const payload = {
      id: session.user.id,
      ...onboardForm
    };
    
    const { error } = await supabase.from('profiles').insert([payload]);
    if (error) {
      alert('Erro ao salvar perfil: ' + error.message);
    } else {
      loadProfile(session.user.id); // Recarrega e sai do onboarding
    }
  };

  const linkToCoach = async () => {
    if (!session || !coachIdInput) return;
    const { error } = await supabase.from('profiles').update({ coach_id: coachIdInput }).eq('id', session.user.id);
    if (error) alert('Erro ao vincular coach. Verifique o ID.');
    else { alert('Coach vinculado com sucesso!'); loadProfile(session.user.id); }
  };

  const handleAthleteChange = (targetId: string) => {
    setSelectedAthleteId(targetId);
    if (targetId === 'me' && userProfile) {
      syncAtletaState(userProfile);
    } else {
      const athlete = myAthletes.find(a => a.id === targetId);
      if (athlete) syncAtletaState(athlete);
    }
  };

  // === BANCO DE DADOS (WODs) ===
  const fetchWodsFromSupabase = async () => {
    // Se for coach e selecionou um aluno, busca os WODs do aluno. Senão, busca os próprios.
    const queryId = selectedAthleteId === 'me' ? session?.user.id : selectedAthleteId;
    
    const { data, error } = await supabase.from('wods').select('*').eq('athlete_id', queryId).order('created_at', { ascending: false });
    if (!error && data) setSavedWods(data as WodDatabaseRecord[]);
  };

// === LÓGICA DE SALVAMENTO E COMPARTILHAMENTO ===
  
  // Gerador de código curto (Ex: 8XF2A9)
  const generateShortCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  const salvarNoSupabase = async (isExporting = false) => {
    if (!session || !userProfile) return null;
    
    const targetAthleteId = selectedAthleteId === 'me' ? session.user.id : selectedAthleteId;
    const newShortCode = currentShortCode || generateShortCode();

    const wodPayload = {
      title: `Treino ${tipoTreino} - ${new Date().toLocaleDateString('pt-BR')}`,
      tipo_treino: tipoTreino, tempo_alvo: tempoAlvo, rounds_prescritos: roundsPrescritos,
      rounds_real: roundsReal, tempo_real: tempoReal, tempo_descanso: tempoDescanso,
      atleta, movimentos: lousa, timeline: timelineState,
      score_watts: resultado ? resultado.potenciaReal : 0,
      score_kcal: resultado ? resultado.gastoMetabolico : 0,
      athlete_id: targetAthleteId,
      user_id: session.user.id,
      short_code: newShortCode
    };

    if (currentWodId) {
      // ATUALIZAÇÃO
      if (!isExporting && !window.confirm('Deseja sobrescrever as alterações neste WOD?')) return null;
      
      const { error } = await supabase.from('wods').update(wodPayload).eq('id', currentWodId);
      if (error) { alert('Erro ao atualizar: ' + error.message); return null; }
      if (!isExporting) alert('WOD Atualizado com sucesso!');
    } else {
      // CRIAÇÃO (NOVO)
      const { data, error } = await supabase.from('wods').insert([wodPayload]).select('id, short_code').single();
      if (error) { alert('Erro ao salvar: ' + error.message); return null; }
      setCurrentWodId(data.id);
      setCurrentShortCode(data.short_code);
      if (!isExporting) alert('Treino salvo no DynaWOD!');
    }
    
    fetchWodsFromSupabase();
    return newShortCode;
  };

  const compartilharWod = async () => {
    const code = await salvarNoSupabase(true); // Salva silenciosamente antes de exportar
    if (code) {
      navigator.clipboard.writeText(code);
      alert(`Código do WOD (${code}) copiado para a área de transferência! Envie para seus alunos.`);
    }
  };

  const importarWod = async () => {
    const codeToFind = window.prompt('Digite o código de 6 dígitos do WOD:');
    if (!codeToFind) return;

    const { data, error } = await supabase.from('wods').select('*').eq('short_code', codeToFind.toUpperCase()).single();
    
    if (error || !data) {
      alert('WOD não encontrado. Verifique o código.');
      return;
    }

    carregarDoSupabase(data);
  };

  // === FUNÇÕES DA LOUSA (Mantidas) ===
  const addMovimento = (baseId: string | null = null) => {
    const newId = crypto.randomUUID();
    let newItem: ItemLousa = { originalId: newId, movId: 'air_squat', phase: 'round', reps: 10, carga: 0, tecnica: 'tng', extraVal: '' };
    if (baseId) {
      const idx = lousa.findIndex(m => m.originalId === baseId);
      if (idx !== -1) {
        newItem = { ...lousa[idx], originalId: newId };
        const updated = [...lousa];
        updated.splice(idx + 1, 0, newItem);
        setLousa(updated);
        return;
      }
    }
    setLousa([...lousa, newItem]);
  };
  const removeMovimento = (id: string) => setLousa(lousa.filter(m => m.originalId !== id));
  const updateMovimento = (id: string, field: keyof ItemLousa, val: any) => setLousa(lousa.map(item => item.originalId === id ? { ...item, [field]: val } : item));
  const handleTimelineChange = (rowId: string, field: keyof TimelineStateItem, val: any) => setTimelineState(prev => ({ ...prev, [rowId]: { ...(prev[rowId] || { reps: 0, start: '', end: '' }), [field]: val } }));
  const carregarDoSupabase = (rec: any) => {
    setTipoTreino(rec.tipo_treino); 
    setTempoAlvo(rec.tempo_alvo); 
    setRoundsPrescritos(rec.rounds_prescritos);
    
    if (rec.rounds_real !== undefined) setRoundsReal(rec.rounds_real);
    if (rec.tempo_real) setTempoReal(rec.tempo_real);
    if (rec.tempo_descanso) setTempoDescanso(rec.tempo_descanso);
    if (rec.atleta) setAtleta(rec.atleta);
    if (rec.movimentos) setLousa(rec.movimentos);
    if (rec.timeline) setTimelineState(rec.timeline);
    
    // AQUI ESTÁ A MÁGICA DA MEMÓRIA:
    setCurrentWodId(rec.id);
    setCurrentShortCode(rec.short_code);
    
    setActiveTab('prescricao');
  };

  const processarWOD = () => {
    const rawTempoAlvo = parseClockTime(tempoAlvo);
    const tAlvoSec = rawTempoAlvo > 0 ? rawTempoAlvo : 0;
    const rawTempoReal = parseClockTime(tempoReal);
    const tRealSec = rawTempoReal > 0 ? rawTempoReal : 0;

    const ffm = atleta.peso * (1.0 - (atleta.bf / 100.0));
    const bmrDia = 370.0 + (21.6 * ffm);
    const bmrSec = bmrDia / 86400.0;

    let trabalhoMechTotalEsp = 0;
    lousa.forEach(m => {
      const cfg = movimentosDB[m.movId];
      if (!cfg) return;
      const mult = (m.phase === 'round') ? roundsPrescritos : 1;
      trabalhoMechTotalEsp += calcularFisica(m.movId, cfg, m.reps, m.carga, m.extraVal, atleta, m.tecnica, 0).trabMech * mult;
    });

    let roundsTimeline = (tipoTreino === 'FOR_TIME') ? roundsPrescritos : Math.ceil(roundsReal);
    if (roundsTimeline < 1) roundsTimeline = 1;

    const flatItems: any[] = [];
    lousa.filter(m => m.phase === 'buyin').forEach(m => flatItems.push({ rowId: `${m.originalId}-R0`, movId: m.movId, reps: m.reps, carga: m.carga, extraVal: m.extraVal, phase: 'buyin', tecnica: m.tecnica, badgeText: 'Buy-in', badgeClass: 'badge-buyin' }));
    for (let r = 1; r <= roundsTimeline; r++) lousa.filter(m => m.phase === 'round').forEach(m => flatItems.push({ rowId: `${m.originalId}-R${r}`, movId: m.movId, reps: m.reps, carga: m.carga, extraVal: m.extraVal, phase: 'round', tecnica: m.tecnica, badgeText: `R ${r}`, badgeClass: '' }));
    lousa.filter(m => m.phase === 'cashout').forEach(m => flatItems.push({ rowId: `${m.originalId}-R99`, movId: m.movId, reps: m.reps, carga: m.carga, extraVal: m.extraVal, phase: 'cashout', tecnica: m.tecnica, badgeText: 'Cash-out', badgeClass: 'badge-cashout' }));

    let somaTempoDeterminadoGlobal = 0, totalTransicaoGlobal = 0, trabalhoMechTotalReal = 0, gastoMetabolicoLiquidoTotal = 0, metabolicoRestanteGlobal = 0, lastEndSec = -1;
    const itemsProcessados: any[] = [];

    flatItems.forEach(row => {
      const config = movimentosDB[row.movId];
      const state = timelineState[row.rowId] || { reps: row.reps, start: '', end: '' };
      const repsEffective = state.reps !== undefined ? Number(state.reps) : row.reps;
      const startSec = parseClockTime(state.start);
      const endSec = parseClockTime(state.end);
      const tempoDefinitivoTemp = (startSec >= 0 && endSec > startSec) ? (endSec - startSec) : 0;
      
      const calc = calcularFisica(row.movId, config, repsEffective, row.carga, row.extraVal, atleta, row.tecnica, tempoDefinitivoTemp);

      let transicaoEspecifica = 0;
      if (tempoDefinitivoTemp > 0) {
        if (lastEndSec >= 0 && startSec >= lastEndSec) { transicaoEspecifica = startSec - lastEndSec; totalTransicaoGlobal += transicaoEspecifica; }
        lastEndSec = endSec; somaTempoDeterminadoGlobal += tempoDefinitivoTemp; gastoMetabolicoLiquidoTotal += calc.trabMetabolicoWork;
      } else { lastEndSec = -1; metabolicoRestanteGlobal += calc.trabMetabolicoConcIsom; }
      
      trabalhoMechTotalReal += calc.trabMech;
      itemsProcessados.push({ ...calc, nome: config.nome, reps: repsEffective, labelRounds: row.badgeText, tempoDefinitivo: tempoDefinitivoTemp, transicaoEspecifica, phase: row.phase });
    });

    const tempoTotalReferencia = (tipoTreino === 'FOR_TIME' && tRealSec > 0) ? tRealSec : tAlvoSec;
    const tempoDisponivel = Math.max(0, tempoTotalReferencia - somaTempoDeterminadoGlobal - totalTransicaoGlobal - tempoDescanso);
    
    let logDetalhes = "", lastPhase: string | null = null;
    const fatorEPOC = 1.15;
    let tempoTotalExecucaoEfetiva = 0;

    itemsProcessados.forEach(item => {
      if (item.phase !== lastPhase) {
        if (item.phase === 'buyin') logDetalhes += `<div style="margin-top:15px; padding:5px 10px; background:#2a2a2a; border-left:3px solid #f39c12;"><strong>▶ BUY-IN</strong></div>`;
        else if (item.phase === 'round') logDetalhes += `<div style="margin-top:15px; padding:5px 10px; background:#2a2a2a; border-left:3px solid var(--accent);"><strong>🔄 WOD PRINCIPAL</strong></div>`;
        else if (item.phase === 'cashout') logDetalhes += `<div style="margin-top:15px; padding:5px 10px; background:#2a2a2a; border-left:3px solid #2196f3;"><strong>⏹ CASH-OUT</strong></div>`;
        lastPhase = item.phase;
      }
      let tempoParaPotencia = item.tempoDefinitivo; 
      if (item.transicaoEspecifica > 0) logDetalhes += `<span class="color-transition">&nbsp;&nbsp;↳ 🚶 Transição: ${item.transicaoEspecifica.toFixed(0)}s</span><br/>`;
      if (tempoParaPotencia === 0) {
        if (metabolicoRestanteGlobal > 0 && tempoDisponivel > 0) tempoParaPotencia = (item.trabMetabolicoConcIsom / metabolicoRestanteGlobal) * tempoDisponivel; 
        else if (item.isErgo) tempoParaPotencia = item.ergTime;
        gastoMetabolicoLiquidoTotal += item.trabMetabolicoWork;
      }
      tempoTotalExecucaoEfetiva += tempoParaPotencia;

      const gastoBasalLinha = item.isCalorieErgo ? 0 : (bmrSec * tempoParaPotencia);
      const totalKcalLinha = (item.trabMetabolicoWork * fatorEPOC) + gastoBasalLinha;
      let strPot = "", strTmp = "";
      if (tempoParaPotencia > 0) {
        strTmp = ` | 🕒 ${tempoParaPotencia.toFixed(0)}s`; 
        strPot = ` | <strong class="color-time">⚡ ${(item.trabMechLinha / tempoParaPotencia).toFixed(1)} W</strong>`;
      }
      logDetalhes += `• [${item.labelRounds}] ${item.reps}x ${item.nome}${item.infoExtraLog}: <strong class="color-mech">${item.trabMechLinha.toFixed(0)} J</strong> | <strong class="color-metabolic">${totalKcalLinha.toFixed(1)} kCal</strong>${strTmp}${strPot}<br/>`;
    });

    const tempoLiquidoEsp = tAlvoSec - tempoDescanso - totalTransicaoGlobal;
    const potEsp = tempoLiquidoEsp > 0 ? (trabalhoMechTotalEsp / tempoLiquidoEsp) : 0;
    const tempoLiquidoReal = (tempoTotalReferencia > 0 ? tempoTotalReferencia : tempoTotalExecucaoEfetiva) - tempoDescanso - totalTransicaoGlobal;
    const potReal = tempoLiquidoReal > 0 ? (trabalhoMechTotalReal / tempoLiquidoReal) : 0;
    const gastoBasalSessao = bmrSec * (tempoTotalReferencia > 0 ? tempoTotalReferencia : (tempoTotalExecucaoEfetiva + totalTransicaoGlobal + tempoDescanso));
    const gastoMetabolicoFinal = (gastoMetabolicoLiquidoTotal * fatorEPOC) + gastoBasalSessao;

    setResultado({ trabalhoReal: trabalhoMechTotalReal, gastoMetabolico: gastoMetabolicoFinal, potenciaEsp: potEsp, potenciaReal: potReal, logDetalhesHTML: logDetalhes });
  };

  // === RENDER: CARREGAMENTO ===
  if (loadingAuth) return <div style={{textAlign: 'center', marginTop: '50px'}}>Iniciando...</div>;

  // === RENDER: TELA DE LOGIN ===
  if (!session) {
    return (
      <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <div className="panel" style={{ textAlign: 'center', maxWidth: '400px', width: '100%', padding: '40px 20px' }}>
          <h1 style={{ border: 'none', marginBottom: '10px' }}>
            <img 
            src="/dynawod-texto.png"
            alt="DynaWOD Tipografia" 
            style={{ height: '48px', objectFit: 'contain' }}
            />
          </h1>
          <p style={{ color: '#aaa', marginBottom: '30px' }}>Seu motor biomecânico. Calcule potência e gasto metabólico real.</p>
          <button onClick={signInWithGoogle} style={{ backgroundColor: '#fff', color: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '1rem', padding: '10px', width: '100%', borderRadius: '5px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
            <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/><path fill="none" d="M1 1h22v22H1z"/></svg>
            Entrar com Conta Google
          </button>
        </div>
      </div>
    );
  }

  // === RENDER: TELA DE ONBOARDING ===
  if (isNewUser) {
    return (
      <div className="container" style={{ maxWidth: '600px' }}>
        <div className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h2 style={{ margin: 0 }}>Bem-vindo ao DynaWOD!</h2>
            <button onClick={signOut} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: 'auto', backgroundColor: '#333', padding: '5px 10px', fontSize: '0.85rem' }}>Sair</button>
          </div>
          <p style={{ color: '#aaa' }}>Complete seu perfil biomecânico para calibrarmos o motor para o seu corpo.</p>
          
          <div className="form-group" style={{ marginTop: '20px' }}>
            <label>Seu Nome Completo</label>
            <input type="text" value={onboardForm.full_name} onChange={e => setOnboardForm({...onboardForm, full_name: e.target.value})} />
          </div>
          <div className="form-group">
            <label>Como quer ser chamado?</label>
            <input type="text" value={onboardForm.apelido} onChange={e => setOnboardForm({...onboardForm, apelido: e.target.value})} placeholder="Ex: Gui" />
          </div>

          <div style={{ background: '#222', padding: '15px', borderRadius: '8px', margin: '20px 0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.1rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={onboardForm.is_coach} onChange={e => setOnboardForm({...onboardForm, is_coach: e.target.checked})} style={{ width: '20px', height: '20px' }} />
              <strong>Eu sou um Coach</strong> (Quero prescrever para alunos)
            </label>
          </div>

          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="form-group"><label>Estatura (m)</label><input type="number" step="0.01" value={onboardForm.estatura} onChange={e => setOnboardForm({...onboardForm, estatura: Number(e.target.value)})} /></div>
            <div className="form-group"><label>Peso (kg)</label><input type="number" step="0.1" value={onboardForm.peso} onChange={e => setOnboardForm({...onboardForm, peso: Number(e.target.value)})} /></div>
            <div className="form-group"><label>Sexo Biológico</label><select value={onboardForm.sexo} onChange={e => setOnboardForm({...onboardForm, sexo: e.target.value as 'M'|'F'})}><option value="M">Masculino</option><option value="F">Feminino</option></select></div>
            <div className="form-group"><label>Nível</label><select value={onboardForm.nivel_tecnico} onChange={e => setOnboardForm({...onboardForm, nivel_tecnico: e.target.value})}><option value="iniciante">Iniciante</option><option value="intermediario">Intermediário</option><option value="avancado">Avançado</option></select></div>
            <div className="form-group"><label>Envergadura (m)</label><input type="number" step="0.01" value={onboardForm.envergadura} onChange={e => setOnboardForm({...onboardForm, envergadura: Number(e.target.value)})} /></div>
            <div className="form-group"><label>Alt. Perna (m)</label><input type="number" step="0.01" value={onboardForm.perna} onChange={e => setOnboardForm({...onboardForm, perna: Number(e.target.value)})} /></div>
            <div className="form-group"><label>% BF</label><input type="number" value={onboardForm.bf} onChange={e => setOnboardForm({...onboardForm, bf: Number(e.target.value)})} /></div>
          </div>

          <button onClick={saveOnboardingProfile} style={{ marginTop: '20px', width: '100%', fontSize: '1.2rem', padding: '15px' }}>Salvar Perfil e Entrar</button>
        </div>
      </div>
    );
  }

  // === RENDER: APLICAÇÃO PRINCIPAL ===
  return (
    <div className="container" style={{ padding: 0, maxWidth: '1200px', margin: '0 auto' }}> 
      
      {/* NOVO CABEÇALHO DYNAWOD */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', backgroundColor: 'var(--bg-dark, #0a0a0a)', borderBottom: '1px solid var(--line-silver, #26272b)', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          
          {/* O símbolo da Mitocôndria (que você já tinha) */}
          <img 
            src="/favicon.png" 
            alt="Símbolo DynaWOD" 
            style={{ height: '40px', objectFit: 'contain' }} 
          />
          
          {/* A escrita oficial em Imagem (Substituindo o texto antigo) */}
          <img 
            src="/dynawod-texto.png"
            alt="DynaWOD Tipografia" 
            style={{ height: '28px', objectFit: 'contain' }} /* Ajuste o 28px se precisar dela maior ou menor */
          />
          
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-muted, #8a8d94)', fontWeight: 600 }}>
            Olá, <span style={{ color: '#fff' }}>{userProfile?.is_coach ? <Trophy size={"1.2em"} color="var(--dyna-red)" /> : <Dumbbell size={"1.2em"} color="var(--line-silver)" />} {userProfile?.apelido || userProfile?.full_name}</span>
          </div>
          {userProfile?.is_coach && (
            <select value={selectedAthleteId} onChange={e => handleAthleteChange(e.target.value)} style={{ background: 'var(--bg-card, #181a1e)', border: '1px solid var(--line-silver, #26272b)', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}>
              <option value="me">Meu Desempenho</option>
              <optgroup label="Meus Alunos">{myAthletes.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}</optgroup>
            </select>
          )}
          <button onClick={signOut} style={{ width: 'auto', backgroundColor: 'var(--dyna-burgundy, #7A0F1B)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 'bold' }}><LogOut size={"1.2em"} /> Sair</button>
        </div>
      </header>

      <div style={{ padding: '0 24px' }}>
        
        {/* NAVEGAÇÃO DE ABAS ATUALIZADA */}
        <div className="tabs">
          <button className={`tab-btn ${activeTab === 'prescricao' ? 'active' : ''}`} onClick={() => setActiveTab('prescricao')}>1. Lousa</button>
          <button className={`tab-btn ${activeTab === 'analise' ? 'active' : ''}`} onClick={() => setActiveTab('analise')}>2. Análise</button>
          <button className={`tab-btn ${activeTab === 'atleta' ? 'active' : ''}`} onClick={() => setActiveTab('atleta')}>3. Atleta</button>
          <button className={`tab-btn ${activeTab === 'historico' ? 'active' : ''}`} onClick={() => setActiveTab('historico')}>4. Histórico</button>
        </div>

        {/* ABA 1: LOUSA (Agora contém o Domínio de Tempo) */}
        {activeTab === 'prescricao' && (
          <div className="panel">
            
            {/* DOMÍNIO DE TEMPO */}
            <h2>Estrutura do Treino</h2>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginBottom: '10px', gap: '15px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Modalidade</label>
                <select value={tipoTreino} onChange={e => setTipoTreino(e.target.value as Modalidade)}>
                  <option value="FOR_TIME">For Time</option>
                  <option value="AMRAP">AMRAP</option>
                  <option value="EMOM">EMOM</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>{tipoTreino === 'FOR_TIME' ? 'Time Cap (mm:ss)' : 'Tempo Total'}</label>
                <input type="text" value={tempoAlvo} onChange={e => setTempoAlvo(e.target.value)} placeholder="Ex: 10:00" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Rounds Prescritos</label>
                <input type="number" value={roundsPrescritos} onChange={e => setRoundsPrescritos(Number(e.target.value))} />
              </div>
            </div>

            <hr style={{ borderColor: 'var(--line-silver, #26272b)', margin: '25px 0' }} />

            {/* QUADRO DE MOVIMENTOS */}
            <h2>Quadro de Movimentos</h2>
            <button className="btn-add" onClick={() => addMovimento()} style={{ backgroundColor: 'transparent', color: 'var(--dyna-red, #FF2B3D)', border: '1px dashed var(--dyna-red, #FF2B3D)', padding: '10px 15px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', width: '100%', marginBottom: '15px' }}>+ Adicionar Exercício</button>
            
            <div className="wod-list">
              {lousa.map((item) => {
                const cfg = movimentosDB[item.movId] || movimentosDB['pushup'];
                return (
                  <div key={item.originalId} className="wod-item">
                    <div>
                      <label>Fase</label>
                      <select value={item.phase} onChange={e => updateMovimento(item.originalId, 'phase', e.target.value)}>
                        <option value="buyin">Buy-in</option>
                        <option value="round">WOD</option>
                        <option value="cashout">Cash-out</option>
                      </select>
                      <div style={{ marginTop: '5px' }}>
                        <select value={item.movId} onChange={e => updateMovimento(item.originalId, 'movId', e.target.value)}>
                          {Object.entries(movimentosDB).map(([k, v]) => (<option key={k} value={k}>{v.nome}</option>))}
                        </select>
                      </div>
                    </div>
                    <div><label>Reps/Mts</label><input type="number" value={item.reps} onChange={e => updateMovimento(item.originalId, 'reps', Number(e.target.value))} /></div>
                    <div>
                      <label>Carga/Téc.</label>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <input type="number" disabled={!cfg.usaCarga} value={item.carga} onChange={e => updateMovimento(item.originalId, 'carga', Number(e.target.value))} />
                        <select value={item.tecnica} onChange={e => updateMovimento(item.originalId, 'tecnica', e.target.value)}><option value="tng">T&G</option><option value="drop">Drop</option></select>
                      </div>
                    </div>
                    <div><label>{cfg.paramExtra ? cfg.paramExtra.label : 'Param.'}</label><input type="text" disabled={!cfg.paramExtra} value={item.extraVal} onChange={e => updateMovimento(item.originalId, 'extraVal', e.target.value)} /></div>
                    <div className="actions-col">
                      <button className="btn-action" onClick={() => addMovimento(item.originalId)} title="Duplicar">
                        <Copy size={"1.2em"} color="var(--line-silver)" />
                      </button>
                      <button className="btn-remove" onClick={() => removeMovimento(item.originalId)}><X size={"1.2em"} /></button>
                    </div>
                  </div>
                );
              })}
            </div>

            <hr style={{ borderColor: 'var(--line-silver, #26272b)', margin: '25px 0' }} />
            
            <h2>Gerenciar WOD</h2>
            {currentShortCode && (
              <p style={{ color: 'var(--text-muted, #8a8d94)', fontSize: '0.9rem', marginBottom: '15px' }}>
                Código deste treino: <strong style={{ color: '#fff', letterSpacing: '2px' }}>{currentShortCode}</strong>
              </p>
            )}
            
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={importarWod} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-card, #181a1e)', color: '#fff', border: '1px solid var(--line-silver, #26272b)' }}>
                  <Download size={"1.2em"} /> Importar via Código
                </button>
                <button onClick={compartilharWod} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--dyna-burgundy, #7A0F1B)', color: '#fff', border: 'none', fontWeight: '600' }}>
                  <Share2 size={"1.2em"} /> Copiar Código
                </button>
                <button onClick={() => salvarNoSupabase(false)} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--dyna-red, #FF2B3D)', color: '#fff', border: 'none', fontWeight: 'bold' }}>
                  <Save size={"1.2em"} /> {currentWodId ? 'Atualizar WOD' : 'Salvar Novo WOD'}
                </button>
              </div>
          </div>
        )}

        {/* ABA 2: ANÁLISE (Agora com o Score de destaque no topo) */}
        {activeTab === 'analise' && (
          <div className="panel">
            
            {/* NOVO BLOCO DE SCORE */}
            <div style={{ backgroundColor: 'var(--bg-card, #181a1e)', padding: '20px', borderRadius: '8px', borderLeft: '4px solid var(--dyna-red, #FF2B3D)', marginBottom: '25px' }}>
              <h2 style={{ margin: '0 0 10px 0', fontSize: '1.2rem' }}>Score (Resultado Real)</h2>
              <p style={{ margin: '0 0 15px 0', fontSize: '0.85rem', color: 'var(--text-muted, #8a8d94)' }}>Insira o resultado alcançado para calcular a potência gerada.</p>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>{tipoTreino === 'FOR_TIME' ? 'Tempo Real Efetivado (mm:ss)' : 'Rounds Reais Completados'}</label>
                {tipoTreino === 'FOR_TIME' ? (
                  <input type="text" value={tempoReal} onChange={e => setTempoReal(e.target.value)} placeholder="Ex: 12:30" style={{ maxWidth: '250px', fontSize: '1.1rem' }} />
                ) : (
                  <input type="number" step="0.1" value={roundsReal} onChange={e => setRoundsReal(Number(e.target.value))} style={{ maxWidth: '250px', fontSize: '1.1rem' }} />
                )}
              </div>
            </div>

            <h2>Timeline Expandida</h2>
            <div className="wod-list">
              {(() => {
                let rTimeline = (tipoTreino === 'FOR_TIME') ? roundsPrescritos : Math.ceil(roundsReal);
                if (rTimeline < 1) rTimeline = 1;
                const rows: any[] = [];
                const renderRow = (m: ItemLousa, badgeClass: string, badgeText: string, rIdx: number) => {
                  const rowId = `${m.originalId}-R${rIdx}`;
                  const cfg = movimentosDB[m.movId];
                  const st = timelineState[rowId] || { reps: m.reps, start: '', end: '' };
                  rows.push(
                    <div key={rowId} className="wod-item-analise">
                      <div className={`badge-round ${badgeClass}`}>{badgeText}</div>
                      <div><div style={{ fontWeight: 'bold' }}>{cfg ? cfg.nome : m.movId}</div><div style={{ fontSize: '0.75rem', color: '#aaa' }}>{m.carga > 0 ? `${m.carga}kg (${m.tecnica})` : ''} {m.extraVal ? `| ${m.extraVal}` : ''}</div></div>
                      <div><label>Reps</label><input type="number" value={st.reps} onChange={e => handleTimelineChange(rowId, 'reps', Number(e.target.value))} /></div>
                      <div><label>Início</label><input type="text" placeholder="mm:ss" value={st.start} onChange={e => handleTimelineChange(rowId, 'start', e.target.value)} /></div>
                      <div><label>Fim</label><input type="text" placeholder="mm:ss" value={st.end} onChange={e => handleTimelineChange(rowId, 'end', e.target.value)} /></div>
                    </div>
                  );
                };
                lousa.filter(m => m.phase === 'buyin').forEach(m => renderRow(m, 'badge-buyin', 'Buy-in', 0));
                for (let r = 1; r <= rTimeline; r++) lousa.filter(m => m.phase === 'round').forEach(m => renderRow(m, '', `R ${r}`, r));
                lousa.filter(m => m.phase === 'cashout').forEach(m => renderRow(m, 'badge-cashout', 'Cash-out', 99));
                return rows;
              })()}
            </div>

            <button onClick={processarWOD} style={{ fontSize: '1.1rem', padding: '15px', backgroundColor: 'var(--dyna-red, #FF2B3D)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', width: '100%', cursor: 'pointer', marginBottom: '20px', marginTop: '10px' }}>
              ⚡ Processar Dinâmica e Termodinâmica
            </button>

            {resultado && (
              <div className="results">
                <h2>Painel de Resultado Biomecânico</h2>
                <div className="grid" style={{ marginBottom: 0 }}>
                  <div style={{ margin: '15px 0' }}><div className="result-value color-mech">{resultado.trabalhoReal.toFixed(0)} J</div><div>Trabalho Mecânico</div></div>
                  <div style={{ margin: '15px 0' }}><div className="result-value color-metabolic">{resultado.gastoMetabolico.toFixed(0)} kCal</div><div>Gasto Termodinâmico (+ EPOC)</div></div>
                  <div style={{ margin: '15px 0' }}><div className="result-value" style={{ color: '#aaa' }}>{resultado.potenciaEsp > 0 ? resultado.potenciaEsp.toFixed(1) + ' W' : '-- W'}</div><div>Potência Esperada</div></div>
                  <div style={{ margin: '15px 0' }}><div className="result-value" style={{ color: '#4caf50' }}>{resultado.potenciaReal > 0 ? resultado.potenciaReal.toFixed(1) + ' W' : '-- W'}</div><div>Potência Real Executada</div></div>
                </div>
                <div className="result-detail" dangerouslySetInnerHTML={{ __html: resultado.logDetalhesHTML }} />
              </div>
            )}
          </div>
        )}

        {/* ABA 3: ATLETA (Nova aba dedicada) */}
        {activeTab === 'atleta' && (
          <div className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h2 style={{ margin: 0 }}>Perfil do Atleta</h2>
              {selectedAthleteId !== 'me' && <span style={{ background: '#ff9800', color: '#000', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>Visualizando Aluno</span>}
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted, #8a8d94)', marginBottom: '20px' }}>
              Os dados base são carregados automaticamente do perfil selecionado. Você pode ajustá-los pontualmente para este cálculo sem afetar o cadastro oficial.
            </p>
            
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: '15px' }}>
              <div className="form-group"><label>Estatura (m)</label><input type="number" step="0.01" value={atleta.estatura} onChange={e => setAtleta({ ...atleta, estatura: Number(e.target.value) })} /></div>
              <div className="form-group"><label>Massa (kg)</label><input type="number" step="0.1" value={atleta.peso} onChange={e => setAtleta({ ...atleta, peso: Number(e.target.value) })} /></div>
            </div>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: '15px' }}>
              <div className="form-group"><label>Sexo Biológico</label><select value={atleta.sexo} onChange={e => setAtleta({ ...atleta, sexo: e.target.value as 'M' | 'F' })}><option value="M">Masculino</option><option value="F">Feminino</option></select></div>
              <div className="form-group"><label>Nível Técnico</label><select value={atleta.nivelTecnico} onChange={e => setAtleta({ ...atleta, nivelTecnico: e.target.value as any })}><option value="iniciante">Iniciante</option><option value="intermediario">Intermediário</option><option value="avancado">Avançado</option></select></div>
            </div>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: '15px' }}>
              <div className="form-group"><label>Envergadura (m)</label><input type="number" step="0.01" value={atleta.envergadura} onChange={e => setAtleta({ ...atleta, envergadura: Number(e.target.value) })} /></div>
              <div className="form-group"><label>Alt. Perna (m)</label><input type="number" step="0.01" value={atleta.perna} onChange={e => setAtleta({ ...atleta, perna: Number(e.target.value) })} /></div>
            </div>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 0 }}>
              <div className="form-group"><label>% Gordura Corporal (BF)</label><input type="number" step="0.1" value={atleta.bf} onChange={e => setAtleta({ ...atleta, bf: Number(e.target.value) })} /></div>
              <div className="form-group"><label>Transição Global Estimada (seg)</label><input type="number" value={tempoDescanso} onChange={e => setTempoDescanso(Number(e.target.value))} /></div>
            </div>
          </div>
        )}

        {/* ABA 4: HISTÓRICO */}
        {activeTab === 'historico' && (
          <div className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Histórico de Desempenho {selectedAthleteId !== 'me' ? '(Aluno)' : ''}</h2>
              {selectedAthleteId === 'me' && !userProfile?.is_coach && (
                <div style={{ display: 'flex', gap: '5px' }}>
                  <input type="text" placeholder="ID do seu Coach..." value={coachIdInput} onChange={e => setCoachIdInput(e.target.value)} style={{ padding: '8px' }} />
                  <button onClick={linkToCoach} style={{ width: 'auto', padding: '8px 15px', backgroundColor: '#388e3c' }}>Vincular</button>
                </div>
              )}
            </div>

            {selectedAthleteId === 'me' && (
              <div style={{ marginBottom: '20px', padding: '10px', background: 'var(--bg-card, #181a1e)', border: '1px dashed var(--line-silver, #26272b)', borderRadius: '4px', fontSize: '0.9rem' }}>
                <strong>Seu ID de Atleta (Passe para o seu Coach):</strong> <span style={{ color: '#4caf50', userSelect: 'all' }}>{session.user.id}</span>
              </div>
            )}
            
            {savedWods.length > 0 ? (
              <>
                <div style={{ width: '100%', height: 300, marginBottom: '40px', backgroundColor: 'var(--bg-card, #181a1e)', padding: '20px', borderRadius: '8px' }}>
                  <ResponsiveContainer>
                    <LineChart data={[...savedWods].reverse()} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                      <XAxis dataKey="created_at" tickFormatter={(tick) => new Date(tick as string).toLocaleDateString('pt-BR')} stroke="#aaa" />
                      <YAxis yAxisId="left" stroke="#4caf50" />
                      <YAxis yAxisId="right" orientation="right" stroke="#ff9800" />
                      <Tooltip labelFormatter={(label) => new Date(label as string).toLocaleDateString('pt-BR')} contentStyle={{ backgroundColor: '#1e1e1e', border: 'none' }} />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="score_watts" name="Potência (Watts)" stroke="#4caf50" strokeWidth={3} activeDot={{ r: 8 }} />
                      <Line yAxisId="right" type="monotone" dataKey="score_kcal" name="Gasto (kCal)" stroke="#ff9800" strokeWidth={3} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
                  {savedWods.map(w => (
                    <div key={w.id} style={{ background: 'var(--bg-card, #181a1e)', padding: '20px', borderRadius: '8px', borderLeft: '4px solid var(--dyna-burgundy, #7A0F1B)' }}>
                      <h3 style={{ margin: '0 0 10px 0', fontSize: '1.2rem' }}>{w.title}</h3>
                      <div style={{ fontSize: '0.9rem', color: 'var(--text-muted, #8a8d94)', marginBottom: '15px' }}>
                        <strong>Data:</strong> {new Date(w.created_at || '').toLocaleDateString('pt-BR')}<br />
                        <strong>Resultado:</strong> {(w as any).score_watts?.toFixed(1) || '--'} W | {(w as any).score_kcal?.toFixed(0) || '--'} kCal
                      </div>
                      <button onClick={() => carregarDoSupabase(w)} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--line-silver, #26272b)', color: '#fff', border: '1px solid #444', borderRadius: '4px', cursor: 'pointer' }}>Carregar Treino</button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p style={{ color: 'var(--text-muted, #8a8d94)', textAlign: 'center', padding: '20px' }}>Nenhum treino salvo para este atleta.</p>
            )}
          </div>
        )}
      
      </div> 
      {/* FECHAMENTO DA DIV DE PADDING */}
      
    </div>
  );
}