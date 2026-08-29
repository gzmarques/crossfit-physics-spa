import React, { useRef } from 'react';
import { Copy, X, Download, Share2, Save } from 'lucide-react';
import { SearchableMovementSelect } from '../shared/SearchableMovementSelect';
import { movimentosDB } from '../../data/movements';
import { useWodStore } from '../../store/useWodStore';
import type { Modalidade, ItemLousa } from '../../types';

interface PrescricaoTabProps {
  currentShortCode: string | null;
  currentTemplateId: string | null;
  importarWod: () => void;
  compartilharWod: () => void;
  clonarWod: () => void;
  salvarNoSupabase: (isExporting: boolean) => void;
}

export function PrescricaoTab({
  currentShortCode, currentTemplateId, importarWod, compartilharWod, clonarWod, salvarNoSupabase
}: PrescricaoTabProps) {
  
  const { 
    nomeTreino, setNomeTreino, tipoTreino, setTipoTreino, tempoAlvo, setTempoAlvo,
    roundsPrescritos, setRoundsPrescritos, lousa, addMovimento, removeMovimento, 
    updateMovimento, reorderMovimento,
    hasBuyIn, setHasBuyIn, hasCashOut, setHasCashOut
  } = useWodStore();

  const dragItem = useRef<string | null>(null);
  const dragOverItem = useRef<string | null>(null);

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

  const renderMovimento = (item: ItemLousa) => {
    const cfg = movimentosDB[item.movId] || movimentosDB['pushup'];
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
      >
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
          <label>Carga/Téc.</label>
          <div style={{ display: 'flex', gap: '5px' }}>
            <input type="number" disabled={!cfg.usaCarga} value={item.carga} onChange={e => updateMovimento(item.originalId, 'carga', Number(e.target.value))} />
            <select value={item.tecnica} onChange={e => updateMovimento(item.originalId, 'tecnica', e.target.value)}>
              <option value="tng">T&G</option>
              <option value="drop">Drop</option>
            </select>
          </div>
        </div>
        
        <div>
          <div style={{ display: 'flex', gap: '5px' }}>
            <div style={{ flex: 1 }}>
              <label>{cfg.paramExtra ? cfg.paramExtra.label : 'Param.'}</label>
              <input type="text" disabled={!cfg.paramExtra} value={item.extraVal || ''} onChange={e => updateMovimento(item.originalId, 'extraVal', e.target.value)} />
            </div>
            {cfg.paramExtra2 && (
              <div style={{ flex: 1 }}>
                <label>{cfg.paramExtra2.label}</label>
                <select value={item.extraVal2 || cfg.paramExtra2.val} onChange={e => updateMovimento(item.originalId, 'extraVal2', e.target.value)}>
                  {cfg.paramExtra2.options?.map(opt => (
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

  return (
    <div className="panel">
      <h2>Estrutura do Treino</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '15px' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Nome do Treino (Opcional)</label>
          <input type="text" value={nomeTreino} onChange={e => setNomeTreino(e.target.value)} placeholder="Ex: Murph, Fran, Open 24.1..." />
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
      
      {/* SEÇÃO: BUY-IN */}
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: 'var(--bg-card, #181a1e)', borderRadius: '8px', border: '1px solid #333' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1rem', cursor: 'pointer', margin: 0, color: hasBuyIn ? '#f39c12' : 'var(--text-muted, #8a8d94)' }}>
          <input type="checkbox" checked={hasBuyIn} onChange={e => setHasBuyIn(e.target.checked)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
          <strong>Habilitar Buy-in</strong> (Aquecimento / Entrada)
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

      {/* SEÇÃO PRINCIPAL: WOD */}
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: 'var(--bg-card, #181a1e)', borderRadius: '8px', border: '1px solid var(--dyna-red, #FF2B3D)' }}>
        <h3 style={{ margin: '0 0 15px 0', color: 'var(--dyna-red, #FF2B3D)', fontSize: '1.1rem' }}>WOD Principal</h3>
        <div className="wod-list" style={{ marginBottom: '10px' }}>
          {lousa.filter(m => m.phase === 'round').map(item => renderMovimento(item))}
        </div>
        <button onClick={() => addMovimento(null, 'round')} style={{ backgroundColor: 'transparent', color: 'var(--dyna-red, #FF2B3D)', border: '1px dashed var(--dyna-red, #FF2B3D)', padding: '10px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', width: '100%' }}>
          + Adicionar Movimento ao WOD
        </button>
      </div>

      {/* SEÇÃO: CASH-OUT */}
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: 'var(--bg-card, #181a1e)', borderRadius: '8px', border: '1px solid #333' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1rem', cursor: 'pointer', margin: 0, color: hasCashOut ? '#2196f3' : 'var(--text-muted, #8a8d94)' }}>
          <input type="checkbox" checked={hasCashOut} onChange={e => setHasCashOut(e.target.checked)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
          <strong>Habilitar Cash-out</strong> (Finalizador / Saída)
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
        <button onClick={() => salvarNoSupabase(false)} style={{ flex: '1 1 140px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '1rem', backgroundColor: 'var(--dyna-red, #FF2B3D)', color: '#fff', border: 'none', fontWeight: 'bold' }}>
          <Save size={22} style={{ flexShrink: 0 }} /> 
          <span>{currentTemplateId ? 'Atualizar WOD' : 'Salvar WOD'}</span>
        </button>
      </div>
    </div>
  );
}