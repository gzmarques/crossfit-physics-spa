import { useState, useEffect, useRef } from 'react';

interface SearchableMovementSelectProps {
  value: string;
  onChange: (val: string) => void;
  movimentosDB: any;
}

export function SearchableMovementSelect({ value, onChange, movimentosDB }: SearchableMovementSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
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

  const groups: Record<string, any[]> = {};
  Object.entries(movimentosDB).forEach(([key, config]: [string, any]) => {
    if (!groups[config.grupo]) groups[config.grupo] = [];
    groups[config.grupo].push({ key, nome: config.nome });
  });

  const filteredGroups: Record<string, any[]> = {};
  Object.entries(groups).forEach(([groupName, items]) => {
    const filteredItems = items.filter(item => 
      item.nome.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (filteredItems.length > 0) {
      filteredGroups[groupName] = filteredItems;
    }
  });

  const selectedName = movimentosDB[value]?.nome || "Selecione...";

  return (
    <div className="searchable-select" ref={wrapperRef}>
      <input
        type="text"
        className="search-input"
        placeholder="Buscar exercício..."
        value={isOpen ? searchTerm : selectedName}
        onChange={(e) => setSearchTerm(e.target.value)}
        onClick={() => { setIsOpen(true); setSearchTerm(""); }}
      />
      {isOpen && (
        <div className="dropdown-list">
          {Object.entries(filteredGroups).map(([groupName, items]) => (
            <div key={groupName}>
              <div className="dropdown-group">{groupName}</div>
              {items.map(item => (
                <div
                  key={item.key}
                  className="dropdown-item"
                  onClick={() => {
                    onChange(item.key);
                    setIsOpen(false);
                    setSearchTerm("");
                  }}
                >
                  {item.nome}
                </div>
              ))}
            </div>
          ))}
          {Object.keys(filteredGroups).length === 0 && (
            <div style={{ padding: '10px', color: '#888', fontSize: '0.9rem', textAlign: 'center' }}>
              Nenhum movimento encontrado.
            </div>
          )}
        </div>
      )}
    </div>
  );
}