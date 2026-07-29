import { Fragment, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Check } from '@phosphor-icons/react/Check';

export type ComboboxOption = {
  value: string;
  label: string;
  description?: string;
  group?: string;
};

export function SearchableCombobox({
  label,
  options,
  selectedValues,
  onChange,
  queryValue,
  onQueryChange,
  onSelectOption,
  onOpenChange,
  multiple = false,
  placeholder = 'Type to search',
  emptyMessage = 'No results',
  disabled = false,
  autoFocus = false,
  hideLabel = false,
  leading,
  className = '',
}: {
  label: string;
  options: ComboboxOption[];
  selectedValues: string[];
  onChange?: (values: string[]) => void;
  queryValue?: string;
  onQueryChange?: (value: string) => void;
  onSelectOption?: (option: ComboboxOption) => void;
  onOpenChange?: (open: boolean) => void;
  multiple?: boolean;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  hideLabel?: boolean;
  leading?: ReactNode;
  className?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [internalQuery, setInternalQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const query = queryValue ?? internalQuery;
  const setQuery = (value: string) => {
    if (queryValue === undefined) setInternalQuery(value);
    onQueryChange?.(value);
  };
  const setOpenState = (value: boolean) => {
    setOpen(value);
    onOpenChange?.(value);
  };
  const selected = useMemo(() => new Set(selectedValues), [selectedValues]);
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return term
      ? options.filter((option) => `${option.label} ${option.description ?? ''}`.toLocaleLowerCase().includes(term))
      : options;
  }, [options, query]);
  const selectedOption = options.find((option) => selected.has(option.value));
  const displayValue = queryValue !== undefined ? query : multiple || open ? query : selectedOption?.label ?? '';
  const listOpen = open && Boolean(filtered.length || query.trim());
  const active = listOpen && activeIndex >= 0 && filtered.length ? Math.min(activeIndex, filtered.length - 1) : -1;

  function close() {
    setOpenState(false);
    if (queryValue === undefined) setInternalQuery('');
    setActiveIndex(-1);
  }

  function select(option: ComboboxOption) {
    if (multiple) {
      onChange?.(selected.has(option.value)
        ? selectedValues.filter((value) => value !== option.value)
        : [...selectedValues, option.value]);
      setQuery('');
      setActiveIndex(-1);
      input.current?.focus();
      return;
    }
    onChange?.([option.value]);
    onSelectOption?.(option);
    close();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpenState(true);
      setActiveIndex((current) => {
        if (!filtered.length) return 0;
        if (current < 0) return event.key === 'ArrowDown' ? 0 : filtered.length - 1;
        const next = event.key === 'ArrowDown' ? current + 1 : current - 1;
        return (next + filtered.length) % filtered.length;
      });
      return;
    }
    if (event.key === 'Enter' && open && active >= 0) {
      event.preventDefault();
      select(filtered[active]);
    }
  }

  return (
    <div className={`combobox${className ? ` ${className}` : ''}`} onBlur={(event) => {
      const combobox = event.currentTarget;
      window.requestAnimationFrame(() => {
        if (!combobox.contains(document.activeElement)) close();
      });
    }}>
      <label className={hideLabel ? 'sr-only' : ''} htmlFor={`${id}-input`}>
        <span>{label}</span>
        {multiple && selected.size > 0 ? <small>{selected.size} selected</small> : null}
      </label>
      {leading ? <span className="combobox__leading" aria-hidden="true">{leading}</span> : null}
      <input
        ref={input}
        id={`${id}-input`}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={listOpen}
        aria-controls={`${id}-listbox`}
        aria-activedescendant={active >= 0 ? `${id}-option-${active}` : undefined}
        aria-label={label}
        autoComplete="off"
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder={multiple && selected.size ? 'Type to add or remove' : placeholder}
        value={displayValue}
        onFocus={() => {
          setOpenState(true);
          if (!multiple && queryValue === undefined) setInternalQuery('');
        }}
        onClick={() => setOpenState(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(-1);
          setOpenState(true);
        }}
        onKeyDown={onKeyDown}
      />
      {listOpen ? (
        <div className="combobox__list" id={`${id}-listbox`} role="listbox" aria-label={`${label} options`} aria-multiselectable={multiple || undefined}>
          {filtered.length ? filtered.map((option, index) => (
            <Fragment key={option.value}>
              {option.group && option.group !== filtered[index - 1]?.group ? <p className="combobox__group" role="presentation">{option.group}</p> : null}
              <button
                id={`${id}-option-${index}`}
                className={index === active ? 'is-active' : ''}
                type="button"
                role="option"
                aria-selected={selected.has(option.value)}
                tabIndex={-1}
                onPointerDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => select(option)}
              >
                <span><strong>{option.label}</strong>{option.description ? <small>{option.description}</small> : null}</span>
                {selected.has(option.value) ? <Check size={15} weight="bold" /> : null}
              </button>
            </Fragment>
          )) : <p role="status">{emptyMessage}</p>}
        </div>
      ) : null}
    </div>
  );
}
