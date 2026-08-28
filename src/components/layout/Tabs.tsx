interface TabsProps {
  activeTab: 'prescricao' | 'analise' | 'atleta' | 'historico';
  setActiveTab: (tab: 'prescricao' | 'analise' | 'atleta' | 'historico') => void;
}

export function Tabs({ activeTab, setActiveTab }: TabsProps) {
  return (
    <div className="tabs">
      <button 
        className={`tab-btn ${activeTab === 'prescricao' ? 'active' : ''}`} 
        onClick={() => setActiveTab('prescricao')}
      >
        1. Lousa
      </button>
      <button 
        className={`tab-btn ${activeTab === 'analise' ? 'active' : ''}`} 
        onClick={() => setActiveTab('analise')}
      >
        2. Análise
      </button>
      <button 
        className={`tab-btn ${activeTab === 'atleta' ? 'active' : ''}`} 
        onClick={() => setActiveTab('atleta')}
      >
        3. Atleta
      </button>
      <button 
        className={`tab-btn ${activeTab === 'historico' ? 'active' : ''}`} 
        onClick={() => setActiveTab('historico')}
      >
        4. Histórico
      </button>
    </div>
  );
}