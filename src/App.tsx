import { useState, useEffect, useRef } from 'react';
import { movimentosDB } from './data/movements';
import { supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js'; 
import type { 
  AtletaPerfil, ItemLousa, Modalidade, 
  ResultadoProcessamento, TimelineStateItem, UserProfile,
  WodTemplateRecord 
} from './types';
import { calcularFisica, parseClockTime } from './utils/physicsEngine';
import html2canvas from 'html2canvas';

import { LoginScreen } from './components/auth/LoginScreen';
import { OnboardingScreen } from './components/auth/OnboardingScreen';
import { Header } from './components/layout/Header';
import { Tabs } from './components/layout/Tabs';
import { PrescricaoTab } from './components/tabs/PrescricaoTab';
import { AnaliseTab } from './components/tabs/AnaliseTab';
import { AtletaTab } from './components/tabs/AtletaTab';
import { HistoricoTab } from './components/tabs/HistoricoTab';
import { InstagramCard } from './components/export/InstagramCard';

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
  const [nomeTreino, setNomeTreino] = useState('');

  // === RASTREAMENTO DO WOD ATUAL ===
  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(null);
  const [currentResultId, setCurrentResultId] = useState<string | null>(null);
  const [isScaled, setIsScaled] = useState<boolean>(false);
  const [currentShortCode, setCurrentShortCode] = useState<string | null>(null);

  const [atleta, setAtleta] = useState<AtletaPerfil>({
    estatura: 1.75, peso: 80, sexo: 'M', nivelTecnico: 'intermediario', envergadura: 1.75, perna: 0.85, bf: 15
  });

  const [lousa, setLousa] = useState<ItemLousa[]>([
    { originalId: crypto.randomUUID(), movId: 'thruster', phase: 'round', reps: 21, carga: 43, tecnica: 'tng', extraVal: '' }
  ]);
  const [timelineState, setTimelineState] = useState<Record<string, TimelineStateItem>>({});
  
  const [resultado, setResultado] = useState<ResultadoProcessamento | null>(null);
  const [savedWods, setSavedWods] = useState<WodTemplateRecord[]>([]);

  const [onboardForm, setOnboardForm] = useState({
    full_name: '', apelido: '', is_coach: false, estatura: 1.75, peso: 80, sexo: 'M', 
    nivel_tecnico: 'intermediario', envergadura: 1.75, perna: 0.85, bf: 15, data_nascimento: ''
  });

  // === REFERÊNCIAS E FUNÇÕES DO DRAG AND DROP ===
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const handleDragStart = (index: number) => {
    dragItem.current = index;
  };

  const handleDragEnter = (index: number) => {
    dragOverItem.current = index;
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.style.opacity = '1';
    
    if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
      const newLousa = [...lousa];
      const draggedItemContent = newLousa[dragItem.current];
      // Remove o item da posição original
      newLousa.splice(dragItem.current, 1);
      // Insere o item na nova posição
      newLousa.splice(dragOverItem.current, 0, draggedItemContent);
      setLousa(newLousa);
    }
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const gerarCardInstagram = async () => {
    const cardElement = document.getElementById('instagram-card-export');
    
    if (!cardElement) {
      alert('Erro: Card não encontrado na tela.');
      return;
    }

    try {
      const canvas = await html2canvas(cardElement, {
        backgroundColor: '#111315', 
        scale: 2, 
        useCORS: true 
      });

      const image = canvas.toDataURL('image/jpeg', 0.9);
      const link = document.createElement('a');
      link.href = image;
      link.download = `DynaWOD-${currentShortCode || 'Resultado'}.jpg`;
      link.click();
      
    } catch (error) {
      console.error('Erro ao gerar imagem:', error);
      alert('Ops! Não foi possível gerar a imagem.');
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      // Aqui passamos o session.user inteiro em vez de session.user.id
      if (session) loadProfile(session.user);
      else setLoadingAuth(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      // Aqui passamos o session.user inteiro
      if (session) loadProfile(session.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session && userProfile && !isNewUser) fetchWodsFromSupabase();
  }, [session, userProfile, isNewUser, selectedAthleteId]);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUserProfile(null);
    setSavedWods([]);
  };

  // Função loadProfile atualizada na íntegra para receber o objeto user
  const loadProfile = async (user: any) => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    
    if (error || !data) {
      setIsNewUser(true); 
      // Puxa o nome do Google (user_metadata) automaticamente para o state onboardForm
      setOnboardForm(prev => ({ 
        ...prev, 
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || '' 
      }));
      setLoadingAuth(false);
      return;
    }

    setUserProfile(data as UserProfile);
    syncAtletaState(data);
    
    if (data.is_coach) {
      const { data: athletes } = await supabase.from('profiles').select('*').eq('coach_id', user.id);
      if (athletes) setMyAthletes(athletes as UserProfile[]);
    }
    
    setIsNewUser(false);
    setLoadingAuth(false);
  };

  const syncAtletaState = (prof: any) => {
    setAtleta({
      estatura: prof.estatura, peso: prof.peso, sexo: prof.sexo,
      nivelTecnico: prof.nivel_tecnico, envergadura: prof.envergadura,
      perna: prof.perna, bf: prof.bf, dataNascimento: prof.data_nascimento
    });
  };

  const saveOnboardingProfile = async () => {
    if (!session) return;

    // Trava de obrigatoriedade
    if (!onboardForm.full_name || !onboardForm.data_nascimento) {
      alert('⚠️ Por favor, preencha seu Nome Completo e a Data de Nascimento. O motor precisa da sua idade exata para calibrar o desgaste metabólico.');
      return;
    }

    const payload = {
      id: session.user.id,
      ...onboardForm
    };
    
    const { error } = await supabase.from('profiles').insert([payload]);
    if (error) {
      alert('Erro ao salvar perfil: ' + error.message);
    } else {
      loadProfile(session.user); // Usa o user inteiro, como ajustamos na etapa anterior
    }
  };

  const linkToCoach = async () => {
    if (!session || !coachIdInput) return;
    const { error } = await supabase.from('profiles').update({ coach_id: coachIdInput }).eq('id', session.user.id);
    if (error) alert('Erro ao vincular coach. Verifique o ID.');
    else { alert('Coach vinculado com sucesso!'); loadProfile(session.user); }
  };

  const salvarPerfilAtleta = async () => {
    if (!session) return;
    
    // Define se estamos atualizando o próprio usuário ou um aluno dele
    const targetId = selectedAthleteId === 'me' ? session.user.id : selectedAthleteId;

    const payload = {
      estatura: atleta.estatura,
      peso: atleta.peso,
      sexo: atleta.sexo,
      nivel_tecnico: atleta.nivelTecnico,
      envergadura: atleta.envergadura,
      perna: atleta.perna,
      bf: atleta.bf,
      data_nascimento: atleta.dataNascimento
    };

    const { error } = await supabase.from('profiles').update(payload).eq('id', targetId);

    if (error) {
      alert('Erro ao atualizar perfil oficial: ' + error.message);
    } else {
      alert('Perfil oficial atualizado com sucesso no banco de dados!');
      
      // Recarrega os dados para manter a interface sincronizada
      if (targetId === session.user.id) {
        loadProfile(session.user.id);
      } else {
        // Se for um coach editando o aluno, recarrega a lista de alunos
        supabase.from('profiles').select('*').eq('coach_id', session.user.id)
          .then(({ data }) => {
            if (data) setMyAthletes(data as UserProfile[]);
          });
      }
    }
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

  const fetchWodsFromSupabase = async () => {
    const queryId = selectedAthleteId === 'me' ? session?.user.id : selectedAthleteId;
    
    const { data, error } = await supabase.from('wods').select('*').eq('athlete_id', queryId).order('created_at', { ascending: false });
    if (!error && data) setSavedWods(data as WodTemplateRecord[]);
  };

  const generateShortCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  const salvarNoSupabase = async (isExporting = false) => {
    if (!session || !userProfile) return null;
    
    const targetAthleteId = selectedAthleteId === 'me' ? session.user.id : selectedAthleteId;
    const newShortCode = currentShortCode || generateShortCode();

    const templatePayload = {
      title: nomeTreino.trim() !== '' ? nomeTreino : `Treino ${tipoTreino} - ${new Date().toLocaleDateString('pt-BR')}`,
      short_code: newShortCode,
      tipo_treino: tipoTreino,
      tempo_alvo: tempoAlvo,
      rounds_prescritos: roundsPrescritos,
      movimentos: lousa,
      creator_id: session.user.id
    };

    let activeTemplateId = currentTemplateId;

    if (activeTemplateId) {
      if (!isExporting && !window.confirm('Deseja sobrescrever as alterações na prescrição deste WOD?')) return null;
      
      const { error } = await supabase.from('wod_templates').update(templatePayload).eq('id', activeTemplateId);
      if (error) { alert('Erro ao atualizar Template: ' + error.message); return null; }
    } else {
      const { data, error } = await supabase.from('wod_templates').insert([templatePayload]).select('id, short_code').single();
      if (error) { alert('Erro ao criar Template: ' + error.message); return null; }
      
      activeTemplateId = data.id;
      setCurrentTemplateId(data.id);
      setCurrentShortCode(data.short_code);
    }

    const hasResult = tempoReal || roundsReal > 0 || (resultado && resultado.potenciaReal > 0);

    if (hasResult) {
      const resultPayload = {
        template_id: activeTemplateId, 
        athlete_id: targetAthleteId,
        tempo_real: tempoReal,
        rounds_real: roundsReal,
        score_watts: resultado ? resultado.potenciaReal : 0,
        score_kcal: resultado ? resultado.gastoMetabolico : 0,
        timeline: timelineState,
        cargas_adaptadas: isScaled
      };

      if (currentResultId) {
        const { error } = await supabase.from('wod_results').update(resultPayload).eq('id', currentResultId);
        if (error) console.error('Erro ao atualizar resultado:', error);
      } else {
        const { data, error } = await supabase.from('wod_results').insert([resultPayload]).select('id').single();
        if (error) {
          console.error('Erro ao salvar resultado:', error);
        } else {
          setCurrentResultId(data.id);
        }
      }
    }

    if (!isExporting) alert('Dados salvos com sucesso no DynaWOD!');
    
    return newShortCode;
  };

  const compartilharWod = async () => {
    const code = await salvarNoSupabase(true); 
    if (code) {
      navigator.clipboard.writeText(code);
      alert(`Código do WOD (${code}) copiado para a área de transferência! Envie para seus alunos.`);
    }
  };

  const importarWod = async () => {
    const codeToFind = window.prompt('Digite o código de 6 dígitos do WOD:');
    if (!codeToFind) return;

    const { data, error } = await supabase.from('wod_templates').select('*').eq('short_code', codeToFind.toUpperCase()).single();
    
    if (error || !data) {
      alert('WOD não encontrado. Verifique o código.');
      return;
    }

    carregarDoSupabase(data);
  };

  const clonarWod = () => {
    if (!window.confirm('Deseja usar este treino como base para criar um NOVO WOD seu? O vínculo com o original será quebrado.')) return;
    
    setCurrentTemplateId(null);
    setCurrentShortCode(null);
    setCurrentResultId(null);
    
    alert('Pronto! O WOD foi desvinculado. Faça suas alterações e clique em "Salvar WOD".');
  };

  const addMovimento = (baseId: string | null = null) => {
    const newId = crypto.randomUUID();
    let newItem: ItemLousa = { originalId: newId, movId: 'air_squat', phase: 'round', reps: 10, carga: 0, tecnica: 'tng', extraVal: '', extraVal2: '' };
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
  const handleTimelineChange = (rowId: string, field: keyof TimelineStateItem, val: any) => 
    setTimelineState(prev => ({ ...prev, [rowId]: { ...(prev[rowId] || {}), [field]: val } }));
  const carregarDoSupabase = (rec: any) => {
    setTipoTreino(rec.tipo_treino); 
    setTempoAlvo(rec.tempo_alvo); 
    setRoundsPrescritos(rec.rounds_prescritos);
    
    if (rec.rounds_real !== undefined) setRoundsReal(rec.rounds_real);
    if (rec.tempo_real) setTempoReal(rec.tempo_real);
    if (rec.atleta) setAtleta(rec.atleta);
    if (rec.movimentos) setLousa(rec.movimentos);
    if (rec.timeline) setTimelineState(rec.timeline);
    
    setCurrentTemplateId(rec.id);
    setCurrentShortCode(rec.short_code);
    
    setActiveTab('prescricao');

    if (rec.title && !rec.title.startsWith('Treino')) setNomeTreino(rec.title);
    else setNomeTreino('');
  };

  const processarWOD = () => {
    const rawTempoAlvo = parseClockTime(tempoAlvo);
    const tAlvoSec = rawTempoAlvo > 0 ? rawTempoAlvo : 0;
    const rawTempoReal = parseClockTime(tempoReal);
    const tRealSec = rawTempoReal > 0 ? rawTempoReal : 0;

    const ffm = (atleta?.peso || 80) * (1.0 - ((atleta?.bf || 15) / 100.0));
    const bmrDia = 370.0 + (21.6 * ffm);
    const bmrSec = bmrDia / 86400.0;

    let trabalhoMechTotalEsp = 0;
    lousa.forEach(m => {
      const cfg = movimentosDB[m.movId];
      if (!cfg) return;
      const mult = (m.phase === 'round') ? (roundsPrescritos || 1) : 1;
      const calc = calcularFisica(m.movId, cfg, m.reps, m.carga, m.extraVal, m.extraVal2 || '', atleta, m.tecnica, 0);
      const trab = calc?.trabMech || 0;
      trabalhoMechTotalEsp += trab * mult;
    });

    let roundsTimeline = (tipoTreino === 'FOR_TIME') ? (roundsPrescritos || 1) : Math.ceil(roundsReal || 1);
    if (roundsTimeline < 1) roundsTimeline = 1;

    const flatItems: any[] = [];
    lousa.filter(m => m.phase === 'buyin').forEach(m => flatItems.push({ rowId: `${m.originalId}-R0`, movId: m.movId, reps: m.reps, carga: m.carga, extraVal: m.extraVal, extraVal2: m.extraVal2, phase: 'buyin', tecnica: m.tecnica, badgeText: 'Buy-in', badgeClass: 'badge-buyin' }));
    for (let r = 1; r <= roundsTimeline; r++) lousa.filter(m => m.phase === 'round').forEach(m => flatItems.push({ rowId: `${m.originalId}-R${r}`, movId: m.movId, reps: m.reps, carga: m.carga, extraVal: m.extraVal, extraVal2: m.extraVal2, phase: 'round', tecnica: m.tecnica, badgeText: `R ${r}`, badgeClass: '' }));
    lousa.filter(m => m.phase === 'cashout').forEach(m => flatItems.push({ rowId: `${m.originalId}-R99`, movId: m.movId, reps: m.reps, carga: m.carga, extraVal: m.extraVal, extraVal2: m.extraVal2, phase: 'cashout', tecnica: m.tecnica, badgeText: 'Cash-out', badgeClass: 'badge-cashout' }));

    let somaTempoDeterminadoGlobal = 0, totalTransicaoGlobal = 0, trabalhoMechTotalReal = 0, gastoMetabolicoLiquidoTotal = 0, metabolicoRestanteGlobal = 0, lastEndSec = -1;
    let tempoDecorridoEstimado = 0; // Acumulador da linha do tempo para degradação celular
    
    const itemsProcessados: any[] = [];

    flatItems.forEach(row => {
      const config = movimentosDB[row.movId] || movimentosDB['air_squat']; 
      const state = timelineState[row.rowId] || { reps: row.reps, start: '', end: '' };
      const repsEffective = state.reps !== undefined ? Number(state.reps) : (row.reps || 0);
      
      const cargaEffective = state.carga !== undefined ? Number(state.carga) : (row.carga || 0);

      const startSec = parseClockTime(state.start);
      const endSec = parseClockTime(state.end);
      const tempoDefinitivoTemp = (startSec >= 0 && endSec > startSec) ? (endSec - startSec) : 0;
      
      // Injeção da variável latente de falha no motor biomecânico
      const calc = calcularFisica(row.movId, config, repsEffective, cargaEffective, row.extraVal, row.extraVal2, atleta, row.tecnica, tempoDefinitivoTemp, tempoDecorridoEstimado) || {};

      const trabMetabolicoWork = calc.trabMetabolicoWork || 0;
      const trabMetabolicoConcIsom = calc.trabMetabolicoConcIsom || 0;
      const trabMech = calc.trabMech || 0;

      let transicaoEspecifica = 0;
      if (tempoDefinitivoTemp > 0) {
        if (lastEndSec >= 0 && startSec >= lastEndSec) { transicaoEspecifica = startSec - lastEndSec; totalTransicaoGlobal += transicaoEspecifica; }
        lastEndSec = endSec; somaTempoDeterminadoGlobal += tempoDefinitivoTemp; gastoMetabolicoLiquidoTotal += trabMetabolicoWork;
      } else { 
        lastEndSec = -1; metabolicoRestanteGlobal += trabMetabolicoConcIsom; 
      }
      
      // Atualização do eixo temporal: Incrementa a carga de estresse (3s por repetição como heurística base caso deltaT seja omisso)
      const tempoDesgasteIteracao = tempoDefinitivoTemp > 0 ? tempoDefinitivoTemp : (repsEffective * 3.0);
      tempoDecorridoEstimado += (tempoDesgasteIteracao + transicaoEspecifica);

      trabalhoMechTotalReal += trabMech;
      itemsProcessados.push({ 
        ...calc, 
        nome: config.nome || row.movId, 
        reps: repsEffective, 
        labelRounds: row.badgeText, 
        tempoDefinitivo: tempoDefinitivoTemp, 
        transicaoEspecifica: tempoDefinitivoTemp > 0 && startSec >= lastEndSec ? startSec - lastEndSec : 0, 
        phase: row.phase 
      });
    });

    const tempoTotalReferencia = (tipoTreino === 'FOR_TIME' && tRealSec > 0) ? tRealSec : tAlvoSec;
    const tempoDisponivel = Math.max(0, tempoTotalReferencia - somaTempoDeterminadoGlobal - totalTransicaoGlobal);
    
    // Refatoração 4: Fator EPOC Sigmoidal baseado na fadiga termodinâmica extrema
    const refTempoEstimado = tempoTotalReferencia > 0 ? tempoTotalReferencia : tAlvoSec;
    const tempoLiquidoEstimado = Math.max(1, refTempoEstimado - totalTransicaoGlobal);
    const potRealEstimada = tempoLiquidoEstimado > 0 ? (trabalhoMechTotalReal / tempoLiquidoEstimado) : 0;
    const limiarPotencia = potRealEstimada / (atleta?.peso || 80);
    
    // Função sigmoide: Teto dinâmico máximo de 40% (1.40) com inflexão aos 3.5 W/kg
    const fatorEPOC = 1.0 + (0.40 / (1.0 + Math.exp(-1.5 * (limiarPotencia - 3.5))));

    let logDetalhes = "", lastPhase: string | null = null;
    let tempoTotalExecucaoEfetiva = 0;

    itemsProcessados.forEach(item => {
      if (item.phase !== lastPhase) {
        if (item.phase === 'buyin') logDetalhes += `<div style="margin-top:15px; padding:5px 10px; background:#2a2a2a; border-left:3px solid #f39c12;"><strong>▶ BUY-IN</strong></div>`;
        else if (item.phase === 'round') logDetalhes += `<div style="margin-top:15px; padding:5px 10px; background:#2a2a2a; border-left:3px solid var(--accent);"><strong>🔄 WOD PRINCIPAL</strong></div>`;
        else if (item.phase === 'cashout') logDetalhes += `<div style="margin-top:15px; padding:5px 10px; background:#2a2a2a; border-left:3px solid #2196f3;"><strong>⏹ CASH-OUT</strong></div>`;
        lastPhase = item.phase;
      }
      
      let tempoParaPotencia = item.tempoDefinitivo || 0; 
      const transEsp = item.transicaoEspecifica || 0;
      
      if (transEsp > 0) logDetalhes += `<span class="color-transition">&nbsp;&nbsp;↳ 🚶 Transição: ${transEsp.toFixed(0)}s</span><br/>`;
      
      const trabMetConcIsom = item.trabMetabolicoConcIsom || 0;
      const trabMetWork = item.trabMetabolicoWork || 0;
      const ergTime = item.ergTime || 0;
      
      if (tempoParaPotencia === 0) {
        if (metabolicoRestanteGlobal > 0 && tempoDisponivel > 0) {
          tempoParaPotencia = (trabMetConcIsom / metabolicoRestanteGlobal) * tempoDisponivel; 
        } else if (item.isErgo) {
          tempoParaPotencia = ergTime;
        }
        gastoMetabolicoLiquidoTotal += trabMetWork;
      }
      tempoTotalExecucaoEfetiva += tempoParaPotencia;

      const gastoBasalLinha = item.isCalorieErgo ? 0 : (bmrSec * tempoParaPotencia);
      const totalKcalLinha = (trabMetWork * fatorEPOC) + gastoBasalLinha;
      
      let strPot = "", strTmp = "";
      const trabMechLinha = item.trabMech || 0;
      const extraLog = item.infoExtraLog || '';

      if (tempoParaPotencia > 0) {
        strTmp = ` | 🕒 ${tempoParaPotencia.toFixed(0)}s`; 
        strPot = ` | <strong class="color-time">⚡ ${(trabMechLinha / tempoParaPotencia).toFixed(1)} W</strong>`;
      }
      
      logDetalhes += `• [${item.labelRounds}] ${item.reps}x ${item.nome}${extraLog}: <strong class="color-mech">${trabMechLinha.toFixed(0)} J</strong> | <strong class="color-metabolic">${totalKcalLinha.toFixed(1)} kCal</strong>${strTmp}${strPot}<br/>`;
    });

    const tempoLiquidoEsp = tAlvoSec - totalTransicaoGlobal;
    const potEsp = tempoLiquidoEsp > 0 ? (trabalhoMechTotalEsp / tempoLiquidoEsp) : 0;
    
    const refTempo = tempoTotalReferencia > 0 ? tempoTotalReferencia : tempoTotalExecucaoEfetiva;
    const tempoLiquidoReal = refTempo - totalTransicaoGlobal;
    const potReal = tempoLiquidoReal > 0 ? (trabalhoMechTotalReal / tempoLiquidoReal) : 0;
    
    const tempoTotalSessao = tempoTotalReferencia > 0 ? tempoTotalReferencia : (tempoTotalExecucaoEfetiva + totalTransicaoGlobal);
    const gastoBasalSessao = bmrSec * tempoTotalSessao;
    const gastoMetabolicoFinal = (gastoMetabolicoLiquidoTotal * fatorEPOC) + gastoBasalSessao;

    setResultado({ 
      trabalhoReal: trabalhoMechTotalReal || 0, 
      gastoMetabolico: gastoMetabolicoFinal || 0, 
      potenciaEsp: potEsp || 0, 
      potenciaReal: potReal || 0, 
      logDetalhesHTML: logDetalhes 
    });
  };

  if (loadingAuth) return <div style={{textAlign: 'center', marginTop: '50px'}}>Iniciando...</div>;

  if (!session) {
    return <LoginScreen onSignIn={signInWithGoogle} />;
  }

  if (isNewUser) {
    return (
      <OnboardingScreen 
        form={onboardForm} 
        setForm={setOnboardForm} 
        onSave={saveOnboardingProfile} 
        onSignOut={signOut} 
      />
    );
  }

  return (
    <div className="container" style={{ padding: 0, maxWidth: '1200px', margin: '0 auto' }}> 
      
      <Header 
        userProfile={userProfile}
        selectedAthleteId={selectedAthleteId}
        myAthletes={myAthletes}
        onAthleteChange={handleAthleteChange}
        onSignOut={signOut}
      />

      <div style={{ padding: '0 24px' }}>
        
        <Tabs activeTab={activeTab} setActiveTab={setActiveTab} />

        {activeTab === 'prescricao' && (
          <PrescricaoTab 
            nomeTreino={nomeTreino}
            setNomeTreino={setNomeTreino}
            tipoTreino={tipoTreino}
            setTipoTreino={setTipoTreino}
            tempoAlvo={tempoAlvo}
            setTempoAlvo={setTempoAlvo}
            roundsPrescritos={roundsPrescritos}
            setRoundsPrescritos={setRoundsPrescritos}
            lousa={lousa}
            addMovimento={addMovimento}
            removeMovimento={removeMovimento}
            updateMovimento={updateMovimento}
            handleDragStart={handleDragStart}
            handleDragEnter={handleDragEnter}
            handleDragEnd={handleDragEnd}
            currentShortCode={currentShortCode}
            currentTemplateId={currentTemplateId}
            importarWod={importarWod}
            compartilharWod={compartilharWod}
            clonarWod={clonarWod}
            salvarNoSupabase={salvarNoSupabase}
          />
        )}

        {activeTab === 'analise' && (
          <AnaliseTab
            tipoTreino={tipoTreino}
            tempoReal={tempoReal}
            setTempoReal={setTempoReal}
            roundsReal={roundsReal}
            setRoundsReal={setRoundsReal}
            isScaled={isScaled}
            setIsScaled={setIsScaled}
            lousa={lousa}
            timelineState={timelineState}
            handleTimelineChange={handleTimelineChange}
            processarWOD={processarWOD}
            resultado={resultado}
            gerarCardInstagram={gerarCardInstagram}
            roundsPrescritos={roundsPrescritos}
          />
        )}

        {activeTab === 'atleta' && (
          <AtletaTab
            selectedAthleteId={selectedAthleteId}
            atleta={atleta}
            setAtleta={setAtleta}
            salvarPerfilAtleta={salvarPerfilAtleta}
          />
        )}

        {activeTab === 'historico' && (
          <HistoricoTab
            selectedAthleteId={selectedAthleteId}
            userProfile={userProfile}
            sessionId={session?.user?.id}
            coachIdInput={coachIdInput}
            setCoachIdInput={setCoachIdInput}
            linkToCoach={linkToCoach}
            savedWods={savedWods}
            carregarDoSupabase={carregarDoSupabase}
          />
        )}
      
      </div> 

      <InstagramCard 
        tipoTreino={tipoTreino}
        tempoAlvo={tempoAlvo}
        roundsPrescritos={roundsPrescritos}
        lousaCount={lousa.length}
        tempoReal={tempoReal}
        isScaled={isScaled}
        resultado={resultado}
      />
      
    </div>
  );
}