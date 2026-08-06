/**
 * Selector de secciones para móvil (< 640px) en los embeds de Panorámica.
 * Reutiliza el mismo estado/handler que las pestañas de escritorio:
 * no duplica la lógica de renderizado de secciones ni navega a otra URL.
 */
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
}: EmbedMobileSectionSelectorProps<K>) => (
  <div className="pano-embed__mobile-nav">
    <label className="pano-embed__mobile-field">
      <span className="pano-embed__sr">{label}</span>
      <select
        className="pano-embed__mobile-select"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value as K)}
      >
        {sections.map((sec) => (
          <option key={sec.key} value={sec.key}>
            {sec.label}
          </option>
        ))}
      </select>
      <span className="pano-embed__mobile-arrow" aria-hidden="true">
        ▾
      </span>
    </label>
    {hint && <p className="pano-embed__mobile-hint">{hint}</p>}
  </div>
);

export default EmbedMobileSectionSelector;
