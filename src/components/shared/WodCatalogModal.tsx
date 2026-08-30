import { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { wodService } from '../../services/wodService';

interface WodCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWod: (wod: any) => void;
}

export function WodCatalogModal({ isOpen, onClose, onSelectWod }: WodCatalogModalProps) {
  const [wods, setWods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [shortCodeInput, setShortCodeInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      wodService.getLatestTemplates()
        .then(data => setWods(data || []))
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  const handleImportByCode = async () => {
    if (!shortCodeInput) return;
    try {
      const data = await wodService.getWodByShortCode(shortCodeInput.toUpperCase());
      if (data) {
        onSelectWod(data);
        onClose();
      }
    } catch (error) {
      alert('WOD não encontrado. Verifique o código.');
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ backgroundColor: 'var(--bg-card, #181a1e)', width: '100%', maxWidth: '800px', maxHeight: '90vh', borderRadius: '12px', display: 'flex', flexDirection: 'column', border: '1px solid var(--line-silver, #26272b)' }}>
        
        {/* Header do Modal */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', borderBottom: '1px solid var(--line-silver, #26272b)' }}>
          <h2 style={{ margin: 0 }}>Catálogo de Treinos</h2>
          <button onClick={onClose} style={{ width: 'auto', background: 'transparent', padding: '5px' }}><X size={24} color="#fff" /></button>
        </div>

        {/* Corpo do Modal */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {/* Busca por Código Específico */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', backgroundColor: '#111', padding: '15px', borderRadius: '8px' }}>
            <input 
              type="text" 
              placeholder="Tem um código de 6 dígitos? Ex: A1B2C3" 
              value={shortCodeInput}
              onChange={e => setShortCodeInput(e.target.value.toUpperCase())}
              maxLength={6}
              style={{ flex: 1, letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 'bold' }}
            />
            <button onClick={handleImportByCode} style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Search size={18} /> Buscar
            </button>
          </div>

          <h3 style={{ marginTop: 0, color: 'var(--text-muted, #8a8d94)', fontSize: '1rem', marginBottom: '15px' }}>Adicionados Recentemente</h3>
          
          {loading ? (
            <p style={{ textAlign: 'center', color: '#888' }}>Carregando biblioteca...</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '15px' }}>
              {wods.map(wod => (
                <div key={wod.id} style={{ background: '#252525', padding: '15px', borderRadius: '8px', borderLeft: '4px solid var(--dyna-red, #FF2B3D)', cursor: 'pointer', transition: 'transform 0.2s' }} onClick={() => { onSelectWod(wod); onClose(); }}>
                  <strong style={{ display: 'block', marginBottom: '8px', fontSize: '1.1rem' }}>{wod.title}</strong>
                  <div style={{ fontSize: '0.85rem', color: '#aaa', lineHeight: '1.5' }}>
                    <div><strong>Tipo:</strong> {wod.tipo_treino}</div>
                    <div><strong>Alvo:</strong> {wod.tempo_alvo}</div>
                    <div style={{ marginTop: '8px', color: '#4caf50' }}>{wod.movimentos?.length || 0} exercícios</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}