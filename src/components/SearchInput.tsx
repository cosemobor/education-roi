'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Fuse, { type FuseOptionKey } from 'fuse.js';

export interface SearchOption {
  id: string;
  label: string;
  sublabel?: string;
}

interface SearchInputProps {
  options: SearchOption[];
  value: SearchOption | null;
  onChange: (option: SearchOption | null) => void;
  placeholder?: string;
  fuseKeys?: FuseOptionKey<SearchOption>[];
}

export default function SearchInput({
  options,
  value,
  onChange,
  placeholder = 'Search...',
  fuseKeys,
}: SearchInputProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fuse = useMemo(
    () =>
      new Fuse(options, {
        keys: fuseKeys ?? [
          { name: 'label', weight: 1.0 },
          { name: 'sublabel', weight: 0.3 },
        ],
        threshold: 0.35,
        distance: 100,
        ignoreLocation: true,
      }),
    [options, fuseKeys],
  );

  const results = useMemo(() => {
    if (!query.trim()) return options.slice(0, 8);
    return fuse.search(query, { limit: 8 }).map((r) => r.item);
  }, [query, fuse, options]);

  const handleSelect = useCallback(
    (option: SearchOption) => {
      onChange(option);
      setQuery(option.label);
      setIsOpen(false);
    },
    [onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIdx((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && results[highlightIdx]) {
        e.preventDefault();
        handleSelect(results[highlightIdx]);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    },
    [results, highlightIdx, handleSelect],
  );

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Reset highlight when results change
  useEffect(() => {
    setHighlightIdx(0);
  }, [results]);

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value && !isOpen ? value.label : query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
          if (value) onChange(null);
        }}
        onFocus={() => {
          setIsOpen(true);
          if (value) {
            setQuery(value.label);
          }
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-text-primary outline-none transition-colors placeholder:text-text-secondary/60 focus:border-accent focus:ring-1 focus:ring-accent/30"
      />
      {isOpen && results.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {results.map((option, idx) => (
            <li
              key={option.id}
              onMouseDown={() => handleSelect(option)}
              onMouseEnter={() => setHighlightIdx(idx)}
              className={`cursor-pointer px-3 py-2 text-sm ${
                idx === highlightIdx ? 'bg-accent/10 text-accent' : 'text-text-primary'
              }`}
            >
              <span className="font-medium">{option.label}</span>
              {option.sublabel && (
                <span className="ml-2 text-xs text-text-secondary">
                  {option.sublabel}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
