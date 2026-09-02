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

// ============================================================================
// HELPER: CONVERSÃO DE CAIXAS (POLEGADAS PARA METROS)
// ============================================================================
function getAlturaCaixaMetros(extraVal: number, isMasc: boolean): number {
    const h = extraVal > 0 ? extraVal : (isMasc ? 0.61 : 0.51); // 24" / 20" padrão
    return h > 3.0 ? h * 0.0254 : h; // Acima de 3, assume que o input foi em polegadas
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

  // --- CORREÇÃO IMPLÍCITA: Penalidade Etária na Degradação ---
  // A partir dos 30 anos, a eficiência de recuperação de ATP decai ligeiramente, acelerando o 'k'
  let idadeAtual = 0;
  if (atleta.usaAntropometriaAvancada && atleta.dataNascimento) {
      const hoje = new Date();
      const nascimento = new Date(atleta.dataNascimento);
      idadeAtual = hoje.getFullYear() - nascimento.getFullYear();
      const m = hoje.getMonth() - nascimento.getMonth();
      if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) {
          idadeAtual--;
      }

      if (idadeAtual > 30) {
          const fatorEnvelhecimento = 1.0 + ((idadeAtual - 30) * 0.015); // +1.5% de degradação por ano após os 30
          kDegradacao *= fatorEnvelhecimento;
      }
  }

  // Degradação exponencial biológica com piso assintótico (Steady-State)
  const limite_eficiencia = 0.70; // Previne o colapso do motor em WODs longos
  fTec = limite_eficiencia + (fTec - limite_eficiencia) * Math.exp(-kDegradacao * tempoAcumulado);

  const isM = (atleta.sexo === 'M');
  
  // --- CORREÇÃO IMPLÍCITA: Ajuste do Centro de Massa (CoM) via Tórax ---
  let altCoM = atleta.estatura * (isM ? 0.56 : 0.54);
  if (atleta.usaAntropometriaAvancada && atleta.circTorax) {
      // Tórax largo eleva o centro de massa, exigindo mais equilíbrio e trabalho mecânico global
      const proporcaoToraxAltura = atleta.circTorax / atleta.estatura;
      
      // Nova formulação: transição suave sem saltos binários
      const baseProporcao = 0.55;
      const multiplicadorSuave = 1.0 + Math.max(0, (proporcaoToraxAltura - baseProporcao) * 0.4);
      altCoM *= multiplicadorSuave;
  }
  
  const L_arm = atleta.envergadura * 0.45; 
  const L_perna = atleta.perna;
  const L_thigh = L_perna * 0.50;
  const L_shank = L_perna * 0.50;
  const L_trunk = Math.max(0.1, atleta.estatura - L_perna);

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
  let fatorTorqueLombar = 1.0 + Math.max(0, (racioFemurTronco - 1.0) * 0.15);

  // --- CORREÇÃO IMPLÍCITA: Sobretaxa Computacional por Má Mobilidade (ROM) ---
  // Se o ROM for inferior a 100%, o atleta luta contra os próprios tecidos conectivos (encurtamento)
  const mobilidadeFuncional = (atleta.mobilidade !== undefined && atleta.mobilidade > 0) ? atleta.mobilidade : 100;
  if (mobilidadeFuncional < 100) {
      // Nova formulação exponencial para resistência fascial nos graus finais de amplitude
      const penalidadeROM = Math.exp(0.04 * (100 - mobilidadeFuncional)) - 1;
      fatorTorqueLombar += penalidadeROM;
  }

  let W_squat_body = 0;
  
  if (cfg.isUnilateral) {
    W_squat_body = ((m_sup * G * (L_thigh * cosInclinacao)) * fatorTorqueLombar) + 
                   ((m_thigh / 2) * G * ((L_thigh * 0.59) * cosInclinacao)) + 
                   ((m_thigh / 2) * G * L_thigh); 
  } else {
    W_squat_body = ((m_sup * G * (L_thigh * cosInclinacao)) * fatorTorqueLombar) + 
                   (m_thigh * G * ((L_thigh * 0.59) * cosInclinacao));
  }
  
  // O ponto de puxada balística agora deriva diretamente das alavancas do quadril e esterno
  const h_puxao = L_perna + (L_trunk * 0.20);
  
  // --- NOVA REFATORAÇÃO 2: Injeção de Telemetria VBT no LPO ---
  const loadRatio = pCarga / Math.max(1, atleta.peso);
  const velMaxAlometrico = 1.6 + (L_arm * 0.40) + (L_perna * 0.30); 
  
  // Verifica se um valor de VBT (m/s) foi inserido na interface via extraV
  const extraNumVBT = Number(extraV);
  const vbtVelocity = (!isNaN(extraNumVBT) && extraNumVBT > 0) ? extraNumVBT : 0;

  // Substitui a estimativa teórica pela velocidade real lida pelo acelerómetro, se disponível
  const velLPO = vbtVelocity > 0 
      ? vbtVelocity 
      : Math.max(1.1, velMaxAlometrico - (0.8 * Math.log(1 + loadRatio)));
      
  const energiaCineticaBarra = 0.5 * pCarga * Math.pow(velLPO, 2);
  const dissipacaoExcentricaGRF = energiaCineticaBarra * 0.15; // Choque térmico
  
  // --- NOVA REFATORAÇÃO 3: Fator SSC (Ciclo Alongamento-Encurtamento) Dinâmico ---
  // A restituição elástica da fáscia degrada com a fadiga (tempoAcumulado). 
  // Começa garantindo 18% de poupança (fator 0.82) e tende assintoticamente a 1.00 (zero poupança).
  let fatorSSC = 1.0;
  const categoriasSalto = ['burpee_box_jump', 'burpee_high_box_jump', 'burpee_box_jump_over', 'burpee_high_box_jump_over', 'box_jump', 'high_box_jump', 'box_jump_over', 'high_box_jump_over'];
  
  if (categoriasSalto.includes(cfg.categoria)) {
      // Utilizamos a mesma constante celular (kDegradacao) para alinhar a falha miofascial à falha técnica
      const poupancaElastica = 0.18 * Math.exp(-kDegradacao * tempoAcumulado);
      fatorSSC = 1.0 - poupancaElastica;
  }

  // ==========================================================
  // DECLARAÇÕES ORIGINAIS E VARIÁVEIS RESTAURADAS
  // ==========================================================
  let tMech = 0, tMetWork = 0, tMetWorkConcIsom = 0, exL = "", P = 0, sErgo = 0, isErgo = false;
  let isCalorieErgo = false;
  
  const extraNum = Number(extraV);
  const extra = (!isNaN(extraNum) && extraNum > 0) ? extraNum : 0;
  const extraSafe = extra > 0 ? extra : 1.0;
  const des = (cfg.paramExtra && cfg.categoria.includes('vertical_bw_total') && extra > 0) 
              ? extra : (atleta.estatura * (cfg.fatorH || 0.40));
  
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
      const V = deltaT > 0 ? (distanciaDinamica / deltaT) : 1.2; // Velocidade de translação (m/s)
      
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
      let W_exc_ratio = 0.0; 
      let E_isom = 0.0;      
      
      const cA = ['burpee_broad_jump','burpee_box_jump','burpee_box_jump_over','burpee_over_obj',
                  'burpee_pullup','vertical_hibrido','vertical_hibrido_extra','wall_ball',
                  'squat_bw','box_step_up', 'box_jump', 'box_jump_over','lunge_bw',
                  'lunge_carga', 'alavanca_parcial', 'alavanca_horizontal', 'core_situp', 
                  'core_vup', 'core_ghd', 'core_t2b', 'core_k2e', 'box_step_over']; // Incluído box step-over

      if (cfg.grupo === 'Corda') eta_conc = 0.45 * fTec;
      else if (cfg.categoria === 'pegboard') eta_conc = 0.06 * fTec;
      // Leitura da Técnica diretamente da variável, não mais do nome do movimento
      else if (movId === 'rmu' && tecnica === 'strict') eta_conc = 0.07 * fTec;
      else if (cfg.categoria === 'wf_hspu') eta_conc = 0.08 * fTec;
      else if (['handstand_walk','wall_walk', 'hs_incline_up', 'hs_incline_down'].includes(cfg.categoria)) eta_conc = 0.08 * fTec;
      else if ((movId === 'bmu' || movId === 'ring_dip') && tecnica === 'strict') eta_conc = 0.08 * fTec;
      else if (cfg.categoria === 'pullover') eta_conc = 0.09 * fTec;
      else if (tecnica === 'strict' && (cfg.categoria === 'vertical_bw' || cfg.categoria === 'core_t2b' || cfg.categoria === 'core_k2e' || cfg.categoria === 'alavanca_inferior')) eta_conc = 0.10 * fTec;
      else if (tecnica === 'butterfly') eta_conc = 0.22 * fTec;
      else if (tecnica === 'kipping' && cfg.categoria === 'vertical_bw') eta_conc = 0.14 * fTec;
      else if (tecnica === 'kipping' && (cfg.categoria === 'core_t2b' || cfg.categoria === 'core_k2e' || cfg.categoria === 'alavanca_inferior')) eta_conc = 0.12 * fTec;
      else if (cfg.categoria === 'devil_press' || movId === 'overhead_squat' || cfg.categoria === 'core_ghd' || cfg.categoria === 'sandbag_clean') eta_conc = 0.12 * fTec;
      else if (cfg.categoria === 'dball_shoulder') eta_conc = 0.11 * fTec;
      else if (cfg.categoria === 'rope_climb' || cfg.categoria === 'rope_ascend_floor') eta_conc = 0.15 * fTec;
      else if (cfg.categoria.includes('lpo_') || cfg.categoria.includes('db_') || cA.includes(cfg.categoria)) eta_conc = 0.16 * fTec;
      else if (cfg.categoria.includes('friccao_horizontal')) eta_conc = 0.15 * fTec;

      // Fase Excêntrica controlada pela Técnica
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
          // Atualizado de ring_muscle_up e strict_rmu para a base rmu
          E_isom = tMech * tut_default * 0.40; 
      } else if (['overhead_squat', 'turkish_get_up'].includes(movId) || cfg.categoria === 'core_t2b' || cfg.categoria === 'core_ghd') { 
          E_isom = tMech * tut_default * 0.30; 
      } else if (cfg.categoria.includes('friccao_horizontal')) { 
          E_isom = tMech * tut_default * 0.40; 
      }

      // --- Custo de Instabilidade Bilateral (Double DB/KB) ---
      if (cfg.isInstavel) {
          eta_conc *= 0.85; 
          E_isom += (pCarga * G * L_arm) * tut_default * 0.40; 
      }

      // --- NOVA REFATORAÇÃO: Custo Isométrico da Pega (Grip) Dinâmica ---
      if (['deadlift', 'corrida_carga', 'arc_carga', 'arc_carga_parcial'].includes(cfg.categoria)) {
          // O usuário preencheu a pega manual? (Deadlift usa extra, Farmer's usa extraV2)
          let diametroPega = cfg.categoria === 'deadlift' ? extra : Number(extraV2);
          
          // Se deixou em branco (valor 0), escalamos dinamicamente a alça assumindo KBs/Halteres de ferro fundido
          // Base de 28mm + cresce ~0.3mm por kg (Ex: KB de 32kg = alça de ~37.6mm)
          if (!diametroPega || diametroPega <= 0) {
              diametroPega = 28 + (pCarga * 0.3);
          }

          if (diametroPega > 28) {
              const penalidadeGrip = 1.0 + ((diametroPega - 28) * 0.05); // +5% de fadiga por mm extra
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