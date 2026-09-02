import { useState } from 'react';
import { 
  Menu, ClipboardList, Activity, User, 
  History, LogOut, Settings, ChevronLeft 
} from 'lucide-react';
import type { UserProfile } from '../../types';

interface SidebarProps {
  activeTab: 'prescricao' | 'analise' | 'atleta' | 'historico';
  setActiveTab: (tab: 'prescricao' | 'analise' | 'atleta' | 'historico') => void;
  userProfile: UserProfile | null;
  onSignOut: () => Promise<void>;
}

export function Sidebar({ activeTab, setActiveTab, userProfile, onSignOut }: SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleSidebar = () => setIsExpanded(!isExpanded);

  return (
    <aside className={`sidebar ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="sidebar-header">
        <button className="toggle-btn" onClick={toggleSidebar}>
          {isExpanded ? <ChevronLeft size={24} /> : <Menu size={24} />}
        </button>
        {isExpanded && (
          <div className="sidebar-logo">
             <img src="/dynawod-texto.png" alt="DynaWOD" style={{ height: '24px' }} />
          </div>
        )}
      </div>

      <div className="sidebar-nav">
        <div 
          className={`sidebar-item ${activeTab === 'prescricao' ? 'active' : ''}`}
          onClick={() => setActiveTab('prescricao')}
        >
          <ClipboardList size={22} className="sidebar-icon" />
          {isExpanded && <span>1. Lousa</span>}
        </div>

        <div 
          className={`sidebar-item ${activeTab === 'analise' ? 'active' : ''}`}
          onClick={() => setActiveTab('analise')}
        >
          <Activity size={22} className="sidebar-icon" />
          {isExpanded && <span>2. Análise</span>}
        </div>

        <div 
          className={`sidebar-item ${activeTab === 'atleta' ? 'active' : ''}`}
          onClick={() => setActiveTab('atleta')}
        >
          <User size={22} className="sidebar-icon" />
          {isExpanded && <span>3. Atleta</span>}
        </div>

        <div 
          className={`sidebar-item ${activeTab === 'historico' ? 'active' : ''}`}
          onClick={() => setActiveTab('historico')}
        >
          <History size={22} className="sidebar-icon" />
          {isExpanded && <span>4. Histórico</span>}
        </div>
      </div>

      <div className="sidebar-footer">
        {isExpanded && userProfile && (
          <div className="sidebar-user-info">
            <span className="user-name">{userProfile.apelido || userProfile.full_name}</span>
            <span className="user-role">{userProfile.is_coach ? 'Coach' : 'Atleta'}</span>
          </div>
        )}
        
        <div className="sidebar-item" onClick={() => setActiveTab('atleta')} title="Configurações de Perfil">
          <Settings size={22} className="sidebar-icon" />
          {isExpanded && <span>Configurações</span>}
        </div>

        <div className="sidebar-item logout" onClick={onSignOut} title="Sair">
          <LogOut size={22} className="sidebar-icon" />
          {isExpanded && <span>Sair</span>}
        </div>
      </div>
    </aside>
  );
}