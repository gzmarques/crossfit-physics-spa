import { useState, useRef } from 'react';
import type { ItemLousa } from '../types';

export function useWodBuilder() {
  const [lousa, setLousa] = useState<ItemLousa[]>([
    { originalId: crypto.randomUUID(), movId: 'thruster', phase: 'round', reps: 21, carga: 43, tecnica: 'tng', extraVal: '' }
  ]);

  // === REFERÊNCIAS DO DRAG AND DROP ===
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const handleDragStart = (index: number) => { dragItem.current = index; };
  const handleDragEnter = (index: number) => { dragOverItem.current = index; };
  
  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.style.opacity = '1';
    if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
      const newLousa = [...lousa];
      const draggedItemContent = newLousa[dragItem.current];
      newLousa.splice(dragItem.current, 1);
      newLousa.splice(dragOverItem.current, 0, draggedItemContent);
      setLousa(newLousa);
    }
    dragItem.current = null;
    dragOverItem.current = null;
  };

  // === CONTROLE DE MOVIMENTOS ===
  const addMovimento = (baseId: string | null = null) => {
    const newId = crypto.randomUUID();
    let newItem: ItemLousa = { originalId: newId, movId: 'air_squat', phase: 'round', reps: 10, carga: 0, tecnica: 'tng', extraVal: '', extraVal2: '' };
    
    if (baseId) {
      const idx = lousa.findIndex(m => m.originalId === baseId);
      if (idx !== -1) {
        newItem = { ...lousa[idx], originalId: newId };
        const updated = [...lousa];
        updated.splice(idx + 1, 0, newItem);
        setLousa(updated);
        return;
      }
    }
    setLousa([...lousa, newItem]);
  };

  const removeMovimento = (id: string) => {
    setLousa(prev => prev.filter(m => m.originalId !== id));
  };

  const updateMovimento = (id: string, field: keyof ItemLousa, val: any) => {
    setLousa(prev => prev.map(item => item.originalId === id ? { ...item, [field]: val } : item));
  };

  return {
    lousa, setLousa,
    addMovimento, removeMovimento, updateMovimento,
    handleDragStart, handleDragEnter, handleDragEnd
  };
}