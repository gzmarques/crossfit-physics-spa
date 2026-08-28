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
    <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
      <div 
        id="instagram-card-export" 
        style={{
          width: '420px', 
          backgroundColor: '#111315',
          color: '#fff',
          fontFamily: 'sans-serif',
          padding: '40px 20px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          backgroundImage: 'linear-gradient(to bottom, #111315, #1a1a1a)'
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '32px', fontStyle: 'italic', fontWeight: '900', letterSpacing: '1px' }}>DynaWOD</h1>
          <p style={{ margin: '5px 0 0 0', color: '#8a8d94', fontSize: '13px', fontWeight: 'bold' }}>V2 - RESUMO DE TREINO</p>
          <p style={{ margin: '2px 0 0 0', color: '#8a8d94', fontSize: '12px' }}>Data: {new Date().toLocaleDateString('pt-BR')}</p>
        </div>

        <div style={{ border: '2px solid #26272b', borderRadius: '12px', padding: '20px', backgroundColor: '#181a1e' }}>
          <h2 style={{ margin: '0 0 12px 0', fontSize: '20px', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            Prescription <span style={{ fontSize: '11px', color: '#8a8d94', fontWeight: 'normal' }}>(PLANTA BAIXA DO WOD)</span>
          </h2>
          <div style={{ color: '#d1d5db', fontSize: '16px', lineHeight: '1.6' }}>
            <strong style={{ color: '#fff', fontSize: '18px' }}>TREINO {tipoTreino.replace('_', ' ')}</strong><br />
            TIME CAP: <span style={{ color: '#fff' }}>{tempoAlvo || 'N/A'}</span> • RNDS: <span style={{ color: '#fff' }}>{roundsPrescritos || 'N/A'}</span><br />
            <span style={{ color: '#8a8d94', fontSize: '14px' }}>Movimentos Cadastrados: {lousaCount}</span>
          </div>
        </div>

        <div style={{ border: '2px solid var(--dyna-red, #FF2B3D)', borderRadius: '12px', padding: '25px 15px', backgroundColor: '#181a1e', boxShadow: '0 0 25px rgba(255, 43, 61, 0.15)', position: 'relative', marginTop: '10px' }}>
          <h2 style={{ margin: 0, fontSize: '24px', position: 'absolute', top: '-15px', backgroundColor: '#181a1e', padding: '0 10px', color: 'var(--dyna-red, #FF2B3D)' }}>
            Resultado
          </h2>
          
          <div style={{ textAlign: 'center', marginBottom: '25px', marginTop: '15px' }}>
            <span style={{ fontSize: '16px', color: '#8a8d94', fontWeight: 'bold' }}>TEMPO TOTAL:</span>
            <div style={{ fontSize: '54px', fontWeight: '900', margin: '5px 0', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
              {tempoReal || '00:00'}
            </div>
            
            {isScaled ? (
              <span style={{ backgroundColor: '#FF2B3D', color: '#fff', padding: '6px 16px', borderRadius: '20px', fontSize: '16px', fontWeight: '900', letterSpacing: '1px' }}>STATUS: SCALED</span>
            ) : (
              <span style={{ backgroundColor: '#22c55e', color: '#fff', padding: '6px 16px', borderRadius: '20px', fontSize: '16px', fontWeight: '900', letterSpacing: '1px' }}>STATUS: RX</span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between' }}>
            <div style={{ flex: 1, backgroundColor: '#111315', padding: '15px 5px', borderRadius: '10px', textAlign: 'center', border: '1px solid #26272b' }}>
              <div style={{ fontSize: '11px', color: '#8a8d94', marginBottom: '10px', fontWeight: 'bold' }}>POTÊNCIA MÉDIA</div>
              
              <svg width="70" height="35" viewBox="0 0 100 50" style={{ marginBottom: '8px' }}>
                <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#26272b" strokeWidth="10" />
                <path d="M 10 50 A 40 40 0 0 1 70 20" fill="none" stroke="#FF2B3D" strokeWidth="10" strokeLinecap="round" />
                <line x1="50" y1="50" x2="65" y2="25" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                <circle cx="50" cy="50" r="4" fill="#fff" />
              </svg>

              <div style={{ fontSize: '22px', fontWeight: '900' }}>
                {resultado ? resultado.potenciaReal.toFixed(0) : 0} <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#8a8d94' }}>W</span>
              </div>
            </div>
            
            <div style={{ flex: 1, backgroundColor: '#111315', padding: '15px 5px', borderRadius: '10px', textAlign: 'center', border: '1px solid #26272b' }}>
              <div style={{ fontSize: '11px', color: '#8a8d94', marginBottom: '10px', fontWeight: 'bold' }}>GASTO ENERGÉTICO</div>
              
              <svg width="70" height="35" viewBox="0 0 100 50" style={{ marginBottom: '8px' }}>
                <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#26272b" strokeWidth="10" />
                <path d="M 10 50 A 40 40 0 0 1 85 30" fill="none" stroke="#ff9800" strokeWidth="10" strokeLinecap="round" />
                <path d="M 50 45 Q 40 45 45 30 Q 50 20 50 15 Q 50 25 55 30 Q 60 45 50 45" fill="#ff9800" />
              </svg>

              <div style={{ fontSize: '22px', fontWeight: '900' }}>
                {resultado ? resultado.gastoMetabolico.toFixed(0) : 0} <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#8a8d94' }}>kcal</span>
              </div>
            </div>
          </div>
        </div>
        
        <div style={{ textAlign: 'center', color: '#52525b', fontSize: '12px', marginTop: '10px' }}>
          Gerado pelo aplicativo DynaWOD - dynawod.com
        </div>
      </div>
    </div>
  );
}