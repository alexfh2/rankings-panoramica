/**
 * Modal editorial con el reglamento resumido de una competición.
 * Contenido 100% estático (src/data/competitionRules.ts): sin consultas.
 */
import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { CompetitionRules, CompetitionRulesSection } from '@/data/competitionRules';

export type CompetitionRulesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rules: CompetitionRules;
  officialPdfUrl?: string;
};

const RulesSection = ({ section }: { section: CompetitionRulesSection }) => {
  const [openSection, setOpenSection] = useState<boolean>(section.defaultOpen ?? false);
  const panelId = `pano-rules-panel-${section.id}`;
  const ListTag = section.ordered ? 'ol' : 'ul';

  return (
    <div className="pano-rules-dialog__section">
      <button
        type="button"
        className="pano-rules-dialog__sectionhead"
        aria-expanded={openSection}
        aria-controls={panelId}
        onClick={() => setOpenSection((v) => !v)}
      >
        <span className="pano-rules-dialog__sectiontitle">{section.title}</span>
        <span className="pano-rules-dialog__chevron" aria-hidden="true">
          {openSection ? '−' : '+'}
        </span>
      </button>

      {openSection && (
        <div id={panelId} className="pano-rules-dialog__panel">
          {section.content?.map((p) => (
            <p key={p} className="pano-rules-dialog__text">
              {p}
            </p>
          ))}
          {section.items && section.items.length > 0 && (
            <ListTag
              className={`pano-rules-dialog__list${
                section.ordered ? ' pano-rules-dialog__list--ordered' : ''
              }`}
            >
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ListTag>
          )}
        </div>
      )}
    </div>
  );
};

const CompetitionRulesDialog = ({
  open,
  onOpenChange,
  rules,
  officialPdfUrl,
}: CompetitionRulesDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="pano-rules-dialog">
      <header className="pano-rules-dialog__header">
        <p className="pano-rules-dialog__eyebrow">Panorámica Golf · Temporada 2026</p>
        <DialogTitle className="pano-rules-dialog__title">{rules.title}</DialogTitle>
        <DialogDescription className="pano-rules-dialog__lead">
          {rules.subtitle ?? 'Resumen práctico de las bases de la competición.'}
        </DialogDescription>
        <p className="pano-rules-dialog__note">
          En caso de discrepancia, prevalece el reglamento oficial aprobado por el Comité de
          Competición.
        </p>
      </header>

      <div className="pano-rules-dialog__body">
        <dl className="pano-rules-dialog__summary">
          {rules.summary.map((s) => (
            <div key={s.label} className="pano-rules-dialog__summaryitem">
              <dt className="pano-rules-dialog__summarylabel">{s.label}</dt>
              <dd className="pano-rules-dialog__summaryvalue">{s.value}</dd>
            </div>
          ))}
        </dl>

        <div className="pano-rules-dialog__sections">
          {rules.sections.map((section) => (
            <RulesSection key={section.id} section={section} />
          ))}
        </div>

        {officialPdfUrl && (
          <a
            className="pano-rules-dialog__pdf"
            href={officialPdfUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Consultar PDF oficial
            <span aria-hidden="true"> ↗</span>
          </a>
        )}
      </div>
    </DialogContent>
  </Dialog>
);

export default CompetitionRulesDialog;
