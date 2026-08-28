import { Trophy, Dumbbell, LogOut } from 'lucide-react';
import type { UserProfile } from '../../types';

interface HeaderProps {
  userProfile: UserProfile | null;
  selectedAthleteId: string;
  myAthletes: UserProfile[];
  onAthleteChange: (id: string) => void;
  onSignOut: () => Promise<void>;
}

export function Header({ 
  userProfile, 
  selectedAthleteId, 
  myAthletes, 
  onAthleteChange, 
  onSignOut 
}: HeaderProps) {
  return (
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', backgroundColor: 'var(--bg-dark, #0a0a0a)', borderBottom: '1px solid var(--line-silver, #26272b)', marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <img src="/favicon.png" alt="Símbolo DynaWOD" style={{ height: '40px', objectFit: 'contain' }} />
        <img src="/dynawod-texto.png" alt="DynaWOD Tipografia" style={{ height: '28px', objectFit: 'contain' }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div style={{ fontSize: '14px', color: 'var(--text-muted, #8a8d94)', fontWeight: 600 }}>
          Olá, <span style={{ color: '#fff' }}>
            {userProfile?.is_coach ? <Trophy size={"1.2em"} color="var(--dyna-red)" /> : <Dumbbell size={"1.2em"} color="var(--line-silver)" />} 
            {userProfile?.apelido || userProfile?.full_name}
          </span>
        </div>
        
        {userProfile?.is_coach && (
          <select 
            value={selectedAthleteId} 
            onChange={e => onAthleteChange(e.target.value)} 
            style={{ background: 'var(--bg-card, #181a1e)', border: '1px solid var(--line-silver, #26272b)', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}
          >
            <option value="me">Meu Desempenho</option>
            <optgroup label="Meus Alunos">
              {myAthletes.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
            </optgroup>
          </select>
        )}
        
        <button 
          onClick={onSignOut} 
          style={{ width: 'auto', backgroundColor: 'var(--dyna-burgundy, #7A0F1B)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 'bold' }}
        >
          <LogOut size={"1.2em"} /> Sair
        </button>
      </div>
    </header>
  );
}