import type { MovimentoConfig, AtletaPerfil } from '../types';
import { G, MASSA_SLED, getAlturaCaixaMetros } from './mathHelpers';
import type { CorpoFisico } from './biomechanics';

export interface KinematicsContext {
  movId: string;
  cfg: MovimentoConfig;
  pCarga: number;
  extraV: string;
  extraV2: string;
  extra: number;
  extraSafe: number;
  safeReps: number;
  atleta: AtletaPerfil;
  corpo: CorpoFisico;
  energiaCineticaBarra: number;
  W_squat_body: number;
}

export interface KinematicsResult {
  tMech: number;
  exL: string;
  P: number;
  isErgo: boolean;
  isCalorieErgo: boolean;
}

export function calcularTrabalhoMecanico(ctx: KinematicsContext): KinematicsResult {
  const {
    movId, cfg, pCarga, extraV, extraV2, extra, extraSafe, safeReps,
    atleta, corpo, energiaCineticaBarra, W_squat_body
  } = ctx;

  const { 
    isM, L_arm, L_perna, L_thigh, L_shank, L_trunk, 
    m_sup, m_arms, m_thigh, m_shank_foot, 
    altCoM, h_puxao 
  } = corpo;

  let tMech = 0, exL = "", P = 0, isErgo = false, isCalorieErgo = false;

  // A variável 'des' original do código
  const des = (cfg.paramExtra && cfg.categoria.includes('vertical_bw_total') && extra > 0) 
              ? extra : (atleta.estatura * (cfg.fatorH || 0.40));

  switch(cfg.categoria) {
      case 'deadlift': 
          tMech = (pCarga * G * Math.max(0.05, L_perna - 0.225)) + (m_sup * G * (L_trunk * 0.35)); 
          break;
      case 'bench_press': 
          tMech = pCarga * G * (L_arm * 0.82); 
          break;
      case 'db_press':
          tMech = pCarga * G * L_arm;
          break;
      case 'wall_ball': {
          let h_alvo = isM ? 3.05 : 2.74; // Padrões base

          // Verifica se o usuário digitou M/F com barra (ex: "3.35/3.05")
          if (extraV && extraV.toString().includes('/')) {
              const partes = extraV.toString().split('/');
              h_alvo = isM ? (Number(partes[0].trim().replace(',', '.')) || 3.05) 
                           : (Number(partes[1].trim().replace(',', '.')) || 2.74);
          } else if (extra > 0) {
              h_alvo = extra; // Se digitou um número só, aplica para todos
          }

          const h_fundo = Math.max(0, atleta.estatura - (0.5 * L_trunk) - L_thigh);
          tMech = W_squat_body + (pCarga * G * Math.max(0, h_alvo - h_fundo)); 
          exL = ` (${h_alvo.toFixed(2)}m)`; 
          break;
      }

      // ============================================================================
      // BLOCO UNIVERSAL DE SALTOS, SUBIDAS E VARIAÇÕES DE CAIXA
      // ============================================================================
      case 'box_jump':
      case 'box_jump_over':
      case 'box_step_up':
      case 'step_up':
      case 'db_step_up':
      case 'double_db_step_up':
      case 'kb_step_up':
      case 'weighted_step_up':
      case 'box_step_over':
      case 'step_over':
      case 'db_step_over':
      case 'double_db_step_over':
      case 'kb_step_over':
      case 'burpee_box_jump':
      case 'burpee_box_jump_over':
      case 'box_facing_burpee_box_jump_over':
      case 'burpee_box_step_up':
      case 'burpee_box_step_over': {
          // 1. Constantes Biomecânicas e de Conversão
          const h_caixa = getAlturaCaixaMetros(extra, isM);
          const h_fundo_jump = 0.20; // Pouso padrão em semi-squat no salto
          const desconto_crouch = 0.35; // Economia de ROM nos movimentos "Over"
          const W_pushup_body = atleta.peso * G * (L_arm * 0.65);
          const W_burpee = W_squat_body + (W_pushup_body * 1.2); 
          const W_rotacao = atleta.peso * G * 0.15; // Custo de torção/giro no "Facing"
          const cargaTotal = atleta.peso + pCarga; // Absorve BW e variações com peso
          
          // 2. Roteamento Termodinâmico
          if (movId === 'box_jump') {
              tMech = cargaTotal * G * Math.max(0, h_caixa - h_fundo_jump);
          } 
          else if (['box_jump_over'].includes(movId)) {
              tMech = cargaTotal * G * Math.max(0.10, h_caixa - desconto_crouch);
          } 
          else if (['box_step_up', 'step_up', 'db_step_up', 'double_db_step_up', 'kb_step_up', 'weighted_step_up'].includes(movId)) {
              tMech = cargaTotal * G * h_caixa;
          } 
          else if (['box_step_over', 'step_over', 'db_step_over', 'double_db_step_over', 'kb_step_over'].includes(movId)) {
              tMech = cargaTotal * G * Math.max(0.10, h_caixa - desconto_crouch);
          } 
          else if (movId === 'burpee_box_jump') {
              tMech = W_burpee + (cargaTotal * G * Math.max(0, h_caixa - h_fundo_jump));
          } 
          else if (movId === 'burpee_box_jump_over') {
              tMech = W_burpee + (cargaTotal * G * Math.max(0.10, h_caixa - desconto_crouch));
          } 
          else if (movId === 'box_facing_burpee_box_jump_over') {
              tMech = W_burpee + (cargaTotal * G * Math.max(0.10, h_caixa - desconto_crouch)) + W_rotacao;
          } 
          else if (movId === 'burpee_box_step_up') {
              tMech = W_burpee + (cargaTotal * G * h_caixa);
          } 
          else if (movId === 'burpee_box_step_over') {
              tMech = W_burpee + (cargaTotal * G * Math.max(0.10, h_caixa - desconto_crouch));
          }

          // 3. Formatação da UI
          exL = ` (${(h_caixa / 0.0254).toFixed(0)}")`;
          break;
      }
      case 'lpo_floor_squat': 
          tMech = (pCarga * G * h_puxao) + energiaCineticaBarra + W_squat_body + (pCarga * G * L_thigh); 
          break;
      case 'lpo_floor_power': 
          tMech = (W_squat_body * 0.30) + energiaCineticaBarra + (pCarga * G * (atleta.estatura * (cfg.fatorH || 0.85))); 
          break;
      case 'lpo_hang_squat': 
          tMech = (pCarga * G * Math.max(0.1, h_puxao - L_shank)) + energiaCineticaBarra + W_squat_body + (pCarga * G * L_thigh); 
          break;
      case 'lpo_hang_power': 
          tMech = (W_squat_body * 0.30) + energiaCineticaBarra + (pCarga * G * Math.max(0.1, (atleta.estatura * (cfg.fatorH || 0.60)) - L_shank)); 
          break;
      case 'lpo_cj': 
          tMech = (pCarga * G * h_puxao) + energiaCineticaBarra + W_squat_body + (pCarga * G * L_thigh) + 
                  (pCarga * G * L_arm) + (atleta.peso * G * (L_thigh * 0.30)); 
          break;
      case 'lpo_hang_cj': 
          tMech = (pCarga * G * Math.max(0.1, h_puxao - L_shank)) + energiaCineticaBarra + W_squat_body + (pCarga * G * L_thigh) + 
                  (pCarga * G * L_arm) + (atleta.peso * G * (L_thigh * 0.30)); 
          break;
      case 'lpo_jerk': 
          if (movId === 'push_jerk' || movId === 'db_jerk') {
              tMech = (pCarga * G * (0.65 * L_arm)) + (atleta.peso * G * (L_thigh * 0.50));
          } else {
              tMech = (pCarga * G * L_arm) + (atleta.peso * G * (L_thigh * 0.30)); 
          }
          break;
      
      case 'db_cj': 
          tMech = ((W_squat_body * 0.30) + (pCarga * G * (atleta.estatura * 0.85)) + energiaCineticaBarra) + 
                  ((pCarga * G * L_arm) + (atleta.peso * G * (L_thigh * 0.30))); 
          break;
      case 'db_hang_cj': 
          tMech = ((W_squat_body * 0.30) + (pCarga * G * Math.max(0.1, (atleta.estatura * 0.85) - L_shank)) + energiaCineticaBarra) + 
                  ((pCarga * G * L_arm) + (atleta.peso * G * (L_thigh * 0.30))); 
          break;

      case 'sandbag_clean': 
          tMech = (pCarga * G * h_puxao) + energiaCineticaBarra + (W_squat_body * 0.60); 
          break;
      case 'dball_shoulder': {
          const dball_D = extra > 0 ? extra : 0.35;
          tMech = (pCarga * G * (atleta.estatura * 0.82 + dball_D * 0.50)) + W_squat_body + (m_sup * G * (L_trunk * 0.30)); 
          exL = ` (${dball_D.toFixed(2)}m D)`; 
          break;
      }
      case 'devil_press': 
          tMech = ((atleta.peso - m_arms) * G * L_arm) + (atleta.peso * G * altCoM) + (pCarga * G * (atleta.estatura * 1.10)); 
          break;
      case 'tgu': 
          tMech = (pCarga * G * (atleta.estatura * 1.10)) + (atleta.peso * G * (altCoM * 1.20)); 
          break;
      
      case 'alavanca_parcial': {
          const h_glen = atleta.estatura * 0.82; 
          const h_tor = atleta.estatura * 0.05;
          const proporcaoAlavanca = Math.min(0.85, Math.max(0.50, (altCoM - h_tor) / (h_glen - h_tor)));
          tMech = (atleta.peso * proporcaoAlavanca) * G * L_arm; 
          break;
      }
      case 'alavanca_horizontal': 
          tMech = m_sup * G * L_arm; 
          break;
      case 'alavanca_inferior': 
          tMech = (m_thigh + m_shank_foot) * G * L_thigh; 
          break;
      
      case 'vertical_bw': 
          tMech = (atleta.peso - m_arms) * G * L_arm; 
          break;
      case 'wf_hspu': 
      case 'free_hspu': 
          tMech = (atleta.peso * 0.95) * G * (L_arm * 0.90); 
          break;

      case 'vertical_bw_total': 
          // Atualizado para a nova nomenclatura raiz
          if (['bmu', 'rmu'].includes(movId)) {
              tMech = atleta.peso * G * (2.0 * L_arm + (L_trunk * 0.50));
          } else if (cfg.grupo === 'Corda') { 
              tMech = atleta.peso * G * des; 
              
              // NOVO: Adição do custo mecânico e fadiga isométrica dos Crossovers
              // A massa dos braços precisa ser violentamente deslocada num arco cruzado
              if (movId.includes('crossover')) {
                  tMech += (m_arms * G * (L_arm * 1.20));
              }
              exL = ` (Salto ${des.toFixed(2)}m)`; 
          } else {
              tMech = atleta.peso * G * (L_arm + (L_trunk * 0.50)); 
          }
          break;
      case 'pullover': 
          tMech = atleta.peso * G * (altCoM + 2.0 * L_arm); 
          break;

      case 'squat_bw': 
          tMech = W_squat_body; 
          break;
      case 'squat_carga': 
          tMech = W_squat_body + (pCarga * G * L_thigh); 
          break;
      case 'lunge_bw': 
          tMech = atleta.peso * G * (L_thigh * 0.85); 
          break;
      case 'lunge_carga': 
          tMech = (atleta.peso + pCarga) * G * (L_thigh * 0.85); 
          break;
      case 'hinge_carga': 
      case 'arc_carga': {
          // O raio do KB aumenta ~1.5mm por cada kg adicional, partindo de uma base de 10cm do punho
          const raioKB = 0.10 + (pCarga * 0.0015);
          tMech = pCarga * G * ((atleta.estatura * 0.55) + raioKB); 
          break;
      }
      case 'arc_carga_parcial': {
          const raioKB = 0.10 + (pCarga * 0.0015);
          tMech = pCarga * G * ((atleta.estatura * 0.35) + raioKB); 
          break;
      }

      case 'core_situp':
          tMech = m_sup * G * (L_trunk * 0.45) * Math.sin(75 * Math.PI / 180); 
          break;
      case 'core_vup': 
          tMech = (m_sup * G * (L_trunk * 0.45) * Math.sin(60 * Math.PI / 180)) + 
                  ((m_thigh + m_shank_foot) * G * (L_perna * 0.45) * Math.sin(60 * Math.PI / 180)); 
          break;
      case 'core_ghd': 
          tMech = m_sup * G * (L_trunk * 0.45) * (Math.sin(75 * Math.PI / 180) - Math.sin(-15 * Math.PI / 180)); 
          break;
      case 'core_t2b': 
          tMech = (m_thigh + m_shank_foot) * G * (L_perna * 0.45) * 2.0; 
          break;
      case 'core_k2e': 
          tMech = (m_thigh + m_shank_foot) * G * (L_thigh * 0.60) * 2.0; 
          break;
      
      case 'wall_walk': 
          tMech = ((atleta.peso - m_arms) * G * L_arm) + (atleta.peso * G * (altCoM * 1.20)); 
          break;
      case 'hs_walk': 
          tMech = (atleta.peso * G * 0.15) * extraSafe; 
          exL = ` (${extraSafe.toFixed(1)}m)`; 
          break;
      case 'rope_climb': 
      case 'pegboard': 
          tMech = atleta.peso * G * extraSafe; 
          exL = ` (${extraSafe.toFixed(1)}m)`; 
          break;
      case 'rope_ascend_floor': 
          tMech = atleta.peso * G * (atleta.estatura * 0.65); 
          break;
      
      case 'hs_incline_up': {
          const [d_up, h_up] = (extraV || "5;1").toString().split(';').map(v => Number(v.replace(',','.')) || 0);
          tMech = (atleta.peso * G * 0.15 * Math.max(1, d_up)) + (atleta.peso * G * Math.max(0, h_up)); 
          exL = ` (${d_up}m ↗ ${h_up}m)`; 
          break;
      }
      case 'hs_incline_down': {
          const [d_dn, h_dn] = (extraV || "5;1").toString().split(';').map(v => Number(v.replace(',','.')) || 0);
          tMech = (atleta.peso * G * 0.15 * Math.max(1, d_dn)) + (atleta.peso * G * Math.max(0, h_dn) * 0.50); 
          exL = ` (${d_dn}m ↘ ${h_dn}m)`; 
          break;
      }

      case 'vertical_hibrido': 
          tMech = ((atleta.peso - m_arms) * G * L_arm) + (atleta.peso * G * altCoM); 
          break;
      case 'vertical_hibrido_extra': 
          tMech = ((atleta.peso - m_arms) * G * L_arm) + (atleta.peso * G * altCoM) + (atleta.peso * G * 0.10); 
          break;
      case 'burpee_broad_jump': 
          tMech = ((atleta.peso - m_arms) * G * L_arm) + (atleta.peso * G * altCoM) + 
                  (0.50 * atleta.peso * (extraSafe * G / Math.sin(80 * Math.PI / 180))); 
          exL = ` (${extraSafe.toFixed(1)}m)`; 
          break;
      
      case 'burpee_over_obj': {
          const h_obj = extra > 0 ? extra : (movId === 'burpee_over_db' ? 0.20 : 0.30);
          tMech = ((atleta.peso - m_arms) * G * L_arm) + (atleta.peso * G * (h_obj * 0.85)); 
          exL = ` (${h_obj.toFixed(2)}m)`; 
          break;
      }
      case 'burpee_pullup': 
          tMech = ((atleta.peso - m_arms) * G * L_arm) + (atleta.peso * G * altCoM) + ((atleta.peso - m_arms) * G * L_arm); 
          break;

      case 'friccao_horizontal_push': {
          const mu_push = Number(extraV) || 0.35; // Agora vem do extraV direto
          const loadRatio = pCarga / Math.max(1, atleta.peso);
          const anguloDinamico = Math.max(10, 30 - (loadRatio * 5)); 
          const radDinamico = anguloDinamico * Math.PI / 180;
          
          const F_push = (mu_push * (pCarga + MASSA_SLED) * G) / (Math.cos(radDinamico) - mu_push * Math.sin(radDinamico));
          
          // O tMech calcula o trabalho de APENAS 1 METRO
          tMech = (F_push * Math.cos(radDinamico)) + (atleta.peso * G * 0.15); 
          exL = ` (${safeReps}m | μ:${mu_push})`; 
          break;
      }
      case 'friccao_horizontal_pull': {
          const mu_pull = Number(extraV) || 0.35; // Vem do extraV

          const rad20 = 20 * Math.PI / 180;
          const F_pull = (mu_pull * (pCarga + MASSA_SLED) * G) / (Math.cos(rad20) + mu_pull * Math.sin(rad20));
          
          // 1 METRO
          tMech = (F_pull * Math.cos(rad20)) + (atleta.peso * G * 0.15); 
          exL = ` (${safeReps}m | μ:${mu_pull})`; 
          break;
      }
      case 'friccao_horizontal_pull_heavy': {
          const mu_pullH = Number(extraV) || 0.35; 
          const F_pull_h = mu_pullH * pCarga * G; 
          
          // 1 METRO
          tMech = F_pull_h + (atleta.peso * G * 0.15); 
          exL = ` (${safeReps}m | μ:${mu_pullH})`; 
          break;
      }

      case 'corrida_carga': 
      case 'yoke_carry': {
          const racioSobrecarga = pCarga / Math.max(1, atleta.peso);
          const oscilacaoDinamica = 0.05 + (0.02 * racioSobrecarga); 
        
          // Calcula o trabalho para 1 metro
          tMech = (atleta.peso + pCarga) * G * oscilacaoDinamica; 
        
          // CORREÇÃO: Aplicar o fator de ineficiência do terreno no trabalho mecânico
          const fatorTerreno = parseFloat(extraV) || 1.0;
          tMech *= fatorTerreno; 
        
          let nomeTerreno = "Ginásio";
          if (extraV === '1.1') nomeTerreno = "Terra/Cascalho";
          if (extraV === '1.2') nomeTerreno = "Grama";
          if (extraV === '2.1') nomeTerreno = "Areia Solta";
        
          exL = ` (${safeReps}m em ${nomeTerreno})`; 
          break;
      }
      case 'shuttle_run': {
            // extraSafe = distância de 1 tiro (vem do paramExtra)
            const distTiro = extraSafe > 0 ? extraSafe : 7.5;
            
            // Trabalho para correr aquele trecho
            const trabCorrida = atleta.peso * G * (0.07 * 0.75 * distTiro);
            
            // Trabalho de frenagem/arrancada nas pontas (desacelerar o corpo a zero e acelerar de novo)
            const trabFrenagem = 0.50 * atleta.peso * Math.pow(3.0, 2); 
            
            // tMech = energia de apenas UMA repetição (um tiro)
            tMech = trabCorrida + trabFrenagem; 
            
            // O log mostra exatamente o que aconteceu: "10x de 7.5m"
            exL = ` (${safeReps}x de ${distTiro.toFixed(1)}m)`; 
            break;
        }
      case 'corrida': 
      case 'run':
          tMech = atleta.peso * G * (0.07 * 0.75); 
          exL = ` (${safeReps}m)`; 
          break;
      case 'air_runner': 
          tMech = atleta.peso * G * 0.09; 
          exL = ` (${safeReps}m)`; 
          break;
      
      case 'remo':
      case 'skierg':
      case 'row': {
          // O parâmetro extra agora é o Drag Factor. A UNIDADE foi para o extraV2.
          const dragFactor = extra > 0 ? extra : 115.0;
          const extraStr = (extraV2 !== undefined && extraV2 !== null) ? extraV2.toString().toLowerCase() : "m";
          const isCal = extraStr.includes('cal');
          
          const fatorTranslacao = (movId === 'remo' || movId === 'row') ? 0.35 : 0.15;
          const multiplicadorDrag = Math.pow(dragFactor / 115.0, 1.0 / 3.0); // Ajuste fluidodinâmico

          if (isCal) {
              // CÁLCULO PARA 1 REP = 1 CALORIA
              const tempoPorCal = 3.6; 
              P = 200.0 * multiplicadorDrag;
              tMech = P * tempoPorCal;
              
              // Penalidade cinética invisível
              const penalidadeTranslacao = atleta.peso * fatorTranslacao * tempoPorCal;
              tMech += penalidadeTranslacao;
              
              isErgo = true;
              isCalorieErgo = true;
              exL = ` (${safeReps} Cal)`;
          } else {
              // CÁLCULO PARA 1 REP = 1 METRO
              // Assumindo pace padrão 2:00/500m -> 0.24 segundos por metro
              const tempoPorMetro = 120.0 / 500.0; 
              P = Math.max(1.0, 2.80 / Math.pow(tempoPorMetro, 3)); // ~202.5W
              tMech = P * tempoPorMetro; // ~48.6 Joules mecânicos por metro
              
              const penalidadeTranslacao = atleta.peso * fatorTranslacao * tempoPorMetro;
              tMech += penalidadeTranslacao;
              
              isErgo = true;
              isCalorieErgo = false;
              exL = ` (${safeReps}m)`;
          }
          break;
      }
      case 'bike':
      case 'bike_erg': {
          const rpmBike = extraSafe > 0 ? extraSafe : 70.0;
          // Curva original
          P = Math.max(1.0, 0.000474 * Math.pow(rpmBike, 3)); 
          
          const unidade = (extraV2 || 'm').toString().toLowerCase();
          if (unidade === 'cal') {
              tMech = 4184.0; // Trabalho mecânico exato para 1 kcal na máquina
              isCalorieErgo = true;
              exL = ` (${safeReps} Cal @ ${rpmBike.toFixed(0)} RPM)`;
          } else {
              // Convertendo Potência para Velocidade (m/s) no padrão Concept2
              const velocidade = Math.pow(P / 2.80, 1.0 / 3.0); 
              const tempoPorMetro = 1.0 / Math.max(0.1, velocidade);
              tMech = P * tempoPorMetro; // Trabalho para 1 metro
              isCalorieErgo = false;
              exL = ` (${safeReps}m @ ${rpmBike.toFixed(0)} RPM)`;
          }
          isErgo = true; 
          break;
      }
      
      case 'echo_bike': {
          const echoRpm = Math.max(20.0, extraSafe > 0 ? extraSafe : 60.0);
          // Polinômio original da Echo Bike
          P = 1e-5 * Math.pow(echoRpm, 4) - 0.0011 * Math.pow(echoRpm, 3) + 0.1455 * Math.pow(echoRpm, 2) - 3.3264 * echoRpm + 29.355;
          P = Math.max(1.0, P);
          
          const unidade = (extraV2 || 'cal').toString().toLowerCase();
          if (unidade === 'cal') {
              tMech = 4184.0; 
              isCalorieErgo = true;
              exL = ` (${safeReps} Cal @ ${echoRpm.toFixed(0)} RPM)`;
          } else {
              // Estimativa de velocidade linear baseada em RPM para Air Bikes
              const velocidade = echoRpm * 0.15; 
              const tempoPorMetro = 1.0 / Math.max(0.1, velocidade);
              tMech = P * tempoPorMetro;
              isCalorieErgo = false;
              exL = ` (${safeReps}m @ ${echoRpm.toFixed(0)} RPM)`;
          }
          isErgo = true; 
          break;
      }
      
      case 'assault_bike': {
          const abRpm = extraSafe > 0 ? extraSafe : 60.0;
          // Curva cúbica original da Assault
          P = Math.max(1.0, 0.00342 * Math.pow(abRpm, 3)); 
          
          const unidade = (extraV2 || 'cal').toString().toLowerCase();
          if (unidade === 'cal') {
              tMech = 4184.0;
              isCalorieErgo = true;
              exL = ` (${safeReps} Cal @ ${abRpm.toFixed(0)} RPM)`;
          } else {
              const velocidade = abRpm * 0.15; 
              const tempoPorMetro = 1.0 / Math.max(0.1, velocidade);
              tMech = P * tempoPorMetro;
              isCalorieErgo = false;
              exL = ` (${safeReps}m @ ${abRpm.toFixed(0)} RPM)`;
          }
          isErgo = true; 
          break;
      }
      case 'heavy_du': {
          // No Heavy DU, a massa da corda pode continuar vindo do extraV
          const mC = extra > 0 ? extra : 1.5; 
          // O tMech já é a energia gasta em 1 único salto. 
          tMech = (atleta.peso * G * 0.10) + (0.50 * (mC * 0.10) * Math.pow(15.0, 2)); 
          exL = ` (${mC}kg corda)`;
          break;
      }
      default:
          tMech = (pCarga > 0 ? pCarga : atleta.peso) * G * 0.5;
  }

  return { tMech, exL, P, isErgo, isCalorieErgo };
}