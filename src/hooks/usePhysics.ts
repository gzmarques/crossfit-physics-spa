import { useState, useEffect, useRef, useCallback } from 'react';
import type { 
  ItemLousa, Modalidade, AtletaPerfil, 
  TimelineStateItem, ResultadoProcessamento 
} from '../types';

interface UsePhysicsProps {
  tipoTreino: Modalidade;
  tempoAlvo: string;
  tempoReal: string;
  roundsPrescritos: number;
  roundsReal: number;
  lousa: ItemLousa[];
  atleta: AtletaPerfil;
}

export function usePhysics({
  tipoTreino, tempoAlvo, tempoReal, roundsPrescritos, roundsReal, lousa, atleta
}: UsePhysicsProps) {
  
  const [timelineState, setTimelineState] = useState<Record<string, TimelineStateItem>>({});
  const [resultado, setResultado] = useState<ResultadoProcessamento | null>(null);
  const [temperatura, setTemperatura] = useState<number>(20);
  const [umidade, setUmidade] = useState<number>(50);
  
  // Estado para controlar a UI durante o cálculo
  const [isCalculating, setIsCalculating] = useState(false);
  
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Inicializa o Worker no carregamento do hook usando a feature do Vite para workers
    workerRef.current = new Worker(new URL('../workers/physicsWorker.ts', import.meta.url), { type: 'module' });

    workerRef.current.onmessage = (event) => {
      setResultado(event.data);
      setIsCalculating(false); // Libera a UI assim que a resposta chega
    };

    return () => {
      // Limpa a memória quando o componente for destruído
      workerRef.current?.terminate();
    };
  }, []);

  const handleTimelineChange = (rowId: string, field: keyof TimelineStateItem, val: any) => {
    setTimelineState(prev => ({ ...prev, [rowId]: { ...(prev[rowId] || {}), [field]: val } }));
  };

  const processarWOD = useCallback(() => {
    if (!workerRef.current) return;
    
    setIsCalculating(true);
    // Envia toda a carga de dados para o núcleo secundário
    workerRef.current.postMessage({
      tipoTreino, tempoAlvo, tempoReal, roundsPrescritos, roundsReal,
      lousa, atleta, timelineState, temperatura, umidade
    });
  }, [tipoTreino, tempoAlvo, tempoReal, roundsPrescritos, roundsReal, lousa, atleta, timelineState, temperatura, umidade]);

  return {
    timelineState, setTimelineState, handleTimelineChange,
    resultado, setResultado, processarWOD, isCalculating,
    temperatura, setTemperatura,
    umidade, setUmidade
  };
}