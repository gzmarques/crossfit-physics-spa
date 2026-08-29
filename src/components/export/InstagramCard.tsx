import type { ResultadoProcessamento } from '../../types';

interface InstagramCardProps {
  tipoTreino: string;
  tempoAlvo: string;
  roundsPrescritos: number;
  lousaCount: number;
  tempoReal: string;
  isScaled: boolean;
  resultado: ResultadoProcessamento | null;
}

export function InstagramCard({
  tipoTreino,
  tempoAlvo,
  roundsPrescritos,
  lousaCount,
  tempoReal,
  isScaled,
  resultado
}: InstagramCardProps) {
  return (
    <div className="insta-export-wrapper">
      <div id="instagram-card-export" className="insta-card">
        
        <div className="insta-header">
          <h1 className="insta-title">DynaWOD</h1>
          <p className="insta-subtitle">V2 - RESUMO DE TREINO</p>
          <p className="insta-date">Data: {new Date().toLocaleDateString('pt-BR')}</p>
        </div>

        <div className="insta-section">
          <h2 className="insta-section-title">
            Prescription <span className="insta-section-subtitle">(PLANTA BAIXA DO WOD)</span>
          </h2>
          <div className="insta-prescription-content">
            <strong className="insta-highlight-large">TREINO {tipoTreino.replace('_', ' ')}</strong><br />
            TIME CAP: <span className="insta-highlight font-mono">{tempoAlvo || 'N/A'}</span> • RNDS: <span className="insta-highlight font-mono">{roundsPrescritos || 'N/A'}</span><br />
            <span className="insta-text-muted">Movimentos Cadastrados: <span className="font-mono">{lousaCount}</span></span>
          </div>
        </div>

        <div className="insta-result-section">
          <h2 className="insta-result-title">Resultado</h2>
          
          <div className="insta-time-container">
            <span className="insta-time-label">TEMPO TOTAL:</span>
            <div className="insta-time-value">
              {tempoReal || '00:00'}
            </div>
            
            {isScaled ? (
              <span className="insta-status insta-status-scaled">STATUS: SCALED</span>
            ) : (
              <span className="insta-status insta-status-rx">STATUS: RX</span>
            )}
          </div>

          <div className="insta-metrics-row">
            <div className="insta-metric-box">
              <div className="insta-metric-title">POTÊNCIA MÉDIA</div>
              {/* O SVG continua com estilos inline pois são atributos de desenho vetorial */}
              <svg width="70" height="35" viewBox="0 0 100 50" style={{ marginBottom: '8px' }}>
                <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#26272b" strokeWidth="10" />
                <path d="M 10 50 A 40 40 0 0 1 70 20" fill="none" stroke="#FF2B3D" strokeWidth="10" strokeLinecap="round" />
                <line x1="50" y1="50" x2="65" y2="25" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                <circle cx="50" cy="50" r="4" fill="#fff" />
              </svg>
              <div className="insta-metric-value">
                {resultado ? resultado.potenciaReal.toFixed(0) : 0} <span className="insta-metric-unit">W</span>
              </div>
            </div>
            
            <div className="insta-metric-box">
              <div className="insta-metric-title">GASTO ENERGÉTICO</div>
              <svg width="70" height="35" viewBox="0 0 100 50" style={{ marginBottom: '8px' }}>
                <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#26272b" strokeWidth="10" />
                <path d="M 10 50 A 40 40 0 0 1 85 30" fill="none" stroke="#ff9800" strokeWidth="10" strokeLinecap="round" />
                <path d="M 50 45 Q 40 45 45 30 Q 50 20 50 15 Q 50 25 55 30 Q 60 45 50 45" fill="#ff9800" />
              </svg>
              <div className="insta-metric-value">
                {resultado ? resultado.gastoMetabolico.toFixed(0) : 0} <span className="insta-metric-unit">kcal</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="insta-footer">
          Gerado pelo aplicativo DynaWOD - dynawod.com
        </div>
      </div>
    </div>
  );
}