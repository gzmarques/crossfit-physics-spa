import type { AtletaPerfil, MovimentoConfig } from '../types';
import { calcularBiometria } from './biomechanics';
import { calcularTrabalhoMecanico } from './kinematics';
import { calcularGastoMetabolico } from './thermodynamics';

export function calcularFisica(
  movId: string, cfg: MovimentoConfig, reps: number, pCarga: number,
  extraV: string, extraV2: string, atleta: AtletaPerfil, tecnica: string,
  deltaT = 0, tempoAcumulado = 0
) {
  
  // 1. Sanitização Básica
  const extraNum = Number(extraV);
  const extra = (!isNaN(extraNum) && extraNum > 0) ? extraNum : 0;
  const extraSafe = extra > 0 ? extra : 1.0;
  const safeReps = Math.max(1, reps);

  // 2. Extrai Biometria e Alavancas
  const corpo = calcularBiometria(atleta);

  // 3. Cálculos da Velocidade do LPO (Usado na Cinética e na Fricção)
  const loadRatio = pCarga / Math.max(1, atleta.peso);
  const velMaxAlometrico = 1.6 + (corpo.L_arm * 0.40) + (corpo.L_perna * 0.30); 
  const vbtVelocity = (!isNaN(extraNum) && extraNum > 0) ? extraNum : 0;
  const velLPO = vbtVelocity > 0 ? vbtVelocity : Math.max(1.1, velMaxAlometrico - (0.8 * Math.log(1 + loadRatio)));
  const energiaCineticaBarra = 0.5 * pCarga * Math.pow(velLPO, 2);

  // 4. Roteamento Cinemático (Gera os Joules e Strings)
  const W_squat_body = cfg.isUnilateral ? corpo.W_squat_body_uni : corpo.W_squat_body_bi;
  const kinResult = calcularTrabalhoMecanico({
    movId, cfg, pCarga, extraV, extraV2, extra, extraSafe, safeReps,
    atleta, corpo, energiaCineticaBarra, W_squat_body
  });

  // 5. Roteamento Termodinâmico (Gera as kCal e aplica SSC)
  const sErgo = 0; // O tempo dinâmico de ergômetro é resolvido globalmente no pipeline
  const thermoResult = calcularGastoMetabolico({
    movId, cfg, tecnica, atleta, corpo, pCarga, extraV, extraV2, extra, 
    extraSafe, safeReps, deltaT, tempoAcumulado,
    tMechInicial: kinResult.tMech, P: kinResult.P, sErgo, 
    isCalorieErgo: kinResult.isCalorieErgo, energiaCineticaBarra
  });

  // 6. Output Final do Motor
  return { 
      trabMech: thermoResult.tMechFinal * safeReps, 
      trabMetabolicoWork: thermoResult.tMetWork * safeReps, 
      trabMetabolicoConcIsom: thermoResult.tMetWorkConcIsom * safeReps, 
      infoExtraLog: kinResult.exL, 
      isErgo: kinResult.isErgo, 
      isCalorieErgo: kinResult.isCalorieErgo,
      ergTime: sErgo * safeReps
  };
}