import { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { movimentosDB } from './data/movements';
import { supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js'; 
import type { 
  AtletaPerfil, ItemLousa, Modalidade, 
  ResultadoProcessamento, TimelineStateItem, UserProfile,
  WodTemplateRecord 
} from './types';
import { calcularFisica, parseClockTime } from './utils/physicsEngine';
import { Trophy, Dumbbell, Copy, Download, Share2, Save, LogOut, X } from 'lucide-react';
import html2canvas from 'html2canvas';

function SearchableMovementSelect({ value, onChange, movimentosDB }: { value: string, onChange: (val: string) => void, movimentosDB: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Fecha o dropdown se clicar fora dele
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Agrupa os movimentos usando a configuração original
  const groups: Record<string, any[]> = {};
  Object.entries(movimentosDB).forEach(([key, config]: [string, any]) => {
    if (!groups[config.grupo]) groups[config.grupo] = [];
    groups[config.grupo].push({ key, nome: config.nome });
  });

  // Filtra movimentos e oculta grupos sem resultados
  const filteredGroups: Record<string, any[]> = {};
  Object.entries(groups).forEach(([groupName, items]) => {
    const filteredItems = items.filter(item => 
      item.nome.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (filteredItems.length > 0) {
      filteredGroups[groupName] = filteredItems;
    }
  });

  const selectedName = movimentosDB[value]?.nome || "Selecione...";

  return (
    <div className="searchable-select" ref={wrapperRef}>
      <input
        type="text"
        className="search-input"
        placeholder="Buscar exercício..."
        value={isOpen ? searchTerm : selectedName}
        onChange={(e) => setSearchTerm(e.target.value)}
        onClick={() => { setIsOpen(true); setSearchTerm(""); }}
      />
      {isOpen && (
        <div className="dropdown-list">
          {Object.entries(filteredGroups).map(([groupName, items]) => (
            <div key={groupName}>
              <div className="dropdown-group">{groupName}</div>
              {items.map(item => (
                <div
                  key={item.key}
                  className="dropdown-item"
                  onClick={() => {
                    onChange(item.key);
                    setIsOpen(false);
                    setSearchTerm("");
                  }}
                >
                  {item.nome}
                </div>
              ))}
            </div>
          ))}
          {Object.keys(filteredGroups).length === 0 && (
            <div style={{ padding: '10px', color: '#888', fontSize: '0.9rem', textAlign: 'center' }}>
              Nenhum movimento encontrado.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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

          <p style={{ color: '#ff9800', fontSize: '0.85rem', marginBottom: '15px', backgroundColor: '#332b00', padding: '10px', borderRadius: '4px', borderLeft: '3px solid #ff9800' }}>
            ⚠️ <strong>Atenção:</strong> Preencha as medidas de comprimento em <strong>metros</strong> (use ponto). Ex: <strong>1.75</strong>, e não 175.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}><label>Estatura (m)</label><input type="number" step="0.01" placeholder="Ex: 1.75" value={onboardForm.estatura || ''} onChange={e => setOnboardForm({...onboardForm, estatura: e.target.value as unknown as number})} /></div>
            <div className="form-group" style={{ marginBottom: 0 }}><label>Peso (kg)</label><input type="number" step="0.1" placeholder="Ex: 80.5" value={onboardForm.peso || ''} onChange={e => setOnboardForm({...onboardForm, peso: e.target.value as unknown as number})} /></div>
            <div className="form-group" style={{ marginBottom: 0 }}><label>Sexo Biológico</label><select value={onboardForm.sexo} onChange={e => setOnboardForm({...onboardForm, sexo: e.target.value as 'M'|'F'})}><option value="M">Masculino</option><option value="F">Feminino</option></select></div>
            <div className="form-group" style={{ marginBottom: 0 }}><label>Nível</label><select value={onboardForm.nivel_tecnico} onChange={e => setOnboardForm({...onboardForm, nivel_tecnico: e.target.value})}><option value="iniciante">Iniciante</option><option value="intermediario">Intermediário</option><option value="avancado">Avançado</option></select></div>
            <div className="form-group" style={{ marginBottom: 0 }}><label>Envergadura (m)</label><input type="number" step="0.01" placeholder="Ex: 1.75" value={onboardForm.envergadura || ''} onChange={e => setOnboardForm({...onboardForm, envergadura: e.target.value as unknown as number})} /></div>
            <div className="form-group" style={{ marginBottom: 0 }}><label>Alt. Perna (m)</label><input type="number" step="0.01" placeholder="Ex: 0.85" value={onboardForm.perna || ''} onChange={e => setOnboardForm({...onboardForm, perna: e.target.value as unknown as number})} /></div>
            <div className="form-group" style={{ marginBottom: 0 }}><label>% BF</label><input type="number" placeholder="Ex: 15" value={onboardForm.bf || ''} onChange={e => setOnboardForm({...onboardForm, bf: e.target.value as unknown as number})} /></div>
            <div className="form-group" style={{ marginBottom: 0 }}><label>Data de Nascimento</label><input type="date" value={onboardForm.data_nascimento} onChange={e => setOnboardForm({...onboardForm, data_nascimento: e.target.value})} /></div>
          </div>

          <button onClick={saveOnboardingProfile} style={{ marginTop: '20px', width: '100%', fontSize: '1.2rem', padding: '15px' }}>Salvar Perfil e Entrar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: 0, maxWidth: '1200px', margin: '0 auto' }}> 
      
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', backgroundColor: 'var(--bg-dark, #0a0a0a)', borderBottom: '1px solid var(--line-silver, #26272b)', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/favicon.png" alt="Símbolo DynaWOD" style={{ height: '40px', objectFit: 'contain' }} />
          <img src="/dynawod-texto.png" alt="DynaWOD Tipografia" style={{ height: '28px', objectFit: 'contain' }} />
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
        
        <div className="tabs">
          <button className={`tab-btn ${activeTab === 'prescricao' ? 'active' : ''}`} onClick={() => setActiveTab('prescricao')}>1. Lousa</button>
          <button className={`tab-btn ${activeTab === 'analise' ? 'active' : ''}`} onClick={() => setActiveTab('analise')}>2. Análise</button>
          <button className={`tab-btn ${activeTab === 'atleta' ? 'active' : ''}`} onClick={() => setActiveTab('atleta')}>3. Atleta</button>
          <button className={`tab-btn ${activeTab === 'historico' ? 'active' : ''}`} onClick={() => setActiveTab('historico')}>4. Histórico</button>
        </div>

        {activeTab === 'prescricao' && (
          <div className="panel">
            <h2>Estrutura do Treino</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '15px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Nome do Treino (Opcional)</label>
                <input type="text" value={nomeTreino} onChange={e => setNomeTreino(e.target.value)} placeholder="Ex: Murph, Fran, Open 24.1..." />
              </div>
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

            <h2>Quadro de Movimentos</h2>
            <button className="btn-add" onClick={() => addMovimento()} style={{ backgroundColor: 'transparent', color: 'var(--dyna-red, #FF2B3D)', border: '1px dashed var(--dyna-red, #FF2B3D)', padding: '10px 15px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', width: '100%', marginBottom: '15px' }}>+ Adicionar Exercício</button>
            
            <div className="wod-list">
              {lousa.map((item, index) => {
                const cfg = movimentosDB[item.movId] || movimentosDB['pushup'];
                return (
                  <div 
                    key={item.originalId} 
                    className="wod-item"
                    draggable
                    onDragStart={(e) => {
                      handleDragStart(index);
                      e.currentTarget.style.opacity = '0.5';
                    }}
                    onDragEnter={() => handleDragEnter(index)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => e.preventDefault()}
                  >
                    {/* Pegador Lateral (Drag Handle) */}
                    <div className="drag-handle">
                      <svg width="10" height="20" viewBox="0 0 8 20" fill="currentColor">
                        <circle cx="2" cy="2" r="1.5"/><circle cx="6" cy="2" r="1.5"/>
                        <circle cx="2" cy="10" r="1.5"/><circle cx="6" cy="10" r="1.5"/>
                        <circle cx="2" cy="18" r="1.5"/><circle cx="6" cy="18" r="1.5"/>
                      </svg>
                    </div>

                    <div>
                      <label>Fase</label>
                      <select value={item.phase} onChange={e => updateMovimento(item.originalId, 'phase', e.target.value)}>
                        <option value="buyin">Buy-in</option>
                        <option value="round">WOD</option>
                        <option value="cashout">Cash-out</option>
                      </select>
                      <div style={{ marginTop: '5px' }}>
                        <SearchableMovementSelect 
                          value={item.movId} 
                          onChange={(newId) => updateMovimento(item.originalId, 'movId', newId)} 
                          movimentosDB={movimentosDB} 
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label>Reps/Mts</label>
                      <input type="number" value={item.reps} onChange={e => updateMovimento(item.originalId, 'reps', Number(e.target.value))} />
                    </div>
                    
                    <div>
                      <label>Carga/Téc.</label>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <input type="number" disabled={!cfg.usaCarga} value={item.carga} onChange={e => updateMovimento(item.originalId, 'carga', Number(e.target.value))} />
                        <select value={item.tecnica} onChange={e => updateMovimento(item.originalId, 'tecnica', e.target.value)}>
                          <option value="tng">T&G</option>
                          <option value="drop">Drop</option>
                        </select>
                      </div>
                    </div>
                    
                    <div>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <div style={{ flex: 1 }}>
                          <label>{cfg.paramExtra ? cfg.paramExtra.label : 'Param.'}</label>
                          <input type="text" disabled={!cfg.paramExtra} value={item.extraVal || ''} onChange={e => updateMovimento(item.originalId, 'extraVal', e.target.value)} />
                        </div>
                        {cfg.paramExtra2 && (
                          <div style={{ flex: 1 }}>
                            <label>{cfg.paramExtra2.label}</label>
                            <select value={item.extraVal2 || cfg.paramExtra2.val} onChange={e => updateMovimento(item.originalId, 'extraVal2', e.target.value)}>
                              {cfg.paramExtra2.options?.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                    
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
            
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                <button onClick={importarWod} style={{ flex: '1 1 140px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '1rem', backgroundColor: 'var(--bg-card, #181a1e)', color: '#fff', border: '1px solid var(--line-silver, #26272b)' }}>
                  <Download size={22} style={{ flexShrink: 0 }} /> 
                  <span>Importar</span>
                </button>
                <button onClick={compartilharWod} style={{ flex: '1 1 140px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '1rem', backgroundColor: 'var(--dyna-burgundy, #7A0F1B)', color: '#fff', border: 'none', fontWeight: '600' }}>
                  <Share2 size={22} style={{ flexShrink: 0 }} /> 
                  <span>Copiar</span>
                </button>
                {currentTemplateId && (
                  <button onClick={clonarWod} style={{ flex: '1 1 140px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '1rem', backgroundColor: '#3b82f6', color: '#fff', border: 'none', fontWeight: 'bold' }}>
                    <Copy size={22} style={{ flexShrink: 0 }} /> 
                    <span>Duplicar</span>
                  </button>
                )}
                <button onClick={() => salvarNoSupabase(false)} style={{ flex: '1 1 140px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '1rem', backgroundColor: 'var(--dyna-red, #FF2B3D)', color: '#fff', border: 'none', fontWeight: 'bold' }}>
                  <Save size={22} style={{ flexShrink: 0 }} /> 
                  <span>{currentTemplateId ? 'Atualizar WOD' : 'Salvar WOD'}</span>
                </button>
              </div>
          </div>
        )}

        {activeTab === 'analise' && (
          <div className="panel">
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
              <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input 
                  type="checkbox" 
                  id="checkbox-scaled"
                  checked={isScaled}
                  onChange={(e) => setIsScaled(e.target.checked)}
                  style={{ width: '18px', height: '18px' }}
                />
                <label htmlFor="checkbox-scaled" style={{ color: '#fff', fontSize: '14px' }}>
                  Marcar como Scaled (Treino Adaptado)
                </label>
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
                      <div>
                        <div style={{ fontWeight: 'bold' }}>{cfg ? cfg.nome : m.movId}</div>
                        <div style={{ fontSize: '0.75rem', color: '#aaa' }}>
                          RX: {m.carga > 0 ? `${m.carga}kg` : '--'} {m.extraVal ? `| ${m.extraVal}` : ''}
                        </div>
                      </div>
                      <div><label>Reps</label><input type="number" value={st.reps !== undefined ? st.reps : m.reps} onChange={e => handleTimelineChange(rowId, 'reps', e.target.value === '' ? '' : Number(e.target.value))} /></div>
                      
                      <div>
                        <label>Carga Real</label>
                        <input 
                          type="number" 
                          value={st.carga !== undefined ? st.carga : m.carga} 
                          onChange={e => handleTimelineChange(rowId, 'carga', e.target.value === '' ? '' : Number(e.target.value))}
                          disabled={!(cfg?.usaCarga)}
                          style={{ border: isScaled && (st.carga !== undefined ? st.carga : m.carga) < m.carga ? '1px solid var(--dyna-red, #FF2B3D)' : '' }}
                        />
                      </div>

                      <div><label>Início</label><input type="text" placeholder="mm:ss" value={st.start || ''} onChange={e => handleTimelineChange(rowId, 'start', e.target.value)} /></div>
                      <div><label>Fim</label><input type="text" placeholder="mm:ss" value={st.end || ''} onChange={e => handleTimelineChange(rowId, 'end', e.target.value)} /></div>
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
            <button 
              onClick={gerarCardInstagram} 
              style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', 
                fontSize: '1rem', backgroundColor: '#8a33e2',
                color: '#fff', border: 'none', fontWeight: 'bold', 
                padding: '12px 20px', borderRadius: '8px', width: '100%', marginTop: '20px'
              }}
            >
              📸 Compartilhar no Instagram
            </button>
          </div>
        )}

        {activeTab === 'atleta' && (
          <div className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h2 style={{ margin: 0 }}>Perfil do Atleta</h2>
              {selectedAthleteId !== 'me' && <span style={{ background: '#ff9800', color: '#000', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>Visualizando Aluno</span>}
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted, #8a8d94)', marginBottom: '10px' }}>
              Os dados base são carregados do perfil selecionado. Você pode ajustá-los apenas para simular um cálculo pontual, ou clicar no botão no final da página para salvar as alterações definitivamente no banco de dados.
            </p>

            <p style={{ color: '#ff9800', fontSize: '0.85rem', marginBottom: '20px', backgroundColor: '#332b00', padding: '10px', borderRadius: '4px', borderLeft: '3px solid #ff9800' }}>
              ⚠️ <strong>Medidas em METROS:</strong> Certifique-se de usar notação decimal para comprimentos (Ex: <strong>1.75</strong>, <strong>0.85</strong>).
            </p>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '25px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}><label>Estatura (m)</label><input type="number" step="0.01" placeholder="Ex: 1.75" value={atleta.estatura || ''} onChange={e => setAtleta({ ...atleta, estatura: e.target.value as unknown as number })} /></div>
              <div className="form-group" style={{ marginBottom: 0 }}><label>Massa (kg)</label><input type="number" step="0.1" placeholder="Ex: 80.5" value={atleta.peso || ''} onChange={e => setAtleta({ ...atleta, peso: e.target.value as unknown as number })} /></div>
              <div className="form-group" style={{ marginBottom: 0 }}><label>Sexo Biológico</label><select value={atleta.sexo} onChange={e => setAtleta({ ...atleta, sexo: e.target.value as 'M' | 'F' })}><option value="M">Masculino</option><option value="F">Feminino</option></select></div>
              <div className="form-group" style={{ marginBottom: 0 }}><label>Nível Técnico</label><select value={atleta.nivelTecnico} onChange={e => setAtleta({ ...atleta, nivelTecnico: e.target.value as any })}><option value="iniciante">Iniciante</option><option value="intermediario">Intermediário</option><option value="avancado">Avançado</option></select></div>
              <div className="form-group" style={{ marginBottom: 0 }}><label>Envergadura (m)</label><input type="number" step="0.01" placeholder="Ex: 1.75" value={atleta.envergadura || ''} onChange={e => setAtleta({ ...atleta, envergadura: e.target.value as unknown as number })} /></div>
              <div className="form-group" style={{ marginBottom: 0 }}><label>Alt. Perna (m)</label><input type="number" step="0.01" placeholder="Ex: 0.85" value={atleta.perna || ''} onChange={e => setAtleta({ ...atleta, perna: e.target.value as unknown as number })} /></div>
              <div className="form-group" style={{ marginBottom: 0 }}><label>% Gordura Corporal (BF)</label><input type="number" step="0.1" placeholder="Ex: 15" value={atleta.bf || ''} onChange={e => setAtleta({ ...atleta, bf: e.target.value as unknown as number })} /></div>
            </div>

            {/* --- INÍCIO DA SEÇÃO DE ANTROPOMETRIA AVANÇADA --- */}
            <div style={{ backgroundColor: '#111', padding: '15px', borderRadius: '8px', border: '1px solid var(--line-silver, #26272b)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: atleta.usaAntropometriaAvancada ? '15px' : '0' }}>
                <input 
                  type="checkbox" 
                  id="check-avancada"
                  checked={atleta.usaAntropometriaAvancada || false}
                  onChange={(e) => setAtleta({ ...atleta, usaAntropometriaAvancada: e.target.checked })}
                  style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                />
                <label htmlFor="check-avancada" style={{ margin: 0, fontSize: '1rem', color: '#fff', cursor: 'pointer' }}>
                  Habilitar Antropometria Avançada (Laboratorial)
                </label>
              </div>

              {atleta.usaAntropometriaAvancada && (
                <>
                  <p style={{ fontSize: '0.85rem', color: '#ff9800', marginBottom: '15px' }}>
                    <strong>Atenção:</strong> Ao preencher estes dados, o motor ignorará a alometria padrão de De Leva e recalculará o seu centro de gravidade e massas segmentares de forma dinâmica.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', alignItems: 'end' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Data de Nasc.</label>
                      <input type="date" value={atleta.dataNascimento || ''} onChange={e => setAtleta({ ...atleta, dataNascimento: e.target.value })} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Circ. Tórax (m)</label>
                      <input type="number" step="0.01" placeholder="Ex: 1.10" value={atleta.circTorax || ''} onChange={e => setAtleta({ ...atleta, circTorax: e.target.value as unknown as number })} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Circ. Coxa (m)</label>
                      <input type="number" step="0.01" placeholder="Ex: 0.65" value={atleta.circCoxa || ''} onChange={e => setAtleta({ ...atleta, circCoxa: e.target.value as unknown as number })} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Mobilidade (ROM) - {atleta.mobilidade || 100}%</label>
                      <input 
                        type="range" 
                        min="50" max="100" 
                        value={atleta.mobilidade || 100} 
                        onChange={e => setAtleta({ ...atleta, mobilidade: Number(e.target.value) })} 
                        style={{ width: '100%' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#8a8d94', marginTop: '5px' }}>
                        <span>Encurtado (50%)</span>
                        <span>Perfeita (100%)</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
            {/* --- FIM DA SEÇÃO DE ANTROPOMETRIA AVANÇADA --- */}
            
            <hr style={{ borderColor: 'var(--line-silver, #26272b)', margin: '25px 0' }} />
            
            <button 
              onClick={salvarPerfilAtleta} 
              style={{ 
                fontSize: '1.1rem', 
                padding: '15px', 
                backgroundColor: '#388e3c', 
                color: '#fff', 
                border: 'none', 
                borderRadius: '8px', 
                fontWeight: 'bold', 
                width: '100%', 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px'
              }}
            >
              <Save size={22} />
              Atualizar Perfil Oficial no Banco de Dados
            </button>
          </div>
        )}

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

      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <div 
          id="instagram-card-export" 
          style={{
            width: '420px', 
            backgroundColor: '#111315',
            color: '#fff',
            fontFamily: 'sans-serif',
            padding: '40px 20px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            backgroundImage: 'linear-gradient(to bottom, #111315, #1a1a1a)'
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ margin: 0, fontSize: '32px', fontStyle: 'italic', fontWeight: '900', letterSpacing: '1px' }}>DynaWOD</h1>
            <p style={{ margin: '5px 0 0 0', color: '#8a8d94', fontSize: '13px', fontWeight: 'bold' }}>V2 - RESUMO DE TREINO</p>
            <p style={{ margin: '2px 0 0 0', color: '#8a8d94', fontSize: '12px' }}>Data: {new Date().toLocaleDateString('pt-BR')}</p>
          </div>

          <div style={{ border: '2px solid #26272b', borderRadius: '12px', padding: '20px', backgroundColor: '#181a1e' }}>
            <h2 style={{ margin: '0 0 12px 0', fontSize: '20px', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              Prescription <span style={{ fontSize: '11px', color: '#8a8d94', fontWeight: 'normal' }}>(PLANTA BAIXA DO WOD)</span>
            </h2>
            <div style={{ color: '#d1d5db', fontSize: '16px', lineHeight: '1.6' }}>
              
              <strong style={{ color: '#fff', fontSize: '18px' }}>TREINO {tipoTreino.replace('_', ' ')}</strong><br />
              
              TIME CAP: <span style={{ color: '#fff' }}>{tempoAlvo || 'N/A'}</span> • RNDS: <span style={{ color: '#fff' }}>{roundsPrescritos || 'N/A'}</span><br />
              <span style={{ color: '#8a8d94', fontSize: '14px' }}>Movimentos Cadastrados: {lousa.length}</span>
            </div>
          </div>

          <div style={{ border: '2px solid var(--dyna-red, #FF2B3D)', borderRadius: '12px', padding: '25px 15px', backgroundColor: '#181a1e', boxShadow: '0 0 25px rgba(255, 43, 61, 0.15)', position: 'relative', marginTop: '10px' }}>
            
            <h2 style={{ margin: 0, fontSize: '24px', position: 'absolute', top: '-15px', backgroundColor: '#181a1e', padding: '0 10px', color: 'var(--dyna-red, #FF2B3D)' }}>
              Resultado
            </h2>
            
            <div style={{ textAlign: 'center', marginBottom: '25px', marginTop: '15px' }}>
              <span style={{ fontSize: '16px', color: '#8a8d94', fontWeight: 'bold' }}>TEMPO TOTAL:</span>
              <div style={{ fontSize: '54px', fontWeight: '900', margin: '5px 0', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
                {tempoReal || '00:00'}
              </div>
              
              {isScaled ? (
                <span style={{ backgroundColor: '#FF2B3D', color: '#fff', padding: '6px 16px', borderRadius: '20px', fontSize: '16px', fontWeight: '900', letterSpacing: '1px' }}>STATUS: SCALED</span>
              ) : (
                <span style={{ backgroundColor: '#22c55e', color: '#fff', padding: '6px 16px', borderRadius: '20px', fontSize: '16px', fontWeight: '900', letterSpacing: '1px' }}>STATUS: RX</span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between' }}>
              
              <div style={{ flex: 1, backgroundColor: '#111315', padding: '15px 5px', borderRadius: '10px', textAlign: 'center', border: '1px solid #26272b' }}>
                <div style={{ fontSize: '11px', color: '#8a8d94', marginBottom: '10px', fontWeight: 'bold' }}>POTÊNCIA MÉDIA</div>
                
                <svg width="70" height="35" viewBox="0 0 100 50" style={{ marginBottom: '8px' }}>
                  <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#26272b" strokeWidth="10" />
                  <path d="M 10 50 A 40 40 0 0 1 70 20" fill="none" stroke="#FF2B3D" strokeWidth="10" strokeLinecap="round" />
                  <line x1="50" y1="50" x2="65" y2="25" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                  <circle cx="50" cy="50" r="4" fill="#fff" />
                </svg>

                <div style={{ fontSize: '22px', fontWeight: '900' }}>
                  {resultado ? resultado.potenciaReal.toFixed(0) : 0} <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#8a8d94' }}>W</span>
                </div>
              </div>
              
              <div style={{ flex: 1, backgroundColor: '#111315', padding: '15px 5px', borderRadius: '10px', textAlign: 'center', border: '1px solid #26272b' }}>
                <div style={{ fontSize: '11px', color: '#8a8d94', marginBottom: '10px', fontWeight: 'bold' }}>GASTO ENERGÉTICO</div>
                
                <svg width="70" height="35" viewBox="0 0 100 50" style={{ marginBottom: '8px' }}>
                  <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#26272b" strokeWidth="10" />
                  <path d="M 10 50 A 40 40 0 0 1 85 30" fill="none" stroke="#ff9800" strokeWidth="10" strokeLinecap="round" />
                  <path d="M 50 45 Q 40 45 45 30 Q 50 20 50 15 Q 50 25 55 30 Q 60 45 50 45" fill="#ff9800" />
                </svg>

                <div style={{ fontSize: '22px', fontWeight: '900' }}>
                  {resultado ? resultado.gastoMetabolico.toFixed(0) : 0} <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#8a8d94' }}>kcal</span>
                </div>
              </div>

            </div>
          </div>
          
          <div style={{ textAlign: 'center', color: '#52525b', fontSize: '12px', marginTop: '10px' }}>
            Gerado pelo aplicativo DynaWOD - dynawod.com
          </div>
        </div>
      </div>
      
    </div>
  );
}