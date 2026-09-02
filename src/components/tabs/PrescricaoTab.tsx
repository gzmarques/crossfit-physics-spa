import React, { useRef, useState, useEffect } from 'react';
import { Copy, X, Download, Share2, Save, Edit2 } from 'lucide-react';
import { SearchableMovementSelect } from '../shared/SearchableMovementSelect';
import { movimentosDB } from '../../data/movements';
import { useWodStore } from '../../store/useWodStore';
import type { Modalidade, ItemLousa } from '../../types';
import { SearchableWodSelect } from '../shared/SearchableWodSelect';

interface PrescricaoTabProps {
  currentShortCode: string | null;
  currentTemplateId: string | null;
  importarWod: () => void;
  compartilharWod: () => void;
  clonarWod: () => void;
  salvarNoSupabase: (isExporting: boolean) => void;
  carregarDoSupabase: (wod: any) => void; 
}

// Cores vivas que simulam giz colorido na lousa escura
const CHALK_COLORS = ['#ffffff', '#ffeb3b', '#81c784', '#64b5f6', '#ff8a65', '#ce93d8', '#ff4081'];

export function PrescricaoTab({
  currentShortCode, currentTemplateId, importarWod, compartilharWod, clonarWod, salvarNoSupabase, carregarDoSupabase
}: PrescricaoTabProps) {
  
  const { 
    nomeTreino, setNomeTreino, tipoTreino, setTipoTreino, tempoAlvo, setTempoAlvo,
    roundsPrescritos, setRoundsPrescritos, lousa, addMovimento, removeMovimento, 
    updateMovimento, reorderMovimento, hasBuyIn, setHasBuyIn, hasCashOut, setHasCashOut
  } = useWodStore();

  const [isEditing, setIsEditing] = useState(false);
  const [colorPalette, setColorPalette] = useState<string[]>([]);

  const dragItem = useRef<string | null>(null);
  const dragOverItem = useRef<string | null>(null);

  // Embaralha as cores toda vez que a estrutura do WOD for alterada ou carregada
  useEffect(() => {
    const shuffleArray = (array: string[]) => {
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    };
    setColorPalette(shuffleArray(CHALK_COLORS).slice(0, 4));
  }, [lousa.length, nomeTreino, tipoTreino, currentTemplateId]);

  // Desestruturando a paleta embaralhada para os elementos específicos
  const [cTime, cReps, cName, cSpecs] = colorPalette.length === 4 ? colorPalette : CHALK_COLORS.slice(0,4);

  const handleDragStart = (id: string) => { dragItem.current = id; };
  const handleDragEnter = (id: string) => { dragOverItem.current = id; };
  
  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.style.opacity = '1';
    if (dragItem.current && dragOverItem.current && dragItem.current !== dragOverItem.current) {
      reorderMovimento(dragItem.current, dragOverItem.current);
    }
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const handleSaveAndExit = (isExporting: boolean) => {
    salvarNoSupabase(isExporting);
    setIsEditing(false); // Fecha a edição ao salvar
  };

  const carregarEDesabilitarEdicao = (wod: any) => {
    carregarDoSupabase(wod);
    setIsEditing(false); // Se importou um wod, vai para o modo leitura
  }

  const renderChalkItem = (item: ItemLousa) => {
    const cfg = movimentosDB[item.movId];
    const nome = cfg ? cfg.nome : item.movId;
    const isDesconhecido = !cfg;
    
    const cM = item.cargaMasc !== undefined ? item.cargaMasc : (item.carga || 0);
    const cF = item.cargaFem !== undefined ? item.cargaFem : (item.carga || 0);
    
    // --- CORREÇÃO DO SCRAPER VS MANUAL ---
    let sufixo = "";
    let extraParaExibir = item.extraVal ? item.extraVal.trim().toLowerCase() : "";

    // 1. Se o scraper colocou 'cal' ou 'm' direto no extraVal, interceptamos aqui
    if (extraParaExibir === 'cal' || extraParaExibir === 'm') {
      sufixo = extraParaExibir;
      extraParaExibir = ""; // Limpa para não aparecer entre parênteses duplicado
    } 
    // 2. Caso contrário, tenta ler do extraVal2 (padrão quando você cria o treino manualmente)
    else if (cfg?.paramExtra2?.label === 'Unidade') {
      const unidade = item.extraVal2 || cfg.paramExtra2.val;
      sufixo = unidade;
    } 
    // 3. Fallback para corrida tradicional
    else if (cfg?.categoria === 'corrida' || cfg?.categoria === 'air_runner') {
      sufixo = 'm'; 
    }

    // Formatação visual: 'cal' ganha um espaço ("30 cal"), 'm' fica colado ("500m")
    if (sufixo === 'cal') sufixo = ' cal';

    const specs = [];
    if (cM || cF) specs.push(`${cM > 0 ? cM : '--'}/${cF > 0 ? cF : '--'}kg`);
    if (extraParaExibir) specs.push(item.extraVal); // Restaura maiúsculas/minúsculas originais se for outro texto
    if (item.tecnica !== 'normal') specs.push(item.tecnica.toUpperCase());

    return (
      <div key={item.originalId} className="chalk-item">
        <span style={{ color: cReps }}>
          {item.reps}{sufixo}
        </span>
        <span style={{ color: cName, textDecoration: isDesconhecido ? 'underline wavy red' : 'none' }}>
          {nome}
        </span>
        {specs.length > 0 && (
          <span style={{ color: cSpecs }}>({specs.join(' | ')})</span>
        )}
      </div>
    );
  };

  const renderMovimento = (item: ItemLousa) => {
    const cfg = movimentosDB[item.movId];
    const isDesconhecido = !cfg; 
    const safeCfg = cfg || movimentosDB['pushup'];
    
    const cM = item.cargaMasc !== undefined ? item.cargaMasc : (item.carga || 0);
    const cF = item.cargaFem !== undefined ? item.cargaFem : (item.carga || 0);

    return (
      <div 
        key={item.originalId} 
        className="wod-item"
        draggable
        onDragStart={(e) => {
          handleDragStart(item.originalId);
          e.currentTarget.style.opacity = '0.5';
        }}
        onDragEnter={() => handleDragEnter(item.originalId)}
        onDragEnd={handleDragEnd}
        onDragOver={(e) => e.preventDefault()}
        style={{ 
          gridTemplateColumns: '1.5fr 0.6fr 1fr 1.2fr 0.8fr auto',
          border: isDesconhecido ? '2px dashed #ff9800' : 'none' 
        }} 
      >
        {isDesconhecido && (
          <div style={{ gridColumn: '1 / -1', color: '#ff9800', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '10px' }}>
            ⚠️ Atenção: O movimento "{item.movId}" não está mapeado no motor. Os cálculos usarão um perfil genérico.
          </div>
        )}
      
        <div className="drag-handle">
          <svg width="10" height="20" viewBox="0 0 8 20" fill="currentColor">
            <circle cx="2" cy="2" r="1.5"/><circle cx="6" cy="2" r="1.5"/>
            <circle cx="2" cy="10" r="1.5"/><circle cx="6" cy="10" r="1.5"/>
            <circle cx="2" cy="18" r="1.5"/><circle cx="6" cy="18" r="1.5"/>
          </svg>
        </div>

        <div>
          <label>Movimento</label>
          <div style={{ marginTop: '5px' }}>
            <SearchableMovementSelect 
              value={item.movId} 
              onChange={(newId) => updateMovimento(item.originalId, 'movId', newId)} 
              movimentosDB={movimentosDB} 
            />
          </div>
        </div>
        
        <div>
          <label>Reps/Mts</label>
          <input type="number" value={item.reps} onChange={e => updateMovimento(item.originalId, 'reps', Number(e.target.value))} />
        </div>
        
        <div>
          <label>Carga ♂ / ♀</label>
          <div style={{ display: 'flex', gap: '5px' }}>
            <input type="number" placeholder="Masc" disabled={!safeCfg.usaCarga} value={cM} onChange={e => updateMovimento(item.originalId, 'cargaMasc', Number(e.target.value))} style={{ flex: 1 }} />
            <input type="number" placeholder="Fem" disabled={!safeCfg.usaCarga} value={cF} onChange={e => updateMovimento(item.originalId, 'cargaFem', Number(e.target.value))} style={{ flex: 1 }} />
          </div>
        </div>

        <div>
          <label>Técnica</label>
          <select value={item.tecnica} onChange={e => updateMovimento(item.originalId, 'tecnica', e.target.value)}>
            <option value="normal">Normal</option>
            <option value="tng">T&G</option>
            <option value="drop">Drop</option>
            <option value="strict">Strict</option>
            <option value="kipping">Kipping</option>
          </select>
        </div>
        
        <div>
          <div style={{ display: 'flex', gap: '5px' }}>
            <div style={{ flex: 1 }}>
              <label>{safeCfg.paramExtra ? safeCfg.paramExtra.label : 'Param.'}</label>
              <input type="text" disabled={!safeCfg.paramExtra} value={item.extraVal || ''} onChange={e => updateMovimento(item.originalId, 'extraVal', e.target.value)} />
            </div>
            {safeCfg.paramExtra2 && (
              <div style={{ flex: 1 }}>
                <label>{safeCfg.paramExtra2.label}</label>
                <select value={item.extraVal2 || safeCfg.paramExtra2.val} onChange={e => updateMovimento(item.originalId, 'extraVal2', e.target.value)}>
                  {safeCfg.paramExtra2.options?.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
        
        <div className="actions-col">
          <button className="btn-action" onClick={() => addMovimento(item.originalId, item.phase)} title="Duplicar">
            <Copy size={"1.2em"} color="var(--line-silver)" />
          </button>
          <button className="btn-remove" onClick={() => removeMovimento(item.originalId)}><X size={"1.2em"} /></button>
        </div>
      </div>
    );
  };

  // --- MODO VISUALIZAÇÃO (LOUSA) ---
  if (!isEditing) {
    return (
      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px' }}>
           <button onClick={() => setIsEditing(true)} style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#333' }}>
             <Edit2 size={18} /> Editar Lousa
           </button>
        </div>

        <div className="blackboard-wrapper">
          <div className="chalk-header">
            <h2 className="chalk-title" style={{ color: cTime }}>{nomeTreino || "WOD do Dia"}</h2>
            <div className="chalk-meta" style={{ color: cTime }}>
              {tipoTreino === 'FOR_TIME' 
                ? (roundsPrescritos > 0 ? `${roundsPrescritos} Rounds For Time • Cap: ${tempoAlvo}` : `For Time • Cap: ${tempoAlvo}`)
                : `${tipoTreino} ${tempoAlvo}`
              }
            </div>
          </div>

          {hasBuyIn && lousa.filter(m => m.phase === 'buyin').length > 0 && (
            <div className="chalk-section">
              <div className="chalk-section-title" style={{ color: cTime }}>Buy-in</div>
              {lousa.filter(m => m.phase === 'buyin').map(renderChalkItem)}
            </div>
          )}

          <div className="chalk-section">
            <div className="chalk-section-title" style={{ color: cTime }}>WOD Principal</div>
            {lousa.filter(m => m.phase === 'round').map(renderChalkItem)}
          </div>

          {hasCashOut && lousa.filter(m => m.phase === 'cashout').length > 0 && (
            <div className="chalk-section">
              <div className="chalk-section-title" style={{ color: cTime }}>Cash-out</div>
              {lousa.filter(m => m.phase === 'cashout').map(renderChalkItem)}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '20px' }}>
          <button onClick={importarWod} style={{ flex: '1 1 140px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--line-silver)' }}>
            <Download size={22} /> Importar WOD
          </button>
          <button onClick={() => setIsEditing(true)} style={{ flex: '1 1 140px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: '#388e3c' }}>
            <Edit2 size={22} /> Editar Treino Atual
          </button>
        </div>
      </div>
    );
  }

  // --- MODO EDIÇÃO ---
  return (
    <div className="panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h2 style={{ borderBottom: 'none', margin: 0 }}>Modo Edição</h2>
        <button onClick={() => setIsEditing(false)} style={{ width: 'auto', padding: '8px 12px', backgroundColor: '#333' }}>
          Voltar para Lousa
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '15px' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Nome do Treino (Opcional)</label>
          <SearchableWodSelect 
            value={nomeTreino} 
            onChange={setNomeTreino} 
            onSelectWod={carregarEDesabilitarEdicao} 
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Modalidade</label>
          <select value={tipoTreino} onChange={e => setTipoTreino(e.target.value as Modalidade)}>
            <option value="FOR_TIME">For Time</option>
            <option value="AMRAP">AMRAP</option>
            <option value="EMOM">EMOM</option>
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>{tipoTreino === 'FOR_TIME' ? 'Time Cap (mm:ss)' : 'Tempo Total'}</label>
          <input type="text" value={tempoAlvo} onChange={e => setTempoAlvo(e.target.value)} placeholder="Ex: 10:00" />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Rounds Prescritos</label>
          <input type="number" value={roundsPrescritos} onChange={e => setRoundsPrescritos(Number(e.target.value))} />
        </div>
      </div>

      <hr style={{ borderColor: 'var(--line-silver, #26272b)', margin: '25px 0' }} />

      <h2>Quadro de Movimentos</h2>
      
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: 'var(--bg-card, #181a1e)', borderRadius: '8px', border: '1px solid #333' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1rem', cursor: 'pointer', margin: 0, color: hasBuyIn ? '#f39c12' : 'var(--text-muted, #8a8d94)' }}>
          <input type="checkbox" checked={hasBuyIn} onChange={e => setHasBuyIn(e.target.checked)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
          <strong>Habilitar Buy-in</strong>
        </label>
        
        {hasBuyIn && (
          <div style={{ marginTop: '15px' }}>
            <div className="wod-list" style={{ marginBottom: '10px' }}>
              {lousa.filter(m => m.phase === 'buyin').map(item => renderMovimento(item))}
            </div>
            <button onClick={() => addMovimento(null, 'buyin')} style={{ backgroundColor: 'transparent', color: '#f39c12', border: '1px dashed #f39c12', padding: '10px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', width: '100%' }}>
              + Adicionar Movimento (Buy-in)
            </button>
          </div>
        )}
      </div>

      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: 'var(--bg-card, #181a1e)', borderRadius: '8px', border: '1px solid var(--dyna-red, #FF2B3D)' }}>
        <h3 style={{ margin: '0 0 15px 0', color: 'var(--dyna-red, #FF2B3D)', fontSize: '1.1rem' }}>WOD Principal</h3>
        <div className="wod-list" style={{ marginBottom: '10px' }}>
          {lousa.filter(m => m.phase === 'round').map(item => renderMovimento(item))}
        </div>
        <button onClick={() => addMovimento(null, 'round')} style={{ backgroundColor: 'transparent', color: 'var(--dyna-red, #FF2B3D)', border: '1px dashed var(--dyna-red, #FF2B3D)', padding: '10px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', width: '100%' }}>
          + Adicionar Movimento ao WOD
        </button>
      </div>

      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: 'var(--bg-card, #181a1e)', borderRadius: '8px', border: '1px solid #333' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1rem', cursor: 'pointer', margin: 0, color: hasCashOut ? '#2196f3' : 'var(--text-muted, #8a8d94)' }}>
          <input type="checkbox" checked={hasCashOut} onChange={e => setHasCashOut(e.target.checked)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
          <strong>Habilitar Cash-out</strong>
        </label>
        
        {hasCashOut && (
          <div style={{ marginTop: '15px' }}>
            <div className="wod-list" style={{ marginBottom: '10px' }}>
              {lousa.filter(m => m.phase === 'cashout').map(item => renderMovimento(item))}
            </div>
            <button onClick={() => addMovimento(null, 'cashout')} style={{ backgroundColor: 'transparent', color: '#2196f3', border: '1px dashed #2196f3', padding: '10px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', width: '100%' }}>
              + Adicionar Movimento (Cash-out)
            </button>
          </div>
        )}
      </div>

      <hr style={{ borderColor: 'var(--line-silver, #26272b)', margin: '25px 0' }} />
      
      <h2>Gerenciar WOD</h2>
      {currentShortCode && (
        <p style={{ color: 'var(--text-muted, #8a8d94)', fontSize: '0.9rem', marginBottom: '15px' }}>
          Código deste treino: <strong style={{ color: '#fff', letterSpacing: '2px' }}>{currentShortCode}</strong>
        </p>
      )}
      
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
        <button onClick={importarWod} style={{ flex: '1 1 140px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '1rem', backgroundColor: 'var(--bg-card, #181a1e)', color: '#fff', border: '1px solid var(--line-silver, #26272b)' }}>
          <Download size={22} style={{ flexShrink: 0 }} /> 
          <span>Importar</span>
        </button>
        <button onClick={compartilharWod} style={{ flex: '1 1 140px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '1rem', backgroundColor: 'var(--dyna-burgundy, #7A0F1B)', color: '#fff', border: 'none', fontWeight: '600' }}>
          <Share2 size={22} style={{ flexShrink: 0 }} /> 
          <span>Copiar</span>
        </button>
        {currentTemplateId && (
          <button onClick={clonarWod} style={{ flex: '1 1 140px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '1rem', backgroundColor: '#3b82f6', color: '#fff', border: 'none', fontWeight: 'bold' }}>
            <Copy size={22} style={{ flexShrink: 0 }} /> 
            <span>Duplicar</span>
          </button>
        )}
        <button onClick={() => handleSaveAndExit(false)} style={{ flex: '1 1 140px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '1rem', backgroundColor: 'var(--dyna-red, #FF2B3D)', color: '#fff', border: 'none', fontWeight: 'bold' }}>
          <Save size={22} style={{ flexShrink: 0 }} /> 
          <span>{currentTemplateId ? 'Atualizar WOD' : 'Salvar Lousa'}</span>
        </button>
      </div>
    </div>
  );
}