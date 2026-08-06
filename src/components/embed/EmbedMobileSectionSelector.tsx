/**
 * Selector de secciones para móvil (< 640px) en los embeds de Panorámica.
 * Desplegable Radix (DropdownMenu, ya instalado) con estilo Heritage Tech:
 * sin estilos nativos del navegador. No conoce ninguna competición concreta
 * y reutiliza el mismo estado/handler que las pestañas de escritorio.
 */
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

type Section<K extends string> = { key: K; label: string };

export type EmbedMobileSectionSelectorProps<K extends string> = {
  /** Sección activa (mismo estado que las pestañas de escritorio). */
  value: K;
  /** Lista de secciones de la competición actual. */
  sections: Section<K>[];
  /** Callback de cambio; debe actualizar la sección y llevar el scroll al inicio. */
  onChange: (key: K) => void;
  /** Etiqueta accesible del selector. */
  label?: string;
  /** Texto opcional de contexto bajo el selector. */
  hint?: string;
};

const EmbedMobileSectionSelector = <K extends string>({
  value,
  sections,
  onChange,
  label = 'Seleccionar sección',
  hint,
}: EmbedMobileSectionSelectorProps<K>) => {
  const active = sections.find((s) => s.key === value);

  return (
    <div className="pano-embed__mobile-nav">
      {/* modal={false}: no bloquea el scroll interno del embed. */}
      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger asChild>
          <button type="button" className="pano-embed__mobile-trigger" aria-label={label}>
            <span className="pano-embed__mobile-value">{active?.label ?? label}</span>
            <span className="pano-embed__mobile-arrow" aria-hidden="true">
              <svg viewBox="0 0 12 8" width="12" height="8" fill="none">
                <path
                  d="M1 1.5 6 6.5l5-5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </button>
        </DropdownMenu.Trigger>

        {/* Portal al body: evita el recorte por la navegación sticky. */}
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="pano-embed__mobile-panel"
            sideOffset={6}
            align="start"
            collisionPadding={12}
            aria-label={label}
          >
            {sections.map((sec) => (
              <DropdownMenu.Item
                key={sec.key}
                className="pano-embed__mobile-option"
                data-active={sec.key === value ? 'true' : undefined}
                onSelect={() => onChange(sec.key)}
              >
                <span>{sec.label}</span>
                {sec.key === value && (
                  <span className="pano-embed__mobile-check" aria-hidden="true">
                    ✓
                  </span>
                )}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      {hint && <p className="pano-embed__mobile-hint">{hint}</p>}
    </div>
  );
};

export default EmbedMobileSectionSelector;
