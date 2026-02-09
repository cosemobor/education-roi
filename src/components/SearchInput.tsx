'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Fuse, { type FuseOptionKey } from 'fuse.js';
import { trackSearchQuery, trackEvent } from '@/lib/analytics';

export interface SearchOption {
  id: string;
  label: string;
  sublabel?: string;
  group?: string;
}

interface SearchInputProps {
  options: SearchOption[];
  defaultOptions?: SearchOption[];
  value: SearchOption | null;
  onChange: (option: SearchOption | null) => void;
  placeholder?: string;
  fuseKeys?: FuseOptionKey<SearchOption>[];
}

export default function SearchInput({
  options,
  defaultOptions,
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

  const hasGroups = useMemo(
    () => options.some((o) => o.group),
    [options],
  );

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
    if (!query.trim()) {
      // Use explicit defaults if provided
      if (defaultOptions && defaultOptions.length > 0) return defaultOptions;
      if (!hasGroups) return options.slice(0, 8);
      // Show ungrouped items first, then a few from each group
      const ungrouped = options.filter((o) => !o.group);
      const groups = new Map<string, SearchOption[]>();
      for (const o of options) {
        if (o.group) {
          const arr = groups.get(o.group) ?? [];
          arr.push(o);
          groups.set(o.group, arr);
        }
      }
      const out: SearchOption[] = [...ungrouped];
      for (const [, items] of groups) {
        out.push(...items.slice(0, 4));
      }
      return out.slice(0, 12);
    }
    const raw = fuse.search(query, { limit: 16 }).map((r) => r.item);
    if (!hasGroups) return raw.slice(0, 8);
    // Balance results across groups: up to 4 per group
    const grouped = new Map<string, SearchOption[]>();
    const ungrouped: SearchOption[] = [];
    for (const item of raw) {
      if (!item.group) {
        ungrouped.push(item);
      } else {
        const arr = grouped.get(item.group) ?? [];
        if (arr.length < 4) arr.push(item);
        grouped.set(item.group, arr);
      }
    }
    return [...ungrouped, ...Array.from(grouped.values()).flat()];
  }, [query, fuse, options, hasGroups]);

  // Build flat list with group headers for rendering
  const displayItems = useMemo(() => {
    if (!hasGroups) {
      return results.map((o) => ({ type: 'option' as const, option: o }));
    }
    const items: Array<
      | { type: 'header'; label: string }
      | { type: 'option'; option: SearchOption }
    > = [];
    // Ungrouped first
    const ungrouped = results.filter((o) => !o.group);
    for (const o of ungrouped) {
      items.push({ type: 'option', option: o });
    }
    // Grouped with headers
    const groupOrder: string[] = [];
    for (const o of results) {
      if (o.group && !groupOrder.includes(o.group)) groupOrder.push(o.group);
    }
    for (const g of groupOrder) {
      const groupItems = results.filter((o) => o.group === g);
      if (groupItems.length > 0) {
        items.push({ type: 'header', label: g });
        for (const o of groupItems) {
          items.push({ type: 'option', option: o });
        }
      }
    }
    return items;
  }, [results, hasGroups]);

  // Flat option-only list for keyboard navigation
  const flatOptions = useMemo(
    () =>
      displayItems
        .filter((d): d is { type: 'option'; option: SearchOption } => d.type === 'option')
        .map((d) => d.option),
    [displayItems],
  );

  const handleSelect = useCallback(
    (option: SearchOption) => {
      trackEvent('search_select', { id: option.id, label: option.label, group: option.group ?? '' });
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
        setHighlightIdx((i) => Math.min(i + 1, flatOptions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && flatOptions[highlightIdx]) {
        e.preventDefault();
        handleSelect(flatOptions[highlightIdx]);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    },
    [flatOptions, highlightIdx, handleSelect],
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
  }, [flatOptions]);

  let optionIdx = -1;

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value && !isOpen ? value.label : query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
          if (e.target.value.trim()) trackSearchQuery(e.target.value);
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
      {isOpen && displayItems.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {displayItems.map((item, i) => {
            if (item.type === 'header') {
              return (
                <li
                  key={`header-${item.label}`}
                  className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-secondary bg-gray-50"
                >
                  {item.label}
                </li>
              );
            }
            optionIdx++;
            const currentIdx = optionIdx;
            return (
              <li
                key={`${item.option.group ?? ''}-${item.option.id}`}
                onMouseDown={() => handleSelect(item.option)}
                onMouseEnter={() => setHighlightIdx(currentIdx)}
                className={`cursor-pointer px-3 py-2 text-sm ${
                  currentIdx === highlightIdx ? 'bg-accent/10 text-accent' : 'text-text-primary'
                }`}
              >
                <span className="font-medium">{item.option.label}</span>
                {item.option.sublabel && (
                  <span className="ml-2 text-xs text-text-secondary">
                    {item.option.sublabel}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
