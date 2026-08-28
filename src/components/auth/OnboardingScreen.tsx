import type { Dispatch, SetStateAction } from 'react';

// Tipagem baseada no state "onboardForm" do App.tsx original
export interface OnboardFormState {
  full_name: string;
  apelido: string;
  is_coach: boolean;
  estatura: number;
  peso: number;
  sexo: 'M' | 'F' | string;
  nivel_tecnico: string;
  envergadura: number;
  perna: number;
  bf: number;
  data_nascimento: string;
}

interface OnboardingScreenProps {
  form: OnboardFormState;
  setForm: Dispatch<SetStateAction<OnboardFormState>>;
  onSave: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

export function OnboardingScreen({ form, setForm, onSave, onSignOut }: OnboardingScreenProps) {
  
  // Função auxiliar para atualizar campos
  const updateForm = (field: keyof OnboardFormState, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="container" style={{ maxWidth: '600px' }}>
      <div className="panel">
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2 style={{ margin: 0 }}>Bem-vindo ao DynaWOD!</h2>
          <button 
            onClick={onSignOut} 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', width: 'auto', backgroundColor: '#333', padding: '5px 10px', fontSize: '0.85rem' }}
          >
            Sair
          </button>
        </div>
        
        <p style={{ color: '#aaa' }}>Complete seu perfil biomecânico para calibrarmos o motor para o seu corpo.</p>
        
        <div className="form-group" style={{ marginTop: '20px' }}>
          <label>Seu Nome Completo</label>
          <input 
            type="text" 
            value={form.full_name} 
            onChange={e => updateForm('full_name', e.target.value)} 
          />
        </div>
        
        <div className="form-group">
          <label>Como quer ser chamado?</label>
          <input 
            type="text" 
            value={form.apelido} 
            onChange={e => updateForm('apelido', e.target.value)} 
            placeholder="Ex: Gui" 
          />
        </div>

        <div style={{ background: '#222', padding: '15px', borderRadius: '8px', margin: '20px 0' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.1rem', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={form.is_coach} 
              onChange={e => updateForm('is_coach', e.target.checked)} 
              style={{ width: '20px', height: '20px' }} 
            />
            <strong>Eu sou um Coach</strong> (Quero prescrever para alunos)
          </label>
        </div>

        <p style={{ color: '#ff9800', fontSize: '0.85rem', marginBottom: '15px', backgroundColor: '#332b00', padding: '10px', borderRadius: '4px', borderLeft: '3px solid #ff9800' }}>
          ⚠️ <strong>Atenção:</strong> Preencha as medidas de comprimento em <strong>metros</strong> (use ponto). Ex: <strong>1.75</strong>, e não 175.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px' }}>
          
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Estatura (m)</label>
            <input type="number" step="0.01" placeholder="Ex: 1.75" value={form.estatura || ''} onChange={e => updateForm('estatura', e.target.value as unknown as number)} />
          </div>
          
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Peso (kg)</label>
            <input type="number" step="0.1" placeholder="Ex: 80.5" value={form.peso || ''} onChange={e => updateForm('peso', e.target.value as unknown as number)} />
          </div>
          
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Sexo Biológico</label>
            <select value={form.sexo} onChange={e => updateForm('sexo', e.target.value as 'M'|'F')}>
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
            </select>
          </div>
          
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Nível</label>
            <select value={form.nivel_tecnico} onChange={e => updateForm('nivel_tecnico', e.target.value)}>
              <option value="iniciante">Iniciante</option>
              <option value="intermediario">Intermediário</option>
              <option value="avancado">Avançado</option>
            </select>
          </div>
          
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Envergadura (m)</label>
            <input type="number" step="0.01" placeholder="Ex: 1.75" value={form.envergadura || ''} onChange={e => updateForm('envergadura', e.target.value as unknown as number)} />
          </div>
          
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Alt. Perna (m)</label>
            <input type="number" step="0.01" placeholder="Ex: 0.85" value={form.perna || ''} onChange={e => updateForm('perna', e.target.value as unknown as number)} />
          </div>
          
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>% BF</label>
            <input type="number" placeholder="Ex: 15" value={form.bf || ''} onChange={e => updateForm('bf', e.target.value as unknown as number)} />
          </div>
          
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Data de Nascimento</label>
            <input type="date" value={form.data_nascimento} onChange={e => updateForm('data_nascimento', e.target.value)} />
          </div>

        </div>

        <button 
          onClick={onSave} 
          style={{ marginTop: '20px', width: '100%', fontSize: '1.2rem', padding: '15px' }}
        >
          Salvar Perfil e Entrar
        </button>

      </div>
    </div>
  );
}