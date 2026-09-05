import type { AtletaPerfil, MovimentoConfig } from '../types';
import { G } from './mathHelpers';
import type { CorpoFisico } from './biomechanics';

export interface ThermoContext {
  movId: string;
  cfg: MovimentoConfig;
  tecnica: string;
  atleta: AtletaPerfil;
  corpo: CorpoFisico;
  pCarga: number;
  extraV: string;
  extraV2: string;
  extra: number;
  extraSafe: number;
  safeReps: number;
  deltaT: number;
  tempoAcumulado: number;
  tMechInicial: number;
  P: number;
  sErgo: number;
  isCalorieErgo: boolean;
  energiaCineticaBarra: number;
}

export function calcularGastoMetabolico(ctx: ThermoContext) {
  let { tMechInicial: tMech } = ctx;
  const {
    movId, cfg, tecnica, atleta, corpo, pCarga, extraV, extraV2,
    extra, extraSafe, safeReps, deltaT, tempoAcumulado, P, sErgo, isCalorieErgo, energiaCineticaBarra
  } = ctx;

  const { L_arm, L_trunk, m_sup } = corpo;

  // --- 1. FATORES DE FADIGA CELULAR ---
  let fTec = 1.0;
  let kDegradacao = 0.00015;
  if (atleta.nivelTecnico === 'iniciante') { fTec = 0.85; kDegradacao = 0.00025; }
  if (atleta.nivelTecnico === 'avancado') { fTec = 1.10; kDegradacao = 0.00008; }

  let idadeAtual = 0;
  if (atleta.usaAntropometriaAvancada && atleta.dataNascimento) {
      const hoje = new Date();
      const nascimento = new Date(atleta.dataNascimento);
      idadeAtual = hoje.getFullYear() - nascimento.getFullYear();
      const m = hoje.getMonth() - nascimento.getMonth();
      if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) idadeAtual--;
      if (idadeAtual > 30) kDegradacao *= (1.0 + ((idadeAtual - 30) * 0.015));
  }

  const limite_eficiencia = 0.70;
  fTec = limite_eficiencia + (fTec - limite_eficiencia) * Math.exp(-kDegradacao * tempoAcumulado);

  // --- 2. FATOR SSC (Ciclo Alongamento-Encurtamento) ---
  let fatorSSC = 1.0;
  const categoriasSalto = ['burpee_box_jump', 'burpee_high_box_jump', 'burpee_box_jump_over', 'burpee_high_box_jump_over', 'box_jump', 'high_box_jump', 'box_jump_over', 'high_box_jump_over'];
  
  if (categoriasSalto.includes(cfg.categoria)) {
      const poupancaElastica = 0.18 * Math.exp(-kDegradacao * tempoAcumulado);
      fatorSSC = 1.0 - poupancaElastica;
  }

  // Aplica a degradação elástica no trabalho mecânico bruto
  tMech = tMech * fatorSSC;
  const dissipacaoExcentricaGRF = energiaCineticaBarra * 0.15;

  // --- 3. ROTEAÇÃO METABÓLICA ---
  let tMetWork = 0, tMetWorkConcIsom = 0;

  if (cfg.categoria === 'shuttle_run') { 
      tMetWork = atleta.peso * (extraSafe / 1000.0) * (1.0 + (12.5 / extraSafe)); 
      tMetWorkConcIsom = tMetWork; 
  } else if (cfg.categoria === 'corrida' || cfg.categoria === 'run') { 
      tMetWork = 0.90 * atleta.peso * (extraSafe / 1000.0); 
      tMetWorkConcIsom = tMetWork; 
  } else if (cfg.categoria === 'air_runner') { 
      tMetWork = 1.32 * (0.90 * atleta.peso * (extraSafe / 1000.0)); 
      tMetWorkConcIsom = tMetWork; 
  } else if (cfg.categoria === 'corrida_carga' || cfg.categoria === 'yoke_carry') { 
      const distanciaDinamica = safeReps; 
      const eta = Number(extraV) || 1.0;  
      const W = atleta.peso; 
      const L = pCarga;      
      const V = deltaT > 0 ? (distanciaDinamica / deltaT) : 1.2; 
      const G_grade = 0; 
      const kAssimetria = cfg.categoria === 'yoke_carry' ? 1.30 : 1.20; 
      const custoBasal = 1.5 * W;
      const penalidadeCarga = 2.0 * (W + L) * Math.pow(L / Math.max(1, W), 2);
      const custoTranslacao = eta * (W + L) * (1.5 * Math.pow(V, 2) + 0.35 * V * G_grade);
      
      let correcaoSantee = 0;
      if (G_grade < 0) correcaoSantee = eta * (W + L) * ((V * G_grade * 0.35) - (Math.pow(V * G_grade, 2) / W));
      const M_watts = kAssimetria * (custoBasal + penalidadeCarga + custoTranslacao + correcaoSantee);
      const tempoExecucao = deltaT > 0 ? deltaT : (distanciaDinamica / V);
      
      const trabalhoMetabolicoTotal = (M_watts * tempoExecucao) / 4184.0;
      tMetWork = trabalhoMetabolicoTotal / safeReps; 
      tMetWorkConcIsom = tMetWork;
  } else if (['remo', 'bike'].includes(cfg.categoria)) { 
      if (isCalorieErgo) { 
          tMetWork = parseFloat(extraV) / safeReps; 
          tMetWorkConcIsom = tMetWork; 
      } else { 
          tMetWork = ((4.0 * P * 0.8604) / 3600.0) * sErgo; 
          tMetWorkConcIsom = tMetWork; 
      }
  } else if (['echo_bike', 'assault_bike'].includes(cfg.categoria)) { 
      tMetWork = (4.0 * P * sErgo) / 4184.0; 
      tMetWorkConcIsom = tMetWork; 
  } else {
      let eta_conc = 0.22 * fTec; 
      let eta_exc = 1.10; 
      let W_exc_ratio = 0.0; 
      let E_isom = 0.0;      
      
      const cA = ['burpee_broad_jump','burpee_box_jump','burpee_box_jump_over','burpee_over_obj',
                  'burpee_pullup','vertical_hibrido','vertical_hibrido_extra','wall_ball',
                  'squat_bw','box_step_up', 'box_jump', 'box_jump_over','lunge_bw',
                  'lunge_carga', 'alavanca_parcial', 'alavanca_horizontal', 'core_situp', 
                  'core_vup', 'core_ghd', 'core_t2b', 'core_k2e', 'box_step_over']; 

      if (cfg.grupo === 'Corda') eta_conc = 0.45 * fTec;
      else if (cfg.categoria === 'pegboard') eta_conc = 0.06 * fTec;
      else if (movId === 'rmu' && tecnica === 'strict') eta_conc = 0.07 * fTec;
      else if (cfg.categoria === 'wf_hspu') eta_conc = 0.08 * fTec;
      else if (['handstand_walk','wall_walk', 'hs_incline_up', 'hs_incline_down'].includes(cfg.categoria)) eta_conc = 0.08 * fTec;
      else if ((movId === 'bmu' || movId === 'ring_dip') && tecnica === 'strict') eta_conc = 0.08 * fTec;
      else if (cfg.categoria === 'pullover') eta_conc = 0.09 * fTec;
      else if (tecnica === 'strict' && (cfg.categoria === 'vertical_bw' || cfg.categoria === 'core_t2b' || cfg.categoria === 'core_k2e' || cfg.categoria === 'alavanca_inferior')) eta_conc = 0.10 * fTec;
      
      // --- MATEMÁTICA LABORATORIAL DA FASE 3 ---
      else if (tecnica === 'butterfly' || (tecnica === 'kipping' && cfg.categoria === 'vertical_bw')) {
          const raioPendulo = L_arm + (L_trunk * 0.50);
          const momentoInercia = m_sup * Math.pow(raioPendulo, 2);
          const omegaRad = tecnica === 'butterfly' ? 3.8 : 2.5;
          const energiaRotacional = 0.5 * momentoInercia * Math.pow(omegaRad, 2);
          
          tMech = Math.max(tMech * 0.10, tMech - energiaRotacional);
          eta_conc = 0.18 * fTec;
      }
      else if (tecnica === 'kipping' && (cfg.categoria === 'core_t2b' || cfg.categoria === 'core_k2e' || cfg.categoria === 'alavanca_inferior')) {
          eta_conc = 0.12 * fTec;
      }
      else if (cfg.categoria === 'devil_press' || movId === 'overhead_squat' || cfg.categoria === 'core_ghd' || cfg.categoria === 'sandbag_clean') eta_conc = 0.12 * fTec;
      else if (cfg.categoria === 'dball_shoulder') eta_conc = 0.11 * fTec;
      else if (cfg.categoria === 'rope_climb' || cfg.categoria === 'rope_ascend_floor') eta_conc = 0.15 * fTec;
      else if (cfg.categoria.includes('lpo_') || cfg.categoria.includes('db_') || cA.includes(cfg.categoria)) eta_conc = 0.16 * fTec;
      else if (cfg.categoria.includes('friccao_horizontal')) eta_conc = 0.15 * fTec;

      if (tecnica === 'strict' && (cfg.categoria === 'vertical_bw' || cfg.categoria === 'core_t2b' || cfg.categoria === 'core_k2e' || cfg.categoria === 'alavanca_inferior')) { 
          W_exc_ratio = 0.40; 
      } else if (tecnica === 'butterfly') { 
          W_exc_ratio = 0.05; 
      } else if (tecnica === 'kipping' && (cfg.categoria === 'vertical_bw' || cfg.categoria === 'core_t2b' || cfg.categoria === 'core_k2e' || cfg.categoria === 'alavanca_inferior')) { 
          W_exc_ratio = 0.20; 
      } else if (cA.includes(cfg.categoria) || cfg.categoria === 'wall_ball' || ['overhead_squat','sandbag_clean','devil_press'].includes(movId)) { 
          W_exc_ratio = 0.35; 
      } else if (cfg.categoria === 'burpee_broad_jump') { 
          W_exc_ratio = 0.60; 
      } else if (['turkish_get_up', 'free_hspu', 'rmu'].includes(movId) || cfg.categoria === 'core_ghd' || movId.includes('ring_')) { 
          W_exc_ratio = 0.45; 
      } else if (cfg.categoria.includes('lpo_hang') || cfg.categoria.includes('lpo_floor') || cfg.categoria.includes('lpo_cj') || cfg.categoria.includes('db_') || movId === 'deadlift') { 
          W_exc_ratio = (tecnica === 'drop') ? 0.00 : 0.40; 
      }

      const tut_default = deltaT > 0 ? deltaT : 3.0; 
      if (['pegboard', 'hs_walk', 'wall_walk', 'hs_incline_up', 'hs_incline_down'].includes(cfg.categoria)) { 
          E_isom = (tMech > 0 ? tMech : atleta.peso * G * 0.50) * tut_default * 0.80; 
      } else if (movId === 'rmu') { 
          E_isom = tMech * tut_default * 0.40; 
      } else if (['overhead_squat', 'turkish_get_up'].includes(movId) || cfg.categoria === 'core_t2b' || cfg.categoria === 'core_ghd') { 
          E_isom = tMech * tut_default * 0.30; 
      } else if (cfg.categoria.includes('friccao_horizontal')) { 
          E_isom = tMech * tut_default * 0.40; 
      }

      if (cfg.isInstavel) {
          eta_conc *= 0.85; 
          E_isom += (pCarga * G * L_arm) * tut_default * 0.40; 
      }

      if (['deadlift', 'corrida_carga', 'arc_carga', 'arc_carga_parcial'].includes(cfg.categoria)) {
          let diametroPega = cfg.categoria === 'deadlift' ? extra : Number(extraV2);
          if (!diametroPega || diametroPega <= 0) {
              diametroPega = 28 + (pCarga * 0.3);
          }
          if (diametroPega > 28) {
              const penalidadeGrip = 1.0 + ((diametroPega - 28) * 0.05); 
              E_isom += (pCarga * G * 0.10) * tut_default * penalidadeGrip;
          }
      }

      const W_conc = tMech; 
      const W_exc = tMech * W_exc_ratio;
      const E_met_conc = W_conc / (Math.max(0.01, eta_conc) * 4184.0);
      
      const custoExtraGRF = (cfg.categoria.includes('lpo_') || cfg.categoria.includes('db_') || cfg.categoria === 'deadlift') ? dissipacaoExcentricaGRF : 0;
      const E_met_exc = (W_exc + custoExtraGRF) / (eta_exc * 4184.0);
      const E_met_isom = E_isom / 4184.0;
      const CP = atleta.peso * (atleta.nivelTecnico === 'avancado' ? 4.5 : atleta.nivelTecnico === 'intermediario' ? 3.0 : 2.0);
      const tut_metabolico = deltaT > 0 ? deltaT : 3.0;
      const potencia_execucao = (W_conc + W_exc + E_isom) / tut_metabolico;
      
      let W_prime_expenditure = 0;
      if (potencia_execucao > CP) {
          W_prime_expenditure = (potencia_execucao - CP) * tut_metabolico;
      }
      
      const custoExtraMetabolicoWPrime = W_prime_expenditure / 4184.0;
      tMetWork = E_met_conc + E_met_exc + E_met_isom + (custoExtraMetabolicoWPrime * 1.25);
      tMetWorkConcIsom = E_met_conc + E_met_isom + (custoExtraMetabolicoWPrime * 1.25);
  }

  return { tMechFinal: tMech, tMetWork, tMetWorkConcIsom };
}