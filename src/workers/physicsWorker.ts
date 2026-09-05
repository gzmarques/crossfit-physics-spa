import { movimentosDB } from '../data/movements';
import { calcularFisica } from '../utils/physicsEngine';
import { parseClockTime } from '../utils/mathHelpers';

// Função auxiliar movida do hook para o worker
const getCargaPorSexo = (m: any, atleta: any) => {
  const cM = m.cargaMasc !== undefined ? m.cargaMasc : (m.carga || 0);
  const cF = m.cargaFem !== undefined ? m.cargaFem : (m.carga || 0);
  return atleta?.sexo === 'F' ? cF : cM;
};

self.onmessage = (event) => {
  const {
    tipoTreino, tempoAlvo, tempoReal, roundsPrescritos, roundsReal,
    lousa, atleta, timelineState, temperatura, umidade
  } = event.data;

  const rawTempoAlvo = parseClockTime(tempoAlvo);
  const tAlvoSec = rawTempoAlvo > 0 ? rawTempoAlvo : 0;
  const rawTempoReal = parseClockTime(tempoReal);
  const tRealSec = rawTempoReal > 0 ? rawTempoReal : 0;

  const ffm = (atleta?.peso || 80) * (1.0 - ((atleta?.bf || 15) / 100.0));
  const bmrDia = 370.0 + (21.6 * ffm);
  const bmrSec = bmrDia / 86400.0;

  let trabalhoMechTotalEsp = 0;
  lousa.forEach((m: any) => {
    const cfg = movimentosDB[m.movId];
    if (!cfg) return;
    const mult = (m.phase === 'round') ? (roundsPrescritos || 1) : 1;
    
    const cargaAdaptada = getCargaPorSexo(m, atleta);
    const calc = calcularFisica(m.movId, cfg, m.reps, cargaAdaptada, m.extraVal, m.extraVal2 || '', atleta, m.tecnica, 0);
    const trab = calc?.trabMech || 0;
    trabalhoMechTotalEsp += trab * mult;
  });

  let roundsTimeline = (tipoTreino === 'FOR_TIME') ? (roundsPrescritos || 1) : Math.ceil(roundsReal || 1);
  if (roundsTimeline < 1) roundsTimeline = 1;

  const flatItems: any[] = [];
  lousa.filter((m: any) => m.phase === 'buyin').forEach((m: any) => flatItems.push({ rowId: `${m.originalId}-R0`, movId: m.movId, reps: m.reps, cargaOriginalMasc: m.cargaMasc, cargaOriginalFem: m.cargaFem, cargaAntiga: m.carga, extraVal: m.extraVal, extraVal2: m.extraVal2, phase: 'buyin', tecnica: m.tecnica, badgeText: 'Buy-in', badgeClass: 'badge-buyin' }));
  for (let r = 1; r <= roundsTimeline; r++) lousa.filter((m: any) => m.phase === 'round').forEach((m: any) => flatItems.push({ rowId: `${m.originalId}-R${r}`, movId: m.movId, reps: m.reps, cargaOriginalMasc: m.cargaMasc, cargaOriginalFem: m.cargaFem, cargaAntiga: m.carga, extraVal: m.extraVal, extraVal2: m.extraVal2, phase: 'round', tecnica: m.tecnica, badgeText: `R ${r}`, badgeClass: '' }));
  lousa.filter((m: any) => m.phase === 'cashout').forEach((m: any) => flatItems.push({ rowId: `${m.originalId}-R99`, movId: m.movId, reps: m.reps, cargaOriginalMasc: m.cargaMasc, cargaOriginalFem: m.cargaFem, cargaAntiga: m.carga, extraVal: m.extraVal, extraVal2: m.extraVal2, phase: 'cashout', tecnica: m.tecnica, badgeText: 'Cash-out', badgeClass: 'badge-cashout' }));

  let somaTempoDeterminadoGlobal = 0, totalTransicaoGlobal = 0, trabalhoMechTotalReal = 0, gastoMetabolicoLiquidoTotal = 0, metabolicoRestanteGlobal = 0, lastEndSec = -1;
  let tempoDecorridoEstimado = 0; 
  
  const itemsProcessados: any[] = [];

  flatItems.forEach((row: any) => {
    const config = movimentosDB[row.movId] || movimentosDB['air_squat']; 
    const state = timelineState[row.rowId] || { reps: row.reps, start: '', end: '' };
    const repsEffective = state.reps !== undefined ? Number(state.reps) : (row.reps || 0);
    
    const baseCarga = getCargaPorSexo({ cargaMasc: row.cargaOriginalMasc, cargaFem: row.cargaOriginalFem, carga: row.cargaAntiga } as any, atleta);
    const cargaEffective = state.cargaUsada !== undefined ? Number(state.cargaUsada) : baseCarga;
    const extraEffective = state.extraValUsado !== undefined ? String(state.extraValUsado) : String(row.extraVal || '');

    const startSec = parseClockTime(state.start);
    const endSec = parseClockTime(state.end);
    const tempoDefinitivoTemp = (startSec >= 0 && endSec > startSec) ? (endSec - startSec) : 0;
    
    const calc = calcularFisica(row.movId, config, repsEffective, cargaEffective, extraEffective, row.extraVal2, atleta, row.tecnica, tempoDefinitivoTemp, tempoDecorridoEstimado) || {};

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
  
  const refTempoEstimado = tempoTotalReferencia > 0 ? tempoTotalReferencia : tAlvoSec;
  const tempoLiquidoEstimado = Math.max(1, refTempoEstimado - totalTransicaoGlobal);
  const potRealEstimada = tempoLiquidoEstimado > 0 ? (trabalhoMechTotalReal / tempoLiquidoEstimado) : 0;
  const limiarPotencia = potRealEstimada / (atleta?.peso || 80);

  // Fator Climático com Umidade (Implementado na Fase 1)
  let fatorClimatico = 1.0 + ((temperatura - 20) * 0.015);
  if (temperatura > 20 && umidade > 50) {
    const penalidadeUmidade = (umidade - 50) * 0.003;
    fatorClimatico += penalidadeUmidade;
  }
  
  const fatorEPOC = 1.0 + ((0.40 / (1.0 + Math.exp(-1.5 * (limiarPotencia - 3.5)))) * fatorClimatico);

  let logDetalhes = "", lastPhase: string | null = null;
  let tempoTotalExecucaoEfetiva = 0;

  itemsProcessados.forEach((item: any) => {
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

  // Envia a resposta final de volta para a Main Thread
  self.postMessage({ 
    trabalhoReal: trabalhoMechTotalReal || 0, 
    gastoMetabolico: gastoMetabolicoFinal || 0, 
    potenciaEsp: potEsp || 0, 
    potenciaReal: potReal || 0, 
    logDetalhesHTML: logDetalhes 
  });
};