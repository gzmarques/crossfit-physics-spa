import React, { useState, useEffect } from 'react';
import { movimentosDB } from './data/movements';
import { supabase } from './lib/supabase';
import { 
  AtletaPerfil, ItemLousa, Modalidade, 
  ResultadoProcessamento, TimelineStateItem, WodDatabaseRecord 
} from './types';
import { calcularFisica, parseClockTime } from './utils/physicsEngine';

export default function App() {
  const [activeTab, setActiveTab] = useState<'prescricao' | 'analise'>('prescricao');
  
  // Configuração do Domínio
  const [tipoTreino, setTipoTreino] = useState<Modalidade>('FOR_TIME');
  const [tempoAlvo, setTempoAlvo] = useState('05:00');
  const [roundsPrescritos, setRoundsPrescritos] = useState(3);
  const [roundsReal, setRoundsReal] = useState(0);
  const [tempoReal, setTempoReal] = useState('');
  const [tempoDescanso, setTempoDescanso] = useState(0);

  // Perfil do Atleta
  const [atleta, setAtleta] = useState<AtletaPerfil>({
    estatura: 1.75,
    peso: 80,
    sexo: 'M',
    nivelTecnico: 'intermediario',
    envergadura: 1.75,
    perna: 0.85,
    bf: 15
  });

  // Lousa e Timeline
  const [lousa, setLousa] = useState<ItemLousa[]>([
    { originalId: crypto.randomUUID(), movId: 'thruster', phase: 'round', reps: 21, carga: 43, tecnica: 'tng', extraVal: '' }
  ]);
  const [timelineState, setTimelineState] = useState<Record<string, TimelineStateItem>>({});
  
  // Resultados e JSON
  const [resultado, setResultado] = useState<ResultadoProcessamento | null>(null);
  const [jsonInOut, setJsonInOut] = useState('');
  const [dropdownSearch, setDropdownSearch] = useState<Record<string, string>>({});
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Histórico Supabase
  const [savedWods, setSavedWods] = useState<WodDatabaseRecord[]>([]);

  useEffect(() => {
    fetchWodsFromSupabase();
  }, []);

  const fetchWodsFromSupabase = async () => {
    const { data, error } = await supabase.from('wods').select('*').order('created_at', { ascending: false });
    if (!error && data) setSavedWods(data as WodDatabaseRecord[]);
  };

  const addMovimento = (baseId: string | null = null) => {
    const newId = crypto.randomUUID();
    let newItem: ItemLousa = {
      originalId: newId,
      movId: 'air_squat',
      phase: 'round',
      reps: 10,
      carga: 0,
      tecnica: 'tng',
      extraVal: ''
    };

    if (baseId) {
      const idx = lousa.findIndex(m => m.originalId === baseId);
      if (idx !== -1) {
        const target = lousa[idx];
        newItem = { ...target, originalId: newId };
        const updated = [...lousa];
        updated.splice(idx + 1, 0, newItem);
        setLousa(updated);
        return;
      }
    }
    setLousa([...lousa, newItem]);
  };

  const removeMovimento = (id: string) => {
    setLousa(lousa.filter(m => m.originalId !== id));
  };

  const updateMovimento = (id: string, field: keyof ItemLousa, val: any) => {
    setLousa(lousa.map(item => item.originalId === id ? { ...item, [field]: val } : item));
  };

  const handleTimelineChange = (rowId: string, field: keyof TimelineStateItem, val: any) => {
    setTimelineState(prev => ({
      ...prev,
      [rowId]: {
        ...(prev[rowId] || { reps: 0, start: '', end: '' }),
        [field]: val
      }
    }));
  };

  const exportarJSON = () => {
    const wod = {
      tipoTreino, tempoAlvo, roundsPrescritos,
      atleta, movimentos: lousa, timeline: timelineState
    };
    setJsonInOut(JSON.stringify(wod, null, 2));
  };

  const importarJSON = () => {
    try {
      const wod = JSON.parse(jsonInOut);
      if (wod.tipoTreino) setTipoTreino(wod.tipoTreino);
      if (wod.tempoAlvo) setTempoAlvo(wod.tempoAlvo);
      if (wod.roundsPrescritos) setRoundsPrescritos(wod.roundsPrescritos);
      if (wod.atleta) setAtleta(wod.atleta);
      if (wod.movimentos) setLousa(wod.movimentos);
      if (wod.timeline) setTimelineState(wod.timeline);
      alert('WOD Importado com sucesso!');
    } catch (e) {
      alert('JSON Inválido');
    }
  };

  const salvarNoSupabase = async () => {
    const wodPayload: WodDatabaseRecord = {
      title: `Treino ${tipoTreino} - ${new Date().toLocaleDateString('pt-BR')}`,
      tipo_treino: tipoTreino,
      tempo_alvo: tempoAlvo,
      rounds_prescritos: roundsPrescritos,
      rounds_real: roundsReal,
      tempo_real: tempoReal,
      tempo_descanso: tempoDescanso,
      atleta,
      movimentos: lousa,
      timeline: timelineState
    };

    const { error } = await supabase.from('wods').insert([wodPayload]);
    if (error) {
      alert('Erro ao salvar no Supabase: ' + error.message);
    } else {
      alert('Treino salvo no Supabase!');
      fetchWodsFromSupabase();
    }
  };

  const carregarDoSupabase = (rec: WodDatabaseRecord) => {
    setTipoTreino(rec.tipo_treino);
    setTempoAlvo(rec.tempo_alvo);
    setRoundsPrescritos(rec.rounds_prescritos);
    if (rec.rounds_real !== undefined) setRoundsReal(rec.rounds_real);
    if (rec.tempo_real) setTempoReal(rec.tempo_real);
    if (rec.tempo_descanso) setTempoDescanso(rec.tempo_descanso);
    if (rec.atleta) setAtleta(rec.atleta);
    if (rec.movimentos) setLousa(rec.movimentos);
    if (rec.timeline) setTimelineState(rec.timeline);
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
      const calc = calcularFisica(m.movId, cfg, m.reps, m.carga, m.extraVal, atleta, m.tecnica, 0);
      trabalhoMechTotalEsp += calc.trabMech * mult;
    });

    let roundsTimeline = (tipoTreino === 'FOR_TIME') ? roundsPrescritos : Math.ceil(roundsReal);
    if (roundsTimeline < 1) roundsTimeline = 1;

    const flatItems: Array<{
      rowId: string; movId: string; reps: number; carga: number; extraVal: string;
      phase: string; tecnica: string; badgeText: string; badgeClass: string;
    }> = [];

    lousa.filter(m => m.phase === 'buyin').forEach(m => {
      flatItems.push({ rowId: `${m.originalId}-R0`, movId: m.movId, reps: m.reps, carga: m.carga, extraVal: m.extraVal, phase: 'buyin', tecnica: m.tecnica, badgeText: 'Buy-in', badgeClass: 'badge-buyin' });
    });

    for (let r = 1; r <= roundsTimeline; r++) {
      lousa.filter(m => m.phase === 'round').forEach(m => {
        flatItems.push({ rowId: `${m.originalId}-R${r}`, movId: m.movId, reps: m.reps, carga: m.carga, extraVal: m.extraVal, phase: 'round', tecnica: m.tecnica, badgeText: `R ${r}`, badgeClass: '' });
      });
    }

    lousa.filter(m => m.phase === 'cashout').forEach(m => {
      flatItems.push({ rowId: `${m.originalId}-R99`, movId: m.movId, reps: m.reps, carga: m.carga, extraVal: m.extraVal, phase: 'cashout', tecnica: m.tecnica, badgeText: 'Cash-out', badgeClass: 'badge-cashout' });
    });

    let somaTempoDeterminadoGlobal = 0, totalTransicaoGlobal = 0;
    let trabalhoMechTotalReal = 0, gastoMetabolicoLiquidoTotal = 0, metabolicoRestanteGlobal = 0;
    let itemsProcessados: any[] = [];
    let lastEndSec = -1;

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
        if (lastEndSec >= 0 && startSec >= lastEndSec) {
          transicaoEspecifica = startSec - lastEndSec;
          totalTransicaoGlobal += transicaoEspecifica;
        }
        lastEndSec = endSec;
        somaTempoDeterminadoGlobal += tempoDefinitivoTemp;
        gastoMetabolicoLiquidoTotal += calc.trabMetabolicoWork;
      } else {
        lastEndSec = -1;
        metabolicoRestanteGlobal += calc.trabMetabolicoConcIsom;
      }

      trabalhoMechTotalReal += calc.trabMech;

      itemsProcessados.push({
        nome: config.nome, reps: repsEffective, labelRounds: row.badgeText,
        infoExtraLog: calc.infoExtraLog, trabMechLinha: calc.trabMech, 
        trabMetabolicoWork: calc.trabMetabolicoWork, trabMetabolicoConcIsom: calc.trabMetabolicoConcIsom,
        isErgo: calc.isErgo, isCalorieErgo: calc.isCalorieErgo, ergTime: calc.ergTime,
        tempoDefinitivo: tempoDefinitivoTemp, transicaoEspecifica: transicaoEspecifica, phase: row.phase
      });
    });

    const tempoTotalReferencia = (tipoTreino === 'FOR_TIME' && tRealSec > 0) ? tRealSec : tAlvoSec;
    const tempoDisponivel = Math.max(0, tempoTotalReferencia - somaTempoDeterminadoGlobal - totalTransicaoGlobal - tempoDescanso);
    
    let logDetalhes = ""; 
    let lastPhase = null;
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

      if (item.transicaoEspecifica > 0) {
        logDetalhes += `<span class="color-transition">&nbsp;&nbsp;↳ 🚶 Transição: ${item.transicaoEspecifica.toFixed(0)}s</span><br/>`;
      }

      if (tempoParaPotencia === 0) {
        if (metabolicoRestanteGlobal > 0 && tempoDisponivel > 0) {
          tempoParaPotencia = (item.trabMetabolicoConcIsom / metabolicoRestanteGlobal) * tempoDisponivel; 
        } else if (item.isErgo) {
          tempoParaPotencia = item.ergTime;
        }
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

    setResultado({
      trabalhoReal: trabalhoMechTotalReal,
      gastoMetabolico: gastoMetabolicoFinal,
      potenciaEsp: potEsp,
      potenciaReal: potReal,
      logDetalhesHTML: logDetalhes
    });
  };

  return (
    <div className="container">
      <h1>CrossFit & Hyrox - Advanced Physics Engine (SPA Version)</h1>

      <div className="grid">
        {/* Painel Estrutura Base */}
        <div className="panel" style={{ marginBottom: 0 }}>
          <h2>Estrutura Base (Domínio)</h2>
          <div className="form-group">
            <label>Modalidade (Domínio de Tempo)</label>
            <select value={tipoTreino} onChange={e => setTipoTreino(e.target.value as Modalidade)}>
              <option value="FOR_TIME">For Time (Por Tempo)</option>
              <option value="AMRAP">AMRAP (O maior nº de Rounds)</option>
              <option value="EMOM">EMOM (A cada minuto)</option>
            </select>
          </div>
          <div className="form-group">
            <label>{tipoTreino === 'FOR_TIME' ? 'Time Cap / Tempo Alvo (mm:ss ou seg)' : 'Tempo Total (mm:ss ou seg)'}</label>
            <input type="text" value={tempoAlvo} onChange={e => setTempoAlvo(e.target.value)} />
          </div>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 0 }}>
            <div className="form-group">
              <label>Rounds Prescritos</label>
              <input type="number" value={roundsPrescritos} onChange={e => setRoundsPrescritos(Number(e.target.value))} />
            </div>
            {tipoTreino !== 'FOR_TIME' ? (
              <div className="form-group">
                <label>Rounds Reais (Score)</label>
                <input type="number" step="0.1" value={roundsReal} onChange={e => setRoundsReal(Number(e.target.value))} />
              </div>
            ) : (
              <div className="form-group">
                <label>Tempo Real (Score em mm:ss)</label>
                <input type="text" value={tempoReal} onChange={e => setTempoReal(e.target.value)} placeholder="Ex: 12:30" />
              </div>
            )}
          </div>
        </div>

        {/* Painel Perfil do Atleta */}
        <div className="panel" style={{ marginBottom: 0 }}>
          <h2>Perfil do Atleta (Modelo Antropométrico Segmentar)</h2>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 0 }}>
            <div className="form-group">
              <label>Estatura (m)</label>
              <input type="number" step="0.01" value={atleta.estatura} onChange={e => setAtleta({ ...atleta, estatura: Number(e.target.value) })} />
            </div>
            <div className="form-group">
              <label>Massa (kg)</label>
              <input type="number" step="0.1" value={atleta.peso} onChange={e => setAtleta({ ...atleta, peso: Number(e.target.value) })} />
            </div>
          </div>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 0, marginTop: '15px' }}>
            <div className="form-group">
              <label>Sexo Biológico</label>
              <select value={atleta.sexo} onChange={e => setAtleta({ ...atleta, sexo: e.target.value as 'M' | 'F' })}>
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
              </select>
            </div>
            <div className="form-group">
              <label>Nível Técnico</label>
              <select value={atleta.nivelTecnico} onChange={e => setAtleta({ ...atleta, nivelTecnico: e.target.value as any })}>
                <option value="iniciante">Iniciante / Amador</option>
                <option value="intermediario">Intermediário</option>
                <option value="avancado">Avançado / Elite</option>
              </select>
            </div>
          </div>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 0, marginTop: '15px' }}>
            <div className="form-group">
              <label>Envergadura (m)</label>
              <input type="number" step="0.01" value={atleta.envergadura} onChange={e => setAtleta({ ...atleta, envergadura: Number(e.target.value) })} />
            </div>
            <div className="form-group">
              <label>Alt. Perna (m)</label>
              <input type="number" step="0.01" value={atleta.perna} onChange={e => setAtleta({ ...atleta, perna: Number(e.target.value) })} />
            </div>
          </div>
          <div className="form-group" style={{ marginTop: '15px' }}>
            <label>% Gordura Corporal (BF)</label>
            <input type="number" step="0.1" value={atleta.bf} onChange={e => setAtleta({ ...atleta, bf: Number(e.target.value) })} />
          </div>
          <div className="form-group" style={{ marginTop: '15px' }}>
            <label>Transição/Descanso Total (seg)</label>
            <input type="number" value={tempoDescanso} onChange={e => setTempoDescanso(Number(e.target.value))} />
          </div>
        </div>
      </div>

      {/* Navegação entre Abas */}
      <div className="tabs">
        <button className={`tab-btn ${activeTab === 'prescricao' ? 'active' : ''}`} onClick={() => setActiveTab('prescricao')}>1. Lousa (Prescrição)</button>
        <button className={`tab-btn ${activeTab === 'analise' ? 'active' : ''}`} onClick={() => setActiveTab('analise')}>2. Execução (Análise)</button>
      </div>

      {/* Aba Prescrição */}
      {activeTab === 'prescricao' && (
        <div className="panel">
          <h2>Quadro de Movimentos (O que foi prescrito)</h2>
          <button className="btn-add" onClick={() => addMovimento()}>+ Adicionar Exercício</button>
          
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
                        {Object.entries(movimentosDB).map(([k, v]) => (
                          <option key={k} value={k}>{v.nome}</option>
                        ))}
                      </select>
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
                    <label>{cfg.paramExtra ? cfg.paramExtra.label : 'Param.'}</label>
                    <input type="text" disabled={!cfg.paramExtra} value={item.extraVal} onChange={e => updateMovimento(item.originalId, 'extraVal', e.target.value)} />
                  </div>

                  <div className="actions-col">
                    <button className="btn-action" onClick={() => addMovimento(item.originalId)} title="Duplicar">📋</button>
                    <button className="btn-remove" onClick={() => removeMovimento(item.originalId)}>X</button>
                  </div>
                </div>
              );
            })}
          </div>

          <h2>Importar / Exportar Lousa & Nuvem</h2>
          <textarea rows={3} value={jsonInOut} onChange={e => setJsonInOut(e.target.value)} placeholder="{ ... código JSON do WOD ... }" />
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button onClick={exportarJSON} style={{ backgroundColor: '#444' }}>Exportar JSON</button>
            <button onClick={importarJSON} style={{ backgroundColor: '#388e3c' }}>Importar JSON</button>
            <button onClick={salvarNoSupabase} style={{ backgroundColor: '#1976d2' }}>Salvar no Supabase</button>
          </div>

          {savedWods.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <h3>Treinos Salvos na Nuvem</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {savedWods.map(w => (
                  <div key={w.id} style={{ background: '#2c2c2c', padding: '10px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span><strong>{w.title}</strong> ({w.tipo_treino}) - {new Date(w.created_at || '').toLocaleDateString()}</span>
                    <button onClick={() => carregarDoSupabase(w)} style={{ width: 'auto', padding: '5px 15px', backgroundColor: '#388e3c' }}>Carregar</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Aba Análise */}
      {activeTab === 'analise' && (
        <div className="panel">
          <h2>Timeline Expandida (O que foi executado)</h2>
          <div className="wod-list">
            {(() => {
              let rTimeline = (tipoTreino === 'FOR_TIME') ? roundsPrescritos : Math.ceil(roundsReal);
              if (rTimeline < 1) rTimeline = 1;

              const rows: JSX.Element[] = [];

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
                        {m.carga > 0 ? `${m.carga}kg (${m.tecnica})` : ''} {m.extraVal ? `| ${m.extraVal}` : ''}
                      </div>
                    </div>
                    <div>
                      <label>Reps</label>
                      <input type="number" value={st.reps} onChange={e => handleTimelineChange(rowId, 'reps', Number(e.target.value))} />
                    </div>
                    <div>
                      <label>Início</label>
                      <input type="text" placeholder="mm:ss" value={st.start} onChange={e => handleTimelineChange(rowId, 'start', e.target.value)} />
                    </div>
                    <div>
                      <label>Fim</label>
                      <input type="text" placeholder="mm:ss" value={st.end} onChange={e => handleTimelineChange(rowId, 'end', e.target.value)} />
                    </div>
                  </div>
                );
              };

              lousa.filter(m => m.phase === 'buyin').forEach(m => renderRow(m, 'badge-buyin', 'Buy-in', 0));
              for (let r = 1; r <= rTimeline; r++) {
                lousa.filter(m => m.phase === 'round').forEach(m => renderRow(m, '', `R ${r}`, r));
              }
              lousa.filter(m => m.phase === 'cashout').forEach(m => renderRow(m, 'badge-cashout', 'Cash-out', 99));

              return rows;
            })()}
          </div>

          <button onClick={processarWOD} style={{ fontSize: '1.1rem', padding: '15px' }}>Processar Dinâmica e Termodinâmica</button>

          {resultado && (
            <div className="results">
              <h2>Painel de Resultado Biomecânico</h2>
              <div className="grid" style={{ marginBottom: 0 }}>
                <div style={{ margin: '15px 0' }}>
                  <div className="result-value color-mech">{resultado.trabalhoReal.toFixed(0)} J</div>
                  <div>Trabalho Mecânico Corrigido</div>
                </div>
                <div style={{ margin: '15px 0' }}>
                  <div className="result-value color-metabolic">{resultado.gastoMetabolico.toFixed(0)} kCal</div>
                  <div>Gasto Termodinâmico (+ EPOC)</div>
                </div>
                <div style={{ margin: '15px 0' }}>
                  <div className="result-value" style={{ color: '#aaa' }}>{resultado.potenciaEsp > 0 ? resultado.potenciaEsp.toFixed(1) + ' W' : '-- W'}</div>
                  <div>Potência Esperada</div>
                </div>
                <div style={{ margin: '15px 0' }}>
                  <div className="result-value" style={{ color: '#4caf50' }}>{resultado.potenciaReal > 0 ? resultado.potenciaReal.toFixed(1) + ' W' : '-- W'}</div>
                  <div>Potência Real Executada</div>
                </div>
              </div>
              <div className="result-detail" dangerouslySetInnerHTML={{ __html: resultado.logDetalhesHTML }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}