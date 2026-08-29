import { Save } from 'lucide-react';
import type { AtletaPerfil } from '../../types';

interface AtletaTabProps {
  selectedAthleteId: string;
  atleta: AtletaPerfil;
  setAtleta: (val: AtletaPerfil) => void;
  salvarPerfilAtleta: () => void;
}

export function AtletaTab({ selectedAthleteId, atleta, setAtleta, salvarPerfilAtleta }: AtletaTabProps) {
  return (
    <div className="panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h2 style={{ margin: 0 }}>Perfil do Atleta</h2>
        {selectedAthleteId !== 'me' && <span style={{ background: '#ff9800', color: '#000', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>Visualizando Aluno</span>}
      </div>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted, #8a8d94)', marginBottom: '10px' }}>
        Os dados base são carregados do perfil selecionado. Você pode ajustá-los apenas para simular um cálculo pontual, ou clicar no botão no final da página para salvar as alterações definitivamente no banco de dados.
      </p>

      <p style={{ color: '#ff9800', fontSize: '0.85rem', marginBottom: '20px', backgroundColor: '#332b00', padding: '10px', borderRadius: '4px', borderLeft: '3px solid #ff9800' }}>
        ⚠️ <strong>Medidas em METROS:</strong> Certifique-se de usar notação decimal para comprimentos (Ex: <strong>1.75</strong>, <strong>0.85</strong>).
      </p>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '25px' }}>
        <div className="form-group" style={{ marginBottom: 0 }}><label>Estatura (m)</label><input type="number" step="0.01" placeholder="Ex: 1.75" value={atleta.estatura || ''} onChange={e => setAtleta({ ...atleta, estatura: e.target.value as unknown as number })} /></div>
        <div className="form-group" style={{ marginBottom: 0 }}><label>Massa (kg)</label><input type="number" step="0.1" placeholder="Ex: 80.5" value={atleta.peso || ''} onChange={e => setAtleta({ ...atleta, peso: e.target.value as unknown as number })} /></div>
        <div className="form-group" style={{ marginBottom: 0 }}><label>Sexo Biológico</label><select value={atleta.sexo} onChange={e => setAtleta({ ...atleta, sexo: e.target.value as 'M' | 'F' })}><option value="M">Masculino</option><option value="F">Feminino</option></select></div>
        <div className="form-group" style={{ marginBottom: 0 }}><label>Nível Técnico</label><select value={atleta.nivelTecnico} onChange={e => setAtleta({ ...atleta, nivelTecnico: e.target.value as any })}><option value="iniciante">Iniciante</option><option value="intermediario">Intermediário</option><option value="avancado">Avançado</option></select></div>
        <div className="form-group" style={{ marginBottom: 0 }}><label>Envergadura (m)</label><input type="number" step="0.01" placeholder="Ex: 1.75" value={atleta.envergadura || ''} onChange={e => setAtleta({ ...atleta, envergadura: e.target.value as unknown as number })} /></div>
        <div className="form-group" style={{ marginBottom: 0 }}><label>Alt. Perna (m)</label><input type="number" step="0.01" placeholder="Ex: 0.85" value={atleta.perna || ''} onChange={e => setAtleta({ ...atleta, perna: e.target.value as unknown as number })} /></div>
        <div className="form-group" style={{ marginBottom: 0 }}><label>% Gordura Corporal (BF)</label><input type="number" step="0.1" placeholder="Ex: 15" value={atleta.bf || ''} onChange={e => setAtleta({ ...atleta, bf: e.target.value as unknown as number })} /></div>
      </div>

      <div style={{ backgroundColor: '#111', padding: '15px', borderRadius: '8px', border: '1px solid var(--line-silver, #26272b)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: atleta.usaAntropometriaAvancada ? '15px' : '0' }}>
          <input 
            type="checkbox" 
            id="check-avancada"
            checked={atleta.usaAntropometriaAvancada || false}
            onChange={(e) => setAtleta({ ...atleta, usaAntropometriaAvancada: e.target.checked })}
            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
          />
          <label htmlFor="check-avancada" style={{ margin: 0, fontSize: '1rem', color: '#fff', cursor: 'pointer' }}>
            Habilitar Antropometria Avançada (Laboratorial)
          </label>
        </div>

        {atleta.usaAntropometriaAvancada && (
          <>
            <p style={{ fontSize: '0.85rem', color: '#ff9800', marginBottom: '15px' }}>
              <strong>Atenção:</strong> Ao preencher estes dados, o motor ignorará a alometria padrão de De Leva e recalculará o seu centro de gravidade e massas segmentares de forma dinâmica.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', alignItems: 'end' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Data de Nasc.</label>
                <input type="date" value={atleta.dataNascimento || ''} onChange={e => setAtleta({ ...atleta, dataNascimento: e.target.value })} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Circ. Tórax (m)</label>
                <input type="number" step="0.01" placeholder="Ex: 1.10" value={atleta.circTorax || ''} onChange={e => setAtleta({ ...atleta, circTorax: e.target.value as unknown as number })} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Circ. Coxa (m)</label>
                <input type="number" step="0.01" placeholder="Ex: 0.65" value={atleta.circCoxa || ''} onChange={e => setAtleta({ ...atleta, circCoxa: e.target.value as unknown as number })} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Mobilidade (ROM) - {atleta.mobilidade || 100}%</label>
                <input 
                  type="range" 
                  min="50" max="100" 
                  value={atleta.mobilidade || 100} 
                  onChange={e => setAtleta({ ...atleta, mobilidade: Number(e.target.value) })} 
                  style={{ width: '100%' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#8a8d94', marginTop: '5px' }}>
                  <span>Encurtado (50%)</span>
                  <span>Perfeita (100%)</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      
      <hr style={{ borderColor: 'var(--line-silver, #26272b)', margin: '25px 0' }} />
      
      <button 
        onClick={salvarPerfilAtleta} 
        style={{ 
          fontSize: '1.1rem', 
          padding: '15px', 
          backgroundColor: '#388e3c', 
          color: '#fff', 
          border: 'none', 
          borderRadius: '8px', 
          fontWeight: 'bold', 
          width: '100%', 
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px'
        }}
      >
        <Save size={22} />
        Atualizar Perfil
      </button>
    </div>
  );
}