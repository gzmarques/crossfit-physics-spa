import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useState, useEffect } from 'react';
import { movimentosDB } from './data/movements';
import { supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js'; 
import type { 
  AtletaPerfil, ItemLousa, Modalidade, 
  ResultadoProcessamento, TimelineStateItem, WodDatabaseRecord 
} from './types';
import { calcularFisica, parseClockTime } from './utils/physicsEngine';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Adicionada a aba 'historico'
  const [activeTab, setActiveTab] = useState<'prescricao' | 'analise' | 'historico'>('prescricao');
  const [tipoTreino, setTipoTreino] = useState<Modalidade>('FOR_TIME');
  const [tempoAlvo, setTempoAlvo] = useState('05:00');
  const [roundsPrescritos, setRoundsPrescritos] = useState(3);
  const [roundsReal, setRoundsReal] = useState(0);
  const [tempoReal, setTempoReal] = useState('');
  const [tempoDescanso, setTempoDescanso] = useState(0);

  const [atleta, setAtleta] = useState<AtletaPerfil>({
    estatura: 1.75, peso: 80, sexo: 'M', nivelTecnico: 'intermediario', envergadura: 1.75, perna: 0.85, bf: 15
  });

  const [lousa, setLousa] = useState<ItemLousa[]>([
    { originalId: crypto.randomUUID(), movId: 'thruster', phase: 'round', reps: 21, carga: 43, tecnica: 'tng', extraVal: '' }
  ]);
  const [timelineState, setTimelineState] = useState<Record<string, TimelineStateItem>>({});
  
  const [resultado, setResultado] = useState<ResultadoProcessamento | null>(null);
  const [jsonInOut, setJsonInOut] = useState('');
  const [savedWods, setSavedWods] = useState<WodDatabaseRecord[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingAuth(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) fetchWodsFromSupabase();
  }, [session]);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSavedWods([]);
  };

  const fetchWodsFromSupabase = async () => {
    const { data, error } = await supabase.from('wods').select('*').order('created_at', { ascending: false });
    if (!error && data) setSavedWods(data as WodDatabaseRecord[]);
  };

  const addMovimento = (baseId: string | null = null) => {
    const newId = crypto.randomUUID();
    let newItem: ItemLousa = { originalId: newId, movId: 'air_squat', phase: 'round', reps: 10, carga: 0, tecnica: 'tng', extraVal: '' };
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

  const removeMovimento = (id: string) => setLousa(lousa.filter(m => m.originalId !== id));
  const updateMovimento = (id: string, field: keyof ItemLousa, val: any) => setLousa(lousa.map(item => item.originalId === id ? { ...item, [field]: val } : item));
  const handleTimelineChange = (rowId: string, field: keyof TimelineStateItem, val: any) => setTimelineState(prev => ({ ...prev, [rowId]: { ...(prev[rowId] || { reps: 0, start: '', end: '' }), [field]: val } }));

  const exportarJSON = () => setJsonInOut(JSON.stringify({ tipoTreino, tempoAlvo, roundsPrescritos, atleta, movimentos: lousa, timeline: timelineState }, null, 2));
  
  const importarJSON = () => {
    try {
      const wod = JSON.parse(jsonInOut);
      if (wod.tipoTreino) setTipoTreino(wod.tipoTreino);
      if (wod.tempoAlvo) setTempoAlvo(wod.tempoAlvo);
      if (wod.roundsPrescritos) setRoundsPrescritos(wod.roundsPrescritos);
      if (wod.atleta) setAtleta(wod.atleta);
      if (wod.movimentos) setLousa(wod.movimentos);
      if (wod.timeline) setTimelineState(wod.timeline);
      alert('WOD Importado com sucesso!');
    } catch (e) { alert('JSON Inválido'); }
  };

  const salvarNoSupabase = async () => {
    if (!session) return;
    const wodPayload: WodDatabaseRecord = {
      title: `Treino ${tipoTreino} - ${new Date().toLocaleDateString('pt-BR')}`,
      tipo_treino: tipoTreino, tempo_alvo: tempoAlvo, rounds_prescritos: roundsPrescritos,
      rounds_real: roundsReal, tempo_real: tempoReal, tempo_descanso: tempoDescanso,
      atleta, movimentos: lousa, timeline: timelineState,
      score_watts: resultado ? resultado.potenciaReal : 0,
      score_kcal: resultado ? resultado.gastoMetabolico : 0
    };
    
    const { error } = await supabase.from('wods').insert([wodPayload]);
    if (error) alert('Erro ao salvar no Supabase: ' + error.message);
    else { alert('Treino salvo no DynaWOD!'); fetchWodsFromSupabase(); }
  };

  const carregarDoSupabase = (rec: WodDatabaseRecord) => {
    setTipoTreino(rec.tipo_treino); setTempoAlvo(rec.tempo_alvo); setRoundsPrescritos(rec.rounds_prescritos);
    if (rec.rounds_real !== undefined) setRoundsReal(rec.rounds_real);
    if (rec.tempo_real) setTempoReal(rec.tempo_real);
    if (rec.tempo_descanso) setTempoDescanso(rec.tempo_descanso);
    if (rec.atleta) setAtleta(rec.atleta);
    if (rec.movimentos) setLousa(rec.movimentos);
    if (rec.timeline) setTimelineState(rec.timeline);
    setActiveTab('prescricao'); // Direciona para a lousa após carregar
  };

  const processarWOD = () => {
    // ... [O CÓDIGO DA ENGINE FÍSICA FICA AQUI INTACTO - Cole o bloco processarWOD() que já usávamos] ...
    // NOTA: Para economizar espaço nesta visualização, cole a função processarWOD() original aqui.
  };

  if (loadingAuth) return <div style={{textAlign: 'center', marginTop: '50px'}}>Iniciando DynaWOD...</div>;

  if (!session) {
    return (
      <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <div className="panel" style={{ textAlign: 'center', maxWidth: '400px', width: '100%', padding: '40px 20px' }}>
          <h1 style={{ border: 'none', marginBottom: '10px' }}>DynaWOD</h1>
          <p style={{ color: '#aaa', marginBottom: '30px' }}>Seu motor biomecânico. Calcule potência e gasto metabólico real.</p>
          <button onClick={signInWithGoogle} style={{ backgroundColor: '#fff', color: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '1rem' }}>
            <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/><path fill="none" d="M1 1h22v22H1z"/></svg>
            Entrar com Conta Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h1 style={{ margin: 0, border: 'none', paddingBottom: 0 }}>DynaWOD</h1>
        <button onClick={signOut} style={{ width: 'auto', backgroundColor: '#333', padding: '8px 15px', fontSize: '0.85rem' }}>Sair</button>
      </div>
      
      {/* ... [Painel de Estrutura Base e Perfil do Atleta continuam iguais] ... */}

      <div className="tabs">
        <button className={`tab-btn ${activeTab === 'prescricao' ? 'active' : ''}`} onClick={() => setActiveTab('prescricao')}>1. Lousa</button>
        <button className={`tab-btn ${activeTab === 'analise' ? 'active' : ''}`} onClick={() => setActiveTab('analise')}>2. Análise</button>
        <button className={`tab-btn ${activeTab === 'historico' ? 'active' : ''}`} onClick={() => setActiveTab('historico')}>3. Dashboard</button>
      </div>

      {activeTab === 'prescricao' && (
        <div className="panel">
          {/* ... [Código original da Lousa] ... */}
        </div>
      )}

      {activeTab === 'analise' && (
        <div className="panel">
          {/* ... [Código original da Análise e Botão Processar] ... */}
        </div>
      )}

      {/* === NOVA ABA: DASHBOARD === */}
      {activeTab === 'historico' && (
        <div className="panel">
          <h2>Seu Histórico de Desempenho</h2>

          {savedWods.length > 0 && (
            <div style={{ width: '100%', height: 300, marginBottom: '40px', backgroundColor: '#2c2c2c', padding: '20px', borderRadius: '8px' }}>
              <ResponsiveContainer>
                <LineChart data={[...savedWods].reverse()} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                  <XAxis dataKey="created_at" tickFormatter={(tick) => new Date(tick).toLocaleDateString('pt-BR')} stroke="#aaa" />
                  <YAxis yAxisId="left" stroke="#4caf50" />
                  <YAxis yAxisId="right" orientation="right" stroke="#ff9800" />
                  <Tooltip labelFormatter={(label) => new Date(label).toLocaleDateString('pt-BR')} contentStyle={{ backgroundColor: '#1e1e1e', border: 'none' }} />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="score_watts" name="Potência (Watts)" stroke="#4caf50" strokeWidth={3} activeDot={{ r: 8 }} />
                  <Line yAxisId="right" type="monotone" dataKey="score_kcal" name="Gasto (kCal)" stroke="#ff9800" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
            {savedWods.map(w => (
              <div key={w.id} style={{ background: '#2c2c2c', padding: '20px', borderRadius: '8px', borderLeft: '4px solid #1976d2' }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '1.2rem' }}>{w.title}</h3>
                <div style={{ fontSize: '0.9rem', color: '#ccc', marginBottom: '15px' }}>
                  <strong>Data:</strong> {new Date(w.created_at || '').toLocaleDateString('pt-BR')}<br />
                  <strong>Resultado:</strong> {(w as any).score_watts?.toFixed(1) || '--'} W | {(w as any).score_kcal?.toFixed(0) || '--'} kCal
                </div>
                <button onClick={() => carregarDoSupabase(w)} style={{ width: '100%', padding: '10px', backgroundColor: '#388e3c' }}>Carregar Treino</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}