import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { UserProfile, WodTemplateRecord } from '../../types';

interface HistoricoTabProps {
  selectedAthleteId: string;
  userProfile: UserProfile | null;
  sessionId: string | undefined;
  coachIdInput: string;
  setCoachIdInput: (val: string) => void;
  linkToCoach: () => void;
  savedWods: WodTemplateRecord[];
  carregarDoSupabase: (rec: any) => void;
}

export function HistoricoTab({
  selectedAthleteId, userProfile, sessionId, coachIdInput,
  setCoachIdInput, linkToCoach, savedWods, carregarDoSupabase
}: HistoricoTabProps) {
  return (
    <div className="panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Histórico de Desempenho {selectedAthleteId !== 'me' ? '(Aluno)' : ''}</h2>
        {selectedAthleteId === 'me' && !userProfile?.is_coach && (
          <div style={{ display: 'flex', gap: '5px' }}>
            <input type="text" placeholder="ID do seu Coach..." value={coachIdInput} onChange={e => setCoachIdInput(e.target.value)} style={{ padding: '8px' }} />
            <button onClick={linkToCoach} style={{ width: 'auto', padding: '8px 15px', backgroundColor: '#388e3c' }}>Vincular</button>
          </div>
        )}
      </div>

      {selectedAthleteId === 'me' && sessionId && (
        <div style={{ marginBottom: '20px', padding: '10px', background: 'var(--bg-card, #181a1e)', border: '1px dashed var(--line-silver, #26272b)', borderRadius: '4px', fontSize: '0.9rem' }}>
          <strong>Seu ID de Atleta (Passe para o seu Coach):</strong> <span style={{ color: '#4caf50', userSelect: 'all' }}>{sessionId}</span>
        </div>
      )}
      
      {savedWods.length > 0 ? (
        <>
          <div style={{ width: '100%', height: 300, marginBottom: '40px', backgroundColor: 'var(--bg-card, #181a1e)', padding: '20px', borderRadius: '8px' }}>
            <ResponsiveContainer>
              <LineChart data={[...savedWods].reverse()} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis dataKey="created_at" tickFormatter={(tick) => new Date(tick as string).toLocaleDateString('pt-BR')} stroke="#aaa" />
                <YAxis yAxisId="left" stroke="#4caf50" />
                <YAxis yAxisId="right" orientation="right" stroke="#ff9800" />
                <Tooltip labelFormatter={(label) => new Date(label as string).toLocaleDateString('pt-BR')} contentStyle={{ backgroundColor: '#1e1e1e', border: 'none' }} />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="score_watts" name="Potência (Watts)" stroke="#4caf50" strokeWidth={3} activeDot={{ r: 8 }} />
                <Line yAxisId="right" type="monotone" dataKey="score_kcal" name="Gasto (kCal)" stroke="#ff9800" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
            {savedWods.map(w => (
              <div key={w.id} style={{ background: 'var(--bg-card, #181a1e)', padding: '20px', borderRadius: '8px', borderLeft: '4px solid var(--dyna-burgundy, #7A0F1B)' }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '1.2rem' }}>{w.title}</h3>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted, #8a8d94)', marginBottom: '15px' }}>
                  <strong>Data:</strong> {new Date(w.created_at || '').toLocaleDateString('pt-BR')}<br />
                  <strong>Resultado:</strong> {(w as any).score_watts?.toFixed(1) || '--'} W | {(w as any).score_kcal?.toFixed(0) || '--'} kCal
                </div>
                <button onClick={() => carregarDoSupabase(w)} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--line-silver, #26272b)', color: '#fff', border: '1px solid #444', borderRadius: '4px', cursor: 'pointer' }}>Carregar Treino</button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p style={{ color: 'var(--text-muted, #8a8d94)', textAlign: 'center', padding: '20px' }}>Nenhum treino salvo para este atleta.</p>
      )}
    </div>
  );
}