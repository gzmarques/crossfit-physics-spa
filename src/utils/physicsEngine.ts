import type { AtletaPerfil, MovimentoConfig } from '../types';

const G = 9.81;

export function parseClockTime(str: string | number): number {
  if (str === undefined || str === null) return -1;
  const cleanStr = str.toString().trim();
  if (cleanStr === "") return -1;

  if (!cleanStr.includes(':')) {
    const val = Number(cleanStr);
    return (!isNaN(val) && val >= 0) ? val : -1;
  }

  const parts = cleanStr.split(':').map(p => Number(p.trim()));
  if (parts.some(p => isNaN(p) || p < 0)) return -1;

  if (parts.length === 2) {
    return (parts[0] * 60) + parts[1];
  } else if (parts.length === 3) {
    return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
  }
  return -1;
}

export function calcularFisica(
  movId: string,
  cfg: MovimentoConfig,
  reps: number,
  pCarga: number,
  extraV: string,
  extraV2: string,
  atleta: AtletaPerfil,
  tecnica: string,
  deltaT = 0,
  tempoAcumulado = 0 // Variável latente de falência sistêmica
) {

  const MASSA_SLED = 43.0; 

  let fTec = 1.0;
  let kDegradacao = 0.00015; // Constante de declínio celular para perfil Intermediário

  if (atleta.nivelTecnico === 'iniciante') { 
      fTec = 0.85; 
      kDegradacao = 0.00025; // Maior suscetibilidade à falha 
  } 
  if (atleta.nivelTecnico === 'avancado') { 
      fTec = 1.10; 
      kDegradacao = 0.00008; // Maior resiliência oxidativa
  }

  // Degradação exponencial biológica (fTec cai conforme o WOD avança)
  fTec = fTec * Math.exp(-kDegradacao * tempoAcumulado);

  const isM = (atleta.sexo === 'M');
  
  const L_arm = atleta.envergadura * 0.45; 
  const L_perna = atleta.perna;
  const L_thigh = L_perna * 0.50;
  const L_shank = L_perna * 0.50;
  const L_trunk = Math.max(0.1, atleta.estatura - L_perna);
  const altCoM = atleta.estatura * (isM ? 0.56 : 0.54);

let m_thigh = 0;
  let m_shank_foot = 0;
  let m_arms = 0;

  if (atleta.usaAntropometriaAvancada && atleta.circCoxa) {
      // --- VIA AVANÇADA (Alometria Volumétrica Dinâmica) ---
      // 1. Densidade corporal (rho) calculada pelo percentual de gordura.
      // Indivíduos magros têm densidade próxima a 1060 kg/m³, caindo para ~1000 kg/m³ com alto BF.
      const densidadeKgM3 = 1060 - (atleta.bf * 1.5); 
      
      // 2. Volume da coxa cilíndrica: V = (C^2 / 4π) * Altura
      const volumeCoxaM3 = (Math.pow(atleta.circCoxa, 2) / (4 * Math.PI)) * L_thigh;
      
      // Massa = Densidade x Volume (multiplicado por 2 pois temos duas pernas)
      // Nota: as tabelas de De Leva tratam a massa dos membros de forma agregada (bilateral) no cálculo de trabalho.
      m_thigh = (volumeCoxaM3 * densidadeKgM3) * 2;
      
      // 3. Proporção anatómica funcional para a perna/pé.
      // Historicamente, a massa da perna+pé corresponde a cerca de 40.2% da massa da coxa num atleta treinado.
      m_shank_foot = m_thigh * 0.402;
      
      // 4. Os braços mantêm o padrão alométrico caso não haja input para circunferência de braço
      m_arms = atleta.peso * (isM ? 0.0988 : 0.0898);
  } else {
      // --- VIA PADRÃO (Constantes de De Leva Originais) ---
      m_thigh = atleta.peso * (isM ? 0.2832 : 0.2956);
      m_shank_foot = atleta.peso * (isM ? 0.1140 : 0.1220);
      m_arms = atleta.peso * (isM ? 0.0988 : 0.0898);
  }

  // --- LEI DA CONSERVAÇÃO DAS MASSAS ---
  // A massa superior é o peso total deduzido da massa inferior e braços (conforme centro de massa do tronco).
  // Se o modelo avançado calcular coxas hipertróficas, o sistema reduz o peso do tronco para manter 
  // a coerência absoluta com a balança (peso inserido pelo usuário).
  const m_sup = Math.max(0, atleta.peso - m_thigh - m_shank_foot); 

  // --- NOVA REFATORAÇÃO 1: Unilateralidade e Abdução ---
  // --- REFATORAÇÃO DE ANTROPOMETRIA: Dominância de Quadril vs Joelho ---
  // Calcula o rácio entre o Fêmur e o Tronco. Fêmures longos geram maior inclinação do tronco (Hip Dominant).
  const racioFemurTronco = L_thigh / L_trunk;
  
  // O ângulo de inclinação do tronco aumenta proporcionalmente ao tamanho do fêmur
  // Um rácio normal (aprox. 1.0) gera ~20 graus de abdução/inclinação basal.
  const anguloInclinacaoTroncoRad = (20 * racioFemurTronco) * (Math.PI / 180);
  const cosInclinacao = Math.cos(anguloInclinacaoTroncoRad);
  
  // Penalidade de Torque Lombar: Se o tronco inclina mais, o centro de massa desloca-se, aumentando o trabalho isolado
  const fatorTorqueLombar = 1.0 + Math.max(0, (racioFemurTronco - 1.0) * 0.15);

  let W_squat_body = 0;
  
  if (cfg.isUnilateral) {
    W_squat_body = ((m_sup * G * (L_thigh * cosInclinacao)) * fatorTorqueLombar) + 
                   ((m_thigh / 2) * G * ((L_thigh * 0.59) * cosInclinacao)) + 
                   ((m_thigh / 2) * G * L_thigh); 
  } else {
    W_squat_body = ((m_sup * G * (L_thigh * cosInclinacao)) * fatorTorqueLombar) + 
                   (m_thigh * G * ((L_thigh * 0.59) * cosInclinacao));
  }
  
  const h_puxao = atleta.estatura * 0.60;
  
  // --- NOVA REFATORAÇÃO 2: Curva Força-Velocidade logarítmica para o LPO ---
const loadRatio = pCarga / Math.max(1, atleta.peso);
  const velMaxAlometrico = 1.6 + (L_arm * 0.40) + (L_perna * 0.30); 
  const velLPO = Math.max(1.1, velMaxAlometrico - (0.8 * Math.log(1 + loadRatio)));
  const energiaCineticaBarra = 0.5 * pCarga * Math.pow(velLPO, 2);
  const dissipacaoExcentricaGRF = energiaCineticaBarra * 0.15; // Choque térmico
  
  // --- NOVA REFATORAÇÃO 3: Fator SSC (Ciclo Alongamento-Encurtamento) ---
  const fatorSSC = ['burpee_box_jump', 'burpee_high_box_jump', 'burpee_box_jump_over', 'burpee_high_box_jump_over', 'box_jump', 'high_box_jump', 'box_jump_over', 'high_box_jump_over'].includes(cfg.categoria) ? 0.82 : 1.0; 

  // ==========================================================
  // DECLARAÇÕES ORIGINAIS E VARIÁVEIS RESTAURADAS (Não apagar)
  // ==========================================================
  let tMech = 0, tMetWork = 0, tMetWorkConcIsom = 0, exL = "", P = 0, sErgo = 0, isErgo = false;
  let isCalorieErgo = false;
  
  const extraNum = Number(extraV);
  const extra = (!isNaN(extraNum) && extraNum > 0) ? extraNum : 0;
  const extraSafe = extra > 0 ? extra : 1.0;
  const des = (cfg.paramExtra && cfg.categoria.includes('vertical_bw_total') && extra > 0) 
              ? extra : (atleta.estatura * (cfg.fatorH || 0.40));
  
  const h_box = extra > 0 ? extra : (cfg.isHighBox ? (isM ? 0.75 : 0.60) : (isM ? 0.60 : 0.50));
  const safeReps = Math.max(1, reps); // Aqui a variável 'reps' volta a ser utilizada

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
          const h_alvo = extra > 0 ? extra : 3.0;
          const h_fundo = Math.max(0, atleta.estatura - (0.5 * L_trunk) - L_thigh);
          tMech = W_squat_body + (pCarga * G * Math.max(0, h_alvo - h_fundo)); 
          exL = ` (${h_alvo.toFixed(2)}m)`; 
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
          if (['strict_bmu', 'bar_muscle_up', 'strict_rmu', 'ring_muscle_up'].includes(movId)) {
              tMech = atleta.peso * G * (2.0 * L_arm + (L_trunk * 0.50));
          } else if (cfg.grupo === 'Corda') { 
              tMech = atleta.peso * G * des; 
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
      case 'arc_carga': 
          tMech = pCarga * G * (atleta.estatura * 0.55); 
          break;
      case 'arc_carga_parcial': 
          tMech = pCarga * G * (atleta.estatura * 0.35); 
          break;

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

      case 'box_step_up': 
      case 'box_jump': 
          tMech = atleta.peso * G * h_box; 
          exL = ` (${h_box.toFixed(2)}m)`; 
          break;
      case 'box_jump_over': 
          tMech = atleta.peso * G * (h_box * 0.85); 
          exL = ` (${h_box.toFixed(2)}m)`; 
          break;

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
      case 'burpee_box_jump': 
          tMech = ((atleta.peso - m_arms) * G * L_arm) + (atleta.peso * G * h_box); 
          exL = ` (${h_box.toFixed(2)}m)`; 
          break;
      case 'burpee_box_jump_over': 
          tMech = ((atleta.peso - m_arms) * G * L_arm) + (atleta.peso * G * (h_box * 0.85)); 
          exL = ` (${h_box.toFixed(2)}m)`; 
          break;
      case 'burpee_pullup': 
          tMech = ((atleta.peso - m_arms) * G * L_arm) + (atleta.peso * G * altCoM) + ((atleta.peso - m_arms) * G * L_arm); 
          break;

      case 'friccao_horizontal_push': {
          const trecho = Number(extraV) || 10;
          const mu_push = Number(extraV2) || 0.35; 

          const loadRatio = pCarga / Math.max(1, atleta.peso);
          const anguloDinamico = Math.max(10, 30 - (loadRatio * 5)); 
          const radDinamico = anguloDinamico * Math.PI / 180;
          
          const F_push = (mu_push * (pCarga + MASSA_SLED) * G) / (Math.cos(radDinamico) - mu_push * Math.sin(radDinamico));
          const W_sled_push = F_push * Math.cos(radDinamico) * trecho;
          
          tMech = W_sled_push + (atleta.peso * G * 0.15 * trecho); 
          exL = ` (${safeReps}x ${trecho}m | μ:${mu_push})`; 
          break;
      }
      case 'friccao_horizontal_pull': {
          const trecho = Number(extraV) || 10;
          const mu_pull = Number(extraV2) || 0.35; 

          const rad20 = 20 * Math.PI / 180;
          const F_pull = (mu_pull * (pCarga + MASSA_SLED) * G) / (Math.cos(rad20) + mu_pull * Math.sin(rad20));
          const W_sled_pull = F_pull * Math.cos(rad20) * trecho;
          
          tMech = W_sled_pull + (atleta.peso * G * 0.15 * trecho); 
          exL = ` (${safeReps}x ${trecho}m | μ:${mu_pull})`; 
          break;
      }
      case 'friccao_horizontal_pull_heavy': {
          const trecho = Number(extraV) || 10;
          const mu_pullH = Number(extraV2) || 0.35; 

          const F_pull_h = mu_pullH * pCarga * G; 
          tMech = (F_pull_h * trecho) + (atleta.peso * G * 0.15 * trecho); 
          exL = ` (${safeReps}x ${trecho}m | μ:${mu_pullH})`; 
          break;
      }

      case 'corrida_carga': 
      case 'yoke_carry': {
          const racioSobrecarga = pCarga / Math.max(1, atleta.peso);
          const oscilacaoDinamica = 0.05 + (0.02 * racioSobrecarga); 
          // O cálculo aqui é feito para 1 metro. No final do motor, ele multiplica pelo safeReps (que agora é a distância total).
          tMech = (atleta.peso + pCarga) * G * oscilacaoDinamica; 
          
          let nomeTerreno = "Ginásio";
          if (extraV === '1.1') nomeTerreno = "Terra";
          if (extraV === '1.2') nomeTerreno = "Turf";
          if (extraV === '2.1') nomeTerreno = "Areia";
          if (extraV === '4.1') nomeTerreno = "Neve";
          exL = ` (${safeReps}m em ${nomeTerreno})`; 
          break;
      }
      case 'shuttle_run': 
          tMech = (atleta.peso * G * (0.07 * 0.75 * extraSafe)) + (0.50 * atleta.peso * Math.pow(3.0, 2)); 
          exL = ` (${extraSafe.toFixed(1)}m)`; 
          break;
      case 'corrida': 
          tMech = atleta.peso * G * (0.07 * 0.75 * extraSafe); 
          exL = ` (${extraSafe.toFixed(1)}m)`; 
          break;
      case 'air_runner': 
          tMech = atleta.peso * G * 0.09 * extraSafe; 
          exL = ` (${extraSafe.toFixed(1)}m)`; 
          break;
      
      case 'remo': {
          const extraStr = (extraV !== undefined && extraV !== null) ? extraV.toString().toLowerCase() : "";
          if (extraStr.includes('cal')) {
              const calVal = Math.max(0.1, parseFloat(extraStr) || 0);
              const tempoUso = deltaT > 0 ? deltaT : Math.max(1.0, calVal * 6.0);
              P = Math.max(1.0, ((calVal * (3600.0 / tempoUso)) - 300.0) / (4.0 * 0.8604));
              sErgo = Math.pow(2.80 / P, 1.0 / 3.0); 
              tMech = (P * tempoUso) / safeReps; 
              isErgo = true;
              isCalorieErgo = true;
              exL = ` (${calVal.toFixed(1)} Cal)`;
          } else {
              const parsedTime = parseClockTime(extraV);
              const t_split = parsedTime > 0 ? parsedTime : 120.0;
              sErgo = Math.max(0.02, t_split / 500.0); 
              P = Math.max(1.0, 2.80 / Math.pow(sErgo, 3)); 
              tMech = P * sErgo; 
              isErgo = true; 
              exL = ` (Pace ${extraV || '2:00'})`; 
          }
          break;
      }
      case 'bike': {
          const rpmBike = extra > 0 ? extra : 70.0;
          P = Math.max(1.0, 0.000474 * Math.pow(rpmBike, 3)); 
          sErgo = 4184.0 / P; 
          tMech = P * sErgo; 
          isErgo = true; 
          exL = ` (${rpmBike.toFixed(0)} RPM)`; 
          break;
      }
      case 'echo_bike': {
          const echoRpm = Math.max(20.0, extra > 0 ? extra : 60.0);
          P = 1e-5 * Math.pow(echoRpm, 4) - 0.0011 * Math.pow(echoRpm, 3) + 0.1455 * Math.pow(echoRpm, 2) - 3.3264 * echoRpm + 29.355;
          P = Math.max(1.0, P);
          sErgo = 4184.0 / P; 
          tMech = P * sErgo; 
          isErgo = true; 
          exL = ` (${echoRpm.toFixed(0)} RPM)`; 
          break;
      }
      case 'assault_bike': {
          const abRpm = extra > 0 ? extra : 60.0;
          P = Math.max(1.0, 0.00342 * Math.pow(abRpm, 3)); 
          sErgo = 4184.0 / P; 
          tMech = P * sErgo; 
          isErgo = true; 
          exL = ` (${abRpm.toFixed(0)} RPM)`; 
          break;
      }
      case 'heavy_du': {
          const mC = extra > 0 ? extra : 1.5; 
          tMech = (atleta.peso * G * 0.10) + (0.50 * (mC * 0.10) * Math.pow(15.0, 2)); 
          break;
      }
      default:
          tMech = (pCarga > 0 ? pCarga : atleta.peso) * G * 0.5;
  }

  // Aplicar a poupança energética da fáscia (SSC) no trabalho mecânico total
  tMech = tMech * fatorSSC;

  if (cfg.categoria === 'shuttle_run') { 
      tMetWork = atleta.peso * (extraSafe / 1000.0) * (1.0 + (12.5 / extraSafe)); 
      tMetWorkConcIsom = tMetWork; 
  } else if (cfg.categoria === 'corrida') { 
      tMetWork = 0.90 * atleta.peso * (extraSafe / 1000.0); 
      tMetWorkConcIsom = tMetWork; 
  } else if (cfg.categoria === 'air_runner') { 
      tMetWork = 1.32 * (0.90 * atleta.peso * (extraSafe / 1000.0)); 
      tMetWorkConcIsom = tMetWork; 
  } else if (cfg.categoria === 'corrida_carga' || cfg.categoria === 'yoke_carry') { 

      const distanciaDinamica = safeReps; // O usuário digitou a distância no campo Reps/Mts
      const eta = Number(extraV) || 1.0;  // O valor selecionado no dropdown

      // 1. Definição estrita das grandezas do modelo de Pandolf
      const W = atleta.peso; // Peso corporal basal do atleta (kg)
      const L = pCarga;      // Massa da carga transportada (kg)
      const V = deltaT > 0 ? (extraSafe / deltaT) : 1.2; // Velocidade de translação (m/s)
      
      // 2. Fatores exógenos (Terreno e Topografia)
      const G_grade = 0; // Gradiente de elevação em %. (0 = plano). Expansível futuramente.

      // 3. Fator de assimetria e tensão miofascial
      // Compensa a dispersão de força necessária para estabilizar o Farmer's Carry ou Yoke
      const kAssimetria = cfg.categoria === 'yoke_carry' ? 1.30 : 1.20; 

      // 4. Decomposição da Equação de Pandolf (1977) Modificada
      // Componente A: Custo metabólico basal para sustentação bípede
      const custoBasal = 1.5 * W;

      // Componente B: A crucial Penalidade Quadrática da Carga
      const penalidadeCarga = 2.0 * (W + L) * Math.pow(L / Math.max(1, W), 2);

      // Componente C: Custo de translação espacial perante o coeficiente de terreno
      const custoTranslacao = eta * (W + L) * (1.5 * Math.pow(V, 2) + 0.35 * V * G_grade);

      // Componente D: Correção de Santee (aplicável exclusivamente em declives para abater a tensão)
      let correcaoSantee = 0;
      if (G_grade < 0) {
          correcaoSantee = eta * (W + L) * ((V * G_grade * 0.35) - (Math.pow(V * G_grade, 2) / W));
      }

      // 5. Agregação Termodinâmica (M_W) expressa em Watts Metabólicos
      const M_watts = kAssimetria * (custoBasal + penalidadeCarga + custoTranslacao + correcaoSantee);
      const tempoExecucao = deltaT > 0 ? deltaT : (distanciaDinamica / V);

      // 6. Conversão do dispêndio absoluto (Joules térmicos) para kCal (1 kCal = 4184 Joules)
      // Como o return final da função multiplica tMetWork por safeReps,
      // precisamos dividir o total pelo safeReps aqui para que o resultado não seja duplicado.
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
      // Refatoração 4: Multiplicador biológico 4.0 (Aproximadamente 25% de eficiência)
      tMetWork = (4.0 * P * sErgo) / 4184.0; 
      tMetWorkConcIsom = tMetWork; 
  } else {
      let eta_conc = 0.22 * fTec; 
      let eta_exc = 1.10; 
      // Refatoração 5: Variável abstrata de SSC foi suprimida daqui
      let W_exc_ratio = 0.0; 
      let E_isom = 0.0;      
      
      const cA = ['burpee_broad_jump','burpee_box_jump','burpee_box_jump_over','burpee_over_obj',
                  'burpee_pullup','vertical_hibrido','vertical_hibrido_extra','wall_ball',
                  'squat_bw','box_step_up', 'box_jump', 'box_jump_over','lunge_bw',
                  'lunge_carga', 'alavanca_parcial', 'alavanca_horizontal', 'core_situp', 
                  'core_vup', 'core_ghd', 'core_t2b', 'core_k2e'];

      if (cfg.grupo === 'Corda') eta_conc = 0.45 * fTec;
      else if (cfg.categoria === 'pegboard') eta_conc = 0.06 * fTec;
      else if (movId === 'strict_rmu') eta_conc = 0.07 * fTec;
      else if (cfg.categoria === 'wf_hspu') eta_conc = 0.08 * fTec;
      else if (['handstand_walk','wall_walk', 'hs_incline_up', 'hs_incline_down'].includes(cfg.categoria)) eta_conc = 0.08 * fTec;
      else if (movId === 'strict_bmu' || movId === 'ring_dip_strict') eta_conc = 0.08 * fTec;
      else if (cfg.categoria === 'pullover') eta_conc = 0.09 * fTec;
      else if (cfg.nome.includes('Strict') && (cfg.categoria === 'vertical_bw' || cfg.categoria === 'core_t2b' || cfg.categoria === 'core_k2e' || cfg.categoria === 'alavanca_inferior')) eta_conc = 0.10 * fTec;
      else if (cfg.nome.includes('Butterfly')) eta_conc = 0.22 * fTec;
      else if (cfg.nome.includes('Kipping') && cfg.categoria === 'vertical_bw') eta_conc = 0.14 * fTec;
      else if (cfg.nome.includes('Kipping') && (cfg.categoria === 'core_t2b' || cfg.categoria === 'core_k2e' || cfg.categoria === 'alavanca_inferior')) eta_conc = 0.12 * fTec;
      else if (cfg.categoria === 'devil_press' || movId === 'overhead_squat' || cfg.categoria === 'core_ghd' || cfg.categoria === 'sandbag_clean') eta_conc = 0.12 * fTec;
      else if (cfg.categoria === 'dball_shoulder') eta_conc = 0.11 * fTec;
      else if (cfg.categoria === 'rope_climb' || cfg.categoria === 'rope_ascend_floor') eta_conc = 0.15 * fTec;
      else if (cfg.categoria.includes('lpo_') || cfg.categoria.includes('db_') || cA.includes(cfg.categoria)) eta_conc = 0.16 * fTec;
      else if (cfg.categoria.includes('friccao_horizontal')) eta_conc = 0.15 * fTec;

      if (cfg.nome.includes('Strict') && (cfg.categoria === 'vertical_bw' || cfg.categoria === 'core_t2b' || cfg.categoria === 'core_k2e' || cfg.categoria === 'alavanca_inferior')) { 
          W_exc_ratio = 0.40; 
      } else if (cfg.nome.includes('Butterfly')) { 
          W_exc_ratio = 0.05; 
      } else if (cfg.nome.includes('Kipping') && (cfg.categoria === 'vertical_bw' || cfg.categoria === 'core_t2b' || cfg.categoria === 'core_k2e' || cfg.categoria === 'alavanca_inferior')) { 
          W_exc_ratio = 0.20; 
      } else if (cA.includes(cfg.categoria) || cfg.categoria === 'wall_ball' || ['overhead_squat','sandbag_clean','devil_press'].includes(movId)) { 
          W_exc_ratio = 0.35; 
      } else if (cfg.categoria === 'burpee_broad_jump') { 
          W_exc_ratio = 0.60; 
      } else if (['turkish_get_up','strict_rmu', 'free_hspu'].includes(movId) || cfg.categoria === 'core_ghd' || cfg.nome.includes('Ring')) { 
          W_exc_ratio = 0.45; 
      } else if (cfg.categoria.includes('lpo_hang') || cfg.categoria.includes('lpo_floor') || cfg.categoria.includes('lpo_cj') || cfg.categoria.includes('db_') || movId === 'deadlift') { 
          W_exc_ratio = (tecnica === 'drop') ? 0.00 : 0.40; 
      }

      const tut_default = deltaT > 0 ? deltaT : 3.0; 
      if (['pegboard', 'hs_walk', 'wall_walk', 'hs_incline_up', 'hs_incline_down'].includes(cfg.categoria)) { 
          E_isom = (tMech > 0 ? tMech : atleta.peso * G * 0.50) * tut_default * 0.80; 
      } else if (['ring_muscle_up', 'strict_rmu'].includes(movId)) { 
          E_isom = tMech * tut_default * 0.40; 
      } else if (['overhead_squat', 'turkish_get_up'].includes(movId) || cfg.categoria === 'core_t2b' || cfg.categoria === 'core_ghd') { 
          E_isom = tMech * tut_default * 0.30; 
      } else if (cfg.categoria.includes('friccao_horizontal')) { 
          E_isom = tMech * tut_default * 0.40; 
      }

      // Refatoração 5 (Cont.): Respeito absoluto à termodinâmica gravitacional
      const W_conc = tMech; 
      const W_exc = tMech * W_exc_ratio;
      
      const E_met_conc = W_conc / (Math.max(0.01, eta_conc) * 4184.0);
      
      // Integra a dissipação GRF no custo excêntrico (se for um movimento de LPO)
      const custoExtraGRF = (cfg.categoria.includes('lpo_') || cfg.categoria.includes('db_') || cfg.categoria === 'deadlift') ? dissipacaoExcentricaGRF : 0;
      const E_met_exc = (W_exc + custoExtraGRF) / (eta_exc * 4184.0);
      
      const E_met_isom = E_isom / 4184.0;

      tMetWork = E_met_conc + E_met_exc + E_met_isom;
      tMetWorkConcIsom = E_met_conc + E_met_isom;
  }

  return { 
      trabMech: tMech * safeReps, 
      trabMetabolicoWork: tMetWork * safeReps, 
      trabMetabolicoConcIsom: tMetWorkConcIsom * safeReps, 
      infoExtraLog: exL, 
      isErgo: isErgo, 
      isCalorieErgo: isCalorieErgo,
      ergTime: sErgo * safeReps
  };
}