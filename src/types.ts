export type Modalidade = 'FOR_TIME' | 'AMRAP' | 'EMOM';
export type Sexo = 'M' | 'F';
export type NivelTecnico = 'iniciante' | 'intermediario' | 'avancado';
export type Tecnica = 'tng' | 'drop';
export type Phase = 'buyin' | 'round' | 'cashout';

export interface ParamExtraConfig {
  label: string;
  val: string;
  type: string;
}

export interface MovimentoConfig {
  nome: string;
  grupo: string;
  categoria: string;
  usaCarga: boolean;
  fatorH?: number;
  isHighBox?: boolean;
  paramExtra?: ParamExtraConfig;
}

export interface ItemLousa {
  originalId: string;
  movId: string;
  phase: Phase;
  reps: number;
  carga: number;
  tecnica: Tecnica;
  extraVal: string;
}

export interface TimelineStateItem {
  reps: number;
  start: string;
  end: string;
}

export interface AtletaPerfil {
  estatura: number;
  peso: number;
  sexo: Sexo;
  nivelTecnico: NivelTecnico;
  envergadura: number;
  perna: number;
  bf: number;
}

export interface ResultadoProcessamento {
  trabalhoReal: number;
  gastoMetabolico: number;
  potenciaEsp: number;
  potenciaReal: number;
  logDetalhesHTML: string;
}

export interface WodDatabaseRecord {
  id?: string;
  created_at?: string;
  title: string;
  tipo_treino: Modalidade;
  tempo_alvo: string;
  rounds_prescritos: number;
  rounds_real?: number;
  tempo_real?: string;
  tempo_descanso?: number;
  atleta: AtletaPerfil;
  movimentos: ItemLousa[];
  timeline?: Record<string, TimelineStateItem>;
  score_watts?: number;
  score_kcal?: number;
  athlete_id?: string;
  user_id?: string;
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
}