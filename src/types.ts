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
  cargaMasc: number; // <- ATUALIZADO
  cargaFem: number;  // <- ATUALIZADO
  tecnica: Tecnica;
  extraVal: string;
  extraVal2?: string;
  carga?: number; // Prop de compatibilidade para treinos velhos no DB
}

export interface TimelineStateItem {
  reps: number;
  start: string;
  end: string;
  cargaUsada?: number; // <- ATUALIZADO
}

export interface AtletaPerfil {
  estatura: number;
  peso: number;
  sexo: Sexo;
  nivelTecnico: NivelTecnico;
  envergadura: number;
  perna: number;
  bf: number;
  usaAntropometriaAvancada?: boolean;
  dataNascimento?: string;
  circTorax?: number; 
  circCoxa?: number;  
  mobilidade?: number; 
}

export interface ResultadoProcessamento {
  trabalhoReal: number;
  gastoMetabolico: number;
  potenciaEsp: number;
  potenciaReal: number;
  logDetalhesHTML: string;
}

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
  hash?: string;
}

export interface WodResultRecord {
  id?: string;
  created_at?: string;
  template_id: string; 
  athlete_id?: string;
  tempo_real: string;
  rounds_real: number;
  score_watts: number;
  score_kcal: number;
  timeline?: Record<string, TimelineStateItem>; 
  cargas_adaptadas: boolean; 
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