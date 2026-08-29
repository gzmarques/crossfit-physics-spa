import { create } from 'zustand';
import type { ItemLousa, Modalidade, Phase } from '../types';

interface WodState {
  // Estados
  nomeTreino: string;
  tipoTreino: Modalidade;
  tempoAlvo: string;
  roundsPrescritos: number;
  lousa: ItemLousa[];
  
  // Toggles de Visibilidade/Ativação
  hasBuyIn: boolean;
  hasCashOut: boolean;

  // Ações
  setNomeTreino: (nome: string) => void;
  setTipoTreino: (tipo: Modalidade) => void;
  setTempoAlvo: (tempo: string) => void;
  setRoundsPrescritos: (rounds: number) => void;
  setLousa: (lousa: ItemLousa[]) => void;
  
  setHasBuyIn: (val: boolean) => void;
  setHasCashOut: (val: boolean) => void;

  addMovimento: (baseId?: string | null, phase?: Phase) => void;
  removeMovimento: (id: string) => void;
  updateMovimento: (id: string, field: keyof ItemLousa, val: any) => void;
  reorderMovimento: (fromId: string, toId: string) => void;
}

export const useWodStore = create<WodState>((set, get) => ({
  nomeTreino: '',
  tipoTreino: 'FOR_TIME',
  tempoAlvo: '05:00',
  roundsPrescritos: 3,
  lousa: [{ originalId: crypto.randomUUID(), movId: 'thruster', phase: 'round', reps: 21, carga: 43, tecnica: 'tng', extraVal: '' }],
  
  hasBuyIn: false,
  hasCashOut: false,

  setNomeTreino: (nome) => set({ nomeTreino: nome }),
  setTipoTreino: (tipo) => set({ tipoTreino: tipo }),
  setTempoAlvo: (tempo) => set({ tempoAlvo: tempo }),
  setRoundsPrescritos: (rounds) => set({ roundsPrescritos: rounds }),
  
  // Ao carregar um WOD (ex: do Histórico), ativamos os painéis automaticamente se houver dados
  setLousa: (lousa) => set({ 
    lousa,
    hasBuyIn: lousa.some(m => m.phase === 'buyin'),
    hasCashOut: lousa.some(m => m.phase === 'cashout')
  }),

  // Se o usuário desativar o painel, removemos os movimentos daquela fase
  setHasBuyIn: (val) => set((state) => ({
    hasBuyIn: val,
    lousa: val ? state.lousa : state.lousa.filter(m => m.phase !== 'buyin')
  })),

  setHasCashOut: (val) => set((state) => ({
    hasCashOut: val,
    lousa: val ? state.lousa : state.lousa.filter(m => m.phase !== 'cashout')
  })),

  addMovimento: (baseId = null, phase = 'round') => {
    const { lousa } = get();
    const newId = crypto.randomUUID();
    let newItem: ItemLousa = { originalId: newId, movId: 'air_squat', phase, reps: 10, carga: 0, tecnica: 'tng', extraVal: '' };
    
    if (baseId) {
      const idx = lousa.findIndex(m => m.originalId === baseId);
      if (idx !== -1) {
        newItem = { ...lousa[idx], originalId: newId, phase }; 
        const updated = [...lousa];
        updated.splice(idx + 1, 0, newItem);
        set({ lousa: updated });
        return;
      }
    }
    set({ lousa: [...lousa, newItem] });
  },

  removeMovimento: (id) => set((state) => ({
    lousa: state.lousa.filter(m => m.originalId !== id)
  })),

  updateMovimento: (id, field, val) => set((state) => ({
    lousa: state.lousa.map(item => item.originalId === id ? { ...item, [field]: val } : item)
  })),

  // Modificado para usar ID no Drag and Drop (evita bugs ao arrastar em listas filtradas)
  reorderMovimento: (fromId, toId) => set((state) => {
    const fromIndex = state.lousa.findIndex(m => m.originalId === fromId);
    const toIndex = state.lousa.findIndex(m => m.originalId === toId);
    
    if (fromIndex === -1 || toIndex === -1) return state;

    const newLousa = [...state.lousa];
    const [draggedItem] = newLousa.splice(fromIndex, 1);
    newLousa.splice(toIndex, 0, draggedItem);
    return { lousa: newLousa };
  })
}));