import { movimentosDB } from '../../data/movements';
import type { ItemLousa, Modalidade, TimelineStateItem, ResultadoProcessamento } from '../../types';

interface AnaliseTabProps {
  tipoTreino: Modalidade;
  tempoReal: string;
  setTempoReal: (val: string) => void;
  roundsReal: number;
  setRoundsReal: (val: number) => void;
  isScaled: boolean;
  setIsScaled: (val: boolean) => void;
  lousa: ItemLousa[];
  timelineState: Record<string, TimelineStateItem>;
  handleTimelineChange: (rowId: string, field: keyof TimelineStateItem, val: any) => void;
  processarWOD: () => void;
  resultado: ResultadoProcessamento | null;
  gerarCardInstagram: () => void;
  roundsPrescritos: number;
}

export function AnaliseTab({
  tipoTreino, tempoReal, setTempoReal, roundsReal, setRoundsReal,
  isScaled, setIsScaled, lousa, timelineState, handleTimelineChange,
  processarWOD, resultado, gerarCardInstagram, roundsPrescritos
}: AnaliseTabProps) {
  return (
    <div className="panel">
      <div style={{ backgroundColor: 'var(--bg-card, #181a1e)', padding: '20px', borderRadius: '8px', borderLeft: '4px solid var(--dyna-red, #FF2B3D)', marginBottom: '25px' }}>
        <h2 style={{ margin: '0 0 10px 0', fontSize: '1.2rem' }}>Score (Resultado Real)</h2>
        <p style={{ margin: '0 0 15px 0', fontSize: '0.85rem', color: 'var(--text-muted, #8a8d94)' }}>Insira o resultado alcançado para calcular a potência gerada.</p>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>{tipoTreino === 'FOR_TIME' ? 'Tempo Real Efetivado (mm:ss)' : 'Rounds Reais Completados'}</label>
          {tipoTreino === 'FOR_TIME' ? (
            <input type="text" value={tempoReal} onChange={e => setTempoReal(e.target.value)} placeholder="Ex: 12:30" style={{ maxWidth: '250px', fontSize: '1.1rem' }} />
          ) : (
            <input type="number" step="0.1" value={roundsReal} onChange={e => setRoundsReal(Number(e.target.value))} style={{ maxWidth: '250px', fontSize: '1.1rem' }} />
          )}
        </div>
        <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input 
            type="checkbox" 
            id="checkbox-scaled"
            checked={isScaled}
            onChange={(e) => setIsScaled(e.target.checked)}
            style={{ width: '18px', height: '18px' }}
          />
          <label htmlFor="checkbox-scaled" style={{ color: '#fff', fontSize: '14px' }}>
            Marcar como Scaled (Treino Adaptado)
          </label>
        </div>
      </div>

      <h2>Timeline Expandida</h2>
      <div className="wod-list">
        {(() => {
          let rTimeline = (tipoTreino === 'FOR_TIME') ? roundsPrescritos : Math.ceil(roundsReal);
          if (rTimeline < 1) rTimeline = 1;
          const rows: any[] = [];
          const renderRow = (m: ItemLousa, badgeClass: string, badgeText: string, rIdx: number) => {
            const rowId = `${m.originalId}-R${rIdx}`;
            const cfg = movimentosDB[m.movId];
            const st = timelineState[rowId] || { reps: m.reps, start: '', end: '' };
            
            rows.push(
              <div key={rowId} className="wod-item-analise">
                <div className={`badge-round ${badgeClass}`}>{badgeText}</div>
                <div>
                  <div style={{ fontWeight: 'bold' }}>{cfg ? cfg.nome : m.movId}</div>
                  <div style={{ fontSize: '0.75rem', color: '#aaa' }}>
                    RX: {m.carga > 0 ? `${m.carga}kg` : '--'} {m.extraVal ? `| ${m.extraVal}` : ''}
                  </div>
                </div>
                <div><label>Reps</label><input type="number" value={st.reps !== undefined ? st.reps : m.reps} onChange={e => handleTimelineChange(rowId, 'reps', e.target.value === '' ? '' : Number(e.target.value))} /></div>
                
                <div>
                  <label>Carga Real</label>
                  <input 
                    type="number" 
                    value={st.carga !== undefined ? st.carga : m.carga} 
                    onChange={e => handleTimelineChange(rowId, 'carga', e.target.value === '' ? '' : Number(e.target.value))}
                    disabled={!(cfg?.usaCarga)}
                    style={{ border: isScaled && (st.carga !== undefined ? st.carga : m.carga) < m.carga ? '1px solid var(--dyna-red, #FF2B3D)' : '' }}
                  />
                </div>

                <div><label>Início</label><input type="text" placeholder="mm:ss" value={st.start || ''} onChange={e => handleTimelineChange(rowId, 'start', e.target.value)} /></div>
                <div><label>Fim</label><input type="text" placeholder="mm:ss" value={st.end || ''} onChange={e => handleTimelineChange(rowId, 'end', e.target.value)} /></div>
              </div>
            );
          };
          lousa.filter(m => m.phase === 'buyin').forEach(m => renderRow(m, 'badge-buyin', 'Buy-in', 0));
          for (let r = 1; r <= rTimeline; r++) lousa.filter(m => m.phase === 'round').forEach(m => renderRow(m, '', `R ${r}`, r));
          lousa.filter(m => m.phase === 'cashout').forEach(m => renderRow(m, 'badge-cashout', 'Cash-out', 99));
          return rows;
        })()}
      </div>

      <button onClick={processarWOD} style={{ fontSize: '1.1rem', padding: '15px', backgroundColor: 'var(--dyna-red, #FF2B3D)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', width: '100%', cursor: 'pointer', marginBottom: '20px', marginTop: '10px' }}>
        ⚡ Processar Dinâmica e Termodinâmica
      </button>

      {resultado && (
        <div className="results">
          <h2>Painel de Resultado Biomecânico</h2>
          <div className="grid" style={{ marginBottom: 0 }}>
            <div style={{ margin: '15px 0' }}><div className="result-value color-mech">{resultado.trabalhoReal.toFixed(0)} J</div><div>Trabalho Mecânico</div></div>
            <div style={{ margin: '15px 0' }}><div className="result-value color-metabolic">{resultado.gastoMetabolico.toFixed(0)} kCal</div><div>Gasto Termodinâmico (+ EPOC)</div></div>
            <div style={{ margin: '15px 0' }}><div className="result-value" style={{ color: '#aaa' }}>{resultado.potenciaEsp > 0 ? resultado.potenciaEsp.toFixed(1) + ' W' : '-- W'}</div><div>Potência Esperada</div></div>
            <div style={{ margin: '15px 0' }}><div className="result-value" style={{ color: '#4caf50' }}>{resultado.potenciaReal > 0 ? resultado.potenciaReal.toFixed(1) + ' W' : '-- W'}</div><div>Potência Real Executada</div></div>
          </div>
          <div className="result-detail" dangerouslySetInnerHTML={{ __html: resultado.logDetalhesHTML }} />
        </div>
      )}
      <button 
        onClick={gerarCardInstagram} 
        style={{ 
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', 
          fontSize: '1rem', backgroundColor: '#8a33e2',
          color: '#fff', border: 'none', fontWeight: 'bold', 
          padding: '12px 20px', borderRadius: '8px', width: '100%', marginTop: '20px'
        }}
      >
        📸 Compartilhar no Instagram
      </button>
    </div>
  );
}