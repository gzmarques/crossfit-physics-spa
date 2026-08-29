import { create } from 'zustand';
import type { ItemLousa, Modalidade } from '../types';

interface WodState {
  // Estados
  nomeTreino: string;
  tipoTreino: Modalidade;
  tempoAlvo: string;
  roundsPrescritos: number;
  lousa: ItemLousa[];

  // Ações
  setNomeTreino: (nome: string) => void;
  setTipoTreino: (tipo: Modalidade) => void;
  setTempoAlvo: (tempo: string) => void;
  setRoundsPrescritos: (rounds: number) => void;
  setLousa: (lousa: ItemLousa[]) => void;
  addMovimento: (baseId?: string | null) => void;
  removeMovimento: (id: string) => void;
  updateMovimento: (id: string, field: keyof ItemLousa, val: any) => void;
  reorderMovimento: (fromIndex: number, toIndex: number) => void;
}

export const useWodStore = create<WodState>((set, get) => ({
  nomeTreino: '',
  tipoTreino: 'FOR_TIME',
  tempoAlvo: '05:00',
  roundsPrescritos: 3,
  lousa: [{ originalId: crypto.randomUUID(), movId: 'thruster', phase: 'round', reps: 21, carga: 43, tecnica: 'tng', extraVal: '' }],

  setNomeTreino: (nome) => set({ nomeTreino: nome }),
  setTipoTreino: (tipo) => set({ tipoTreino: tipo }),
  setTempoAlvo: (tempo) => set({ tempoAlvo: tempo }),
  setRoundsPrescritos: (rounds) => set({ roundsPrescritos: rounds }),
  setLousa: (lousa) => set({ lousa }),

  addMovimento: (baseId = null) => {
    const { lousa } = get();
    const newId = crypto.randomUUID();
    let newItem: ItemLousa = { originalId: newId, movId: 'air_squat', phase: 'round', reps: 10, carga: 0, tecnica: 'tng', extraVal: '' };
    
    if (baseId) {
      const idx = lousa.findIndex(m => m.originalId === baseId);
      if (idx !== -1) {
        newItem = { ...lousa[idx], originalId: newId };
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

  reorderMovimento: (fromIndex, toIndex) => set((state) => {
    const newLousa = [...state.lousa];
    const draggedItem = newLousa[fromIndex];
    newLousa.splice(fromIndex, 1);
    newLousa.splice(toIndex, 0, draggedItem);
    return { lousa: newLousa };
  })
}));