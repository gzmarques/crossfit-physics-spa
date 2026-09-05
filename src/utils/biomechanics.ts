import type { AtletaPerfil } from '../types';
import { G } from './mathHelpers';

export interface CorpoFisico {
  isM: boolean;
  altCoM: number;
  L_arm: number;
  L_perna: number;
  L_thigh: number;
  L_shank: number;
  L_trunk: number;
  m_thigh: number;
  m_shank_foot: number;
  m_arms: number;
  m_sup: number;
  cosInclinacao: number;
  fatorTorqueLombar: number;
  W_squat_body_uni: number; 
  W_squat_body_bi: number;  
  h_puxao: number;
}

export function calcularBiometria(atleta: AtletaPerfil): CorpoFisico {
  const isM = (atleta.sexo === 'M');
  
  let altCoM = atleta.estatura * (isM ? 0.56 : 0.54);
  if (atleta.usaAntropometriaAvancada && atleta.circTorax) {
      const proporcaoToraxAltura = atleta.circTorax / atleta.estatura;
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
      let fatorOsseo = 1.0;
      if (atleta.fenotipo === 'power') fatorOsseo = 1.04; 
      else if (atleta.fenotipo === 'endurance') fatorOsseo = 0.97;
      
      const densidadeKgM3 = (1060 - (atleta.bf * 1.5)) * fatorOsseo; 
      const volumeCoxaM3 = (Math.pow(atleta.circCoxa, 2) / (4 * Math.PI)) * L_thigh;
      
      m_thigh = (volumeCoxaM3 * densidadeKgM3) * 2;
      m_shank_foot = m_thigh * 0.402;
      m_arms = atleta.peso * (isM ? 0.0988 : 0.0898);
  } else {
      m_thigh = atleta.peso * (isM ? 0.2832 : 0.2956);
      m_shank_foot = atleta.peso * (isM ? 0.1140 : 0.1220);
      m_arms = atleta.peso * (isM ? 0.0988 : 0.0898);
  }

  const m_sup = Math.max(0, atleta.peso - m_thigh - m_shank_foot); 

  const racioFemurTronco = L_thigh / L_trunk;
  const anguloInclinacaoTroncoRad = (20 * racioFemurTronco) * (Math.PI / 180);
  const cosInclinacao = Math.cos(anguloInclinacaoTroncoRad);
  
  let fatorTorqueLombar = 1.0 + Math.max(0, (racioFemurTronco - 1.0) * 0.15);

  const mobilidadeFuncional = (atleta.mobilidade !== undefined && atleta.mobilidade > 0) ? atleta.mobilidade : 100;
  if (mobilidadeFuncional < 100) {
      const penalidadeROM = Math.exp(0.04 * (100 - mobilidadeFuncional)) - 1;
      fatorTorqueLombar += penalidadeROM;
  }

  // Calcula o trabalho mecânico corporal para os dois cenários (uni e bilateral)
  const W_squat_body_uni = ((m_sup * G * (L_thigh * cosInclinacao)) * fatorTorqueLombar) + 
                 ((m_thigh / 2) * G * ((L_thigh * 0.59) * cosInclinacao)) + 
                 ((m_thigh / 2) * G * L_thigh); 
                 
  const W_squat_body_bi = ((m_sup * G * (L_thigh * cosInclinacao)) * fatorTorqueLombar) + 
                 (m_thigh * G * ((L_thigh * 0.59) * cosInclinacao));
                 
  const h_puxao = L_perna + (L_trunk * 0.20);

  return {
      isM, altCoM, L_arm, L_perna, L_thigh, L_shank, L_trunk,
      m_thigh, m_shank_foot, m_arms, m_sup,
      cosInclinacao, fatorTorqueLombar,
      W_squat_body_uni, W_squat_body_bi, h_puxao
  };
}