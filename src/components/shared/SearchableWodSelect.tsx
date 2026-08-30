import { useState, useEffect, useRef } from 'react';
import { wodService } from '../../services/wodService';

interface SearchableWodSelectProps {
  value: string;
  onChange: (val: string) => void;
  onSelectWod: (wod: any) => void;
}

export function SearchableWodSelect({ value, onChange, onSelectWod }: SearchableWodSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (value.trim().length < 2) {
        setSuggestions([]);
        return;
      }
      try {
        const data = await wodService.searchTemplatesByName(value);
        setSuggestions(data || []);
      } catch (e) {
        console.error("Erro ao buscar WODs:", e);
      }
    };

    const timeoutId = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timeoutId);
  }, [value]);

  return (
    <div className="searchable-select" ref={wrapperRef}>
      <input
        type="text"
        className="search-input"
        placeholder="Ex: Murph, Fran, Open 24.1..."
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onClick={() => {
          if (value.trim().length >= 2) setIsOpen(true);
        }}
      />
      {isOpen && suggestions.length > 0 && (
        <div className="dropdown-list">
          <div className="dropdown-group">WODs Encontrados</div>
          {suggestions.map(wod => (
            <div
              key={wod.id}
              className="dropdown-item"
              onClick={() => {
                onChange(wod.title);
                onSelectWod(wod);
                setIsOpen(false);
              }}
            >
              <strong style={{ display: 'block', marginBottom: '4px' }}>{wod.title}</strong>
              <span style={{ fontSize: '0.8rem', color: '#8a8d94' }}>
                {wod.tipo_treino} • {wod.tempo_alvo} • {wod.movimentos?.length || 0} movimentos
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}