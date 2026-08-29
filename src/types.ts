export type Modalidade = 'FOR_TIME' | 'AMRAP' | 'EMOM';
export type Sexo = 'M' | 'F';
export type NivelTecnico = 'iniciante' | 'intermediario' | 'avancado';
export type Tecnica = 'normal' | 'tng' | 'drop' | 'strict' | 'kipping' | 'butterfly';
export type Phase = 'buyin' | 'round' | 'cashout';

export interface ParamExtraOption {
  label: string;
  value: string;
}

export interface ParamExtraConfig {
  label: string;
  val: string;
  type: 'number' | 'text' | 'select';
  options?: ParamExtraOption[];
}

export interface MovimentoConfig {
  nome: string;
  grupo: string;
  categoria: string;
  usaCarga: boolean;
  estilosPermitidos: Tecnica[];
  fatorH?: number;
  isHighBox?: boolean;
  paramExtra?: ParamExtraConfig;
  paramExtra2?: ParamExtraConfig;
  isUnilateral?: boolean;
}

export interface ItemLousa {
  originalId: string;
  movId: string;
  phase: Phase;
  reps: number;
  carga: number;
  tecnica: Tecnica;
  extraVal: string;
  extraVal2?: string;
}

export interface TimelineStateItem {
  reps: number;
  start: string;
  end: string;
  carga?: number;
}

export interface AtletaPerfil {
  estatura: number;
  peso: number;
  sexo: Sexo;
  nivelTecnico: NivelTecnico;
  envergadura: number;
  perna: number;
  bf: number;
  // --- NOVAS VARIÁVEIS DE ANTROPOMETRIA AVANÇADA ---
  usaAntropometriaAvancada?: boolean;
  dataNascimento?: string;
  circTorax?: number; // em metros (ex: 1.10)
  circCoxa?: number;  // em metros (ex: 0.65)
  mobilidade?: number; // ESCALA 0 a 100 (100 = Perfeita, < 100 = Encurtamentos)
}

export interface ResultadoProcessamento {
  trabalhoReal: number;
  gastoMetabolico: number;
  potenciaEsp: number;
  potenciaReal: number;
  logDetalhesHTML: string;
}

// 1. A Prescrição (O Treino Clássico / Template)
export interface WodTemplateRecord {
  id?: string;
  created_at?: string;
  title: string;
  short_code: string;
  tipo_treino: string;
  tempo_alvo: string;
  rounds_prescritos: number;
  movimentos: ItemLousa[]; 
  creator_id?: string;
}

// 2. A Execução (O Resultado do Atleta)
export interface WodResultRecord {
  id?: string;
  created_at?: string;
  template_id: string; // Isso liga o resultado ao WOD clássico!
  athlete_id?: string;
  tempo_real: string;
  rounds_real: number;
  score_watts: number;
  score_kcal: number;
  timeline?: Record<string, TimelineStateItem>; 
  cargas_adaptadas: boolean; // True = Scaled, False = RX
}

export interface UserProfile {
  id: string;
  is_coach: boolean;
  full_name: string;
  apelido?: string;
  coach_id?: string;
  estatura: number;
  peso: number;
  sexo: 'M' | 'F';
  nivel_tecnico: string;
  envergadura: number;
  perna: number;
  bf: number;
  data_nascimento?: string;
}