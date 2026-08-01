/**
 * Reglamentos resumidos de las competiciones de Panorámica 2026.
 * Contenido extraído de los documentos oficiales en public/reglamentos.
 * No hay consultas ni almacenamiento en el backend.
 */

export type CompetitionRulesSummaryItem = {
  label: string;
  value: string;
};

export type CompetitionRulesSection = {
  id: string;
  title: string;
  /** Párrafos introductorios de la sección. */
  content?: string[];
  /** Puntos en lista (viñetas o numeración si `ordered`). */
  items?: string[];
  ordered?: boolean;
  /** Abierta por defecto en el acordeón. */
  defaultOpen?: boolean;
};

export type CompetitionRules = {
  title: string;
  subtitle?: string;
  summary: CompetitionRulesSummaryItem[];
  sections: CompetitionRulesSection[];
};

const STABLEFORD_NOTE =
  'Puntuación Stableford: en cada hoyo se puntúa con relación al par. Bogey 1 punto, par 2 puntos, birdie 3 puntos, eagle 4 puntos. Cuando no se ha podido terminar en los golpes que valen para la puntuación, se recoge la bola.';

const RULES_BASE =
  'Las reglas de la Competición son las publicadas por la Royal & Ancient Club of St. Andrews, aceptadas por la Real Federación Española de Golf, y las reglas locales de Panorámica Golf Club.';

const PACE_OF_PLAY =
  'Para cada torneo se estipulará un tiempo máximo de juego. La primera partida no podrá retrasarse más de 20 minutos de ese tiempo establecido; las siguientes no podrán perder más de 15 minutos con la partida anterior. El incumplimiento supondrá una sanción de dos puntos en la tarjeta, válida para la clasificación de la liga y para el resultado del torneo, no así para la federación, a la que se informará del resultado real sin sanción.';

const FOREIGN_LICENSE =
  'Las licencias extranjeras requieren obtener obligatoriamente la Licencia Temporal de la FVG y presentar justificante de hándicap de su federación.';

const REGISTRATION =
  'Inscripción en recepción del club, llamando al 964 493 072 o enviando un correo con nombre y número de licencia a golf@panoramicagrupo.com. El plazo se cierra el día antes de la competición a las 12:00 h.';

const NO_SHOW =
  'La cancelación de la inscripción a menos de 24 horas del inicio se considerará No Presentado y la tarjeta se presentará a la Federación como No Presentado.';

const COMMITTEE = [
  'D. Manuel Ramón — Consejero Delegado Panorámica Golf.',
  'D. Vicente Obeso — Profesional Panorámica Golf Club.',
  'D. Alex Orpianesi.',
];

const FINAL_DISPOSITIONS = [
  'Este reglamento ha sido desarrollado y aprobado por el Comité de Competición del Club, con el visto bueno de la propiedad.',
  'Las dudas sobre interpretación o procedimiento se remitirán por escrito al Comité de Competición al correo golf@panoramicagrupo.com.',
  'Cualquier incidencia no recogida será resuelta por el Comité de Competición de Panorámica Golf Club y la junta directiva si procede.',
];

export const individual2026Rules: CompetitionRules = {
  title: 'Orden del Mérito Individual 2026',
  subtitle: 'Resumen práctico de las bases oficiales de la competición.',
  summary: [
    { label: 'Modalidad', value: 'Individual Stableford' },
    { label: 'Calendario', value: '8 pruebas' },
    { label: 'Resultados válidos', value: '7 mejores' },
    { label: 'Categorías', value: '1ª, 2ª y Scratch' },
    { label: 'Hándicap máximo', value: '28' },
  ],
  sections: [
    {
      id: 'participantes',
      title: 'Participantes',
      items: [
        'Jugadores con licencia federativa en vigor del año 2026 de la Real Federación Española de Golf.',
        'Hándicap limitado a 28.',
        FOREIGN_LICENSE,
      ],
    },
    {
      id: 'calendario',
      title: 'Calendario',
      defaultOpen: true,
      content: [
        'La Liga Social Individual 2026 está compuesta por ocho torneos en Panorámica Golf Club. Las fechas podrían variar por causas de fuerza mayor; el Comité de Competición comunicará cualquier cambio por cartelería del club y web.',
      ],
      items: [
        '31/01/2026 — Torneo Presentación.',
        '14/03/2026 — Orden de Mérito Individual.',
        '04/04/2026 — Torneo Keyhole.',
        '09/05/2026 — Torneo Bloke Tudela.',
        '13/06/2026 — Orden de Mérito Individual.',
        '12/09/2026 — Orden de Mérito Individual.',
        '25/10/2026 — Torneo Xperience PGA.',
        '05/12/2026 — Prueba Final.',
      ],
    },
    {
      id: 'categorias',
      title: 'Categorías',
      defaultOpen: true,
      items: [
        '1ª Categoría indistinta: hándicaps hasta 15,4.',
        '2ª Categoría indistinta: hándicaps desde 15,5 hasta 36.',
        'Scratch: categoría indistinta.',
        'La categoría queda fijada por el hándicap de la primera prueba disputada.',
        'Un cambio posterior de hándicap no cambia la categoría de la competición.',
      ],
    },
    {
      id: 'modalidad',
      title: 'Modalidad',
      content: [STABLEFORD_NOTE, RULES_BASE, PACE_OF_PLAY],
      items: [
        'Individual Stableford.',
        'Si alguna prueba anuncia otra modalidad con antelación, el resultado se convertirá a Stableford para la clasificación.',
      ],
    },
    {
      id: 'clasificacion',
      title: 'Clasificación',
      defaultOpen: true,
      items: [
        'La clasificación final se obtiene sumando las 7 mejores puntuaciones de las 8 pruebas.',
        'El resultado descartado continúa visible, pero no suma al total.',
        'No existe descarte hasta que un jugador tenga 8 resultados válidos.',
      ],
    },
    {
      id: 'desempates',
      title: 'Desempates',
      defaultOpen: true,
      ordered: true,
      items: [
        'Mayor número de torneos disputados.',
        'Mejor suma de puntos Stableford en los tres últimos torneos del calendario.',
        'Hándicap más bajo.',
      ],
    },
    {
      id: 'barras',
      title: 'Barras de salida',
      items: [
        'Masculino: barras amarillas, excepto en la prueba Xperience PGA, que se jugará de blancas.',
        'Femenino: barras rojas, excepto en la prueba Xperience PGA, que se jugará de azules.',
      ],
    },
    {
      id: 'premios-prueba',
      title: 'Premios de cada prueba',
      items: [
        '1º clasificado de cada categoría: Primera, Segunda y Scratch.',
        'El club se reserva la posibilidad de ampliar los premios según las circunstancias.',
      ],
    },
    {
      id: 'premios-final',
      title: 'Entrega de premios final',
      defaultOpen: true,
      content: [
        'El reparto de premios, trofeos y sorteo de regalos se realizará en la comida del Torneo de Navidad 2026 el 19/12/2026.',
      ],
      items: [
        'Primer clasificado de 1ª Categoría: trofeo conmemorativo y set de hierros a medida realizados por Agile Golf.',
        'Primer clasificado de 2ª Categoría: trofeo conmemorativo y set de wedges a medida realizados por Agile Golf.',
        'Primer clasificado de Scratch: trofeo conmemorativo y set de maderas a medida realizados por Agile Golf.',
      ],
    },
    {
      id: 'inscripcion',
      title: 'Inscripción',
      items: [
        'Socios Panorámica: 27 €.',
        'Junior (hasta 18 años): 27 €.',
        'Externos y otros: 65 €.',
        REGISTRATION,
        NO_SHOW,
      ],
    },
    {
      id: 'comite',
      title: 'Comité de Competición',
      items: COMMITTEE,
    },
    {
      id: 'normas',
      title: 'Disposiciones finales',
      items: [...FINAL_DISPOSITIONS],
    },
  ],
};

export const verano2026Rules: CompetitionRules = {
  title: 'Liga de Verano 2026',
  subtitle: 'Resumen práctico de las bases oficiales de la competición.',
  summary: [
    { label: 'Modalidad', value: 'Individual Stableford' },
    { label: 'Calendario', value: '5 pruebas' },
    { label: 'Resultados válidos', value: '4 mejores' },
    { label: 'Categorías', value: '1ª y 2ª' },
    { label: 'Hándicap máximo', value: '28' },
  ],
  sections: [
    {
      id: 'participantes',
      title: 'Participantes',
      items: [
        'Jugadores con licencia federativa en vigor del año 2026 de la Real Federación Española de Golf.',
        'Hándicap limitado a 28.',
        FOREIGN_LICENSE,
      ],
    },
    {
      id: 'calendario',
      title: 'Calendario',
      defaultOpen: true,
      content: [
        'La Liga de Verano 2026 está compuesta por cinco torneos organizados en Panorámica Golf Club. Las fechas podrían variar por causas de fuerza mayor; el Comité de Competición comunicará cualquier cambio por cartelería del club y web.',
      ],
      items: [
        '10/08/2026 — Primera prueba.',
        '12/08/2026 — Segunda prueba.',
        '17/08/2026 — Tercera prueba.',
        '19/08/2026 — Cuarta prueba.',
        '21/08/2026 — Quinta prueba.',
      ],
    },
    {
      id: 'categorias',
      title: 'Categorías',
      defaultOpen: true,
      items: [
        '1ª Categoría indistinta: hándicaps hasta 16,4.',
        '2ª Categoría indistinta: hándicaps desde 16,5 hasta 36.',
        'La categoría queda fijada por el hándicap de la primera prueba disputada.',
        'Los cambios posteriores de hándicap no cambian la categoría.',
      ],
    },
    {
      id: 'modalidad',
      title: 'Modalidad',
      content: [STABLEFORD_NOTE, RULES_BASE, PACE_OF_PLAY],
      items: ['Individual Stableford.'],
    },
    {
      id: 'clasificacion',
      title: 'Clasificación',
      defaultOpen: true,
      items: [
        'Se suman las 4 mejores puntuaciones de las 5 pruebas.',
        'Cuando un jugador completa las 5 pruebas, el peor resultado queda descartado.',
        'El resultado descartado continúa visible, pero no suma.',
      ],
    },
    {
      id: 'desempates',
      title: 'Desempates',
      defaultOpen: true,
      ordered: true,
      items: ['Mayor número de torneos disputados.', 'Hándicap más bajo.'],
    },
    {
      id: 'barras',
      title: 'Barras de salida',
      items: [
        'Masculino: barras amarillas.',
        'Femenino: barras rojas.',
      ],
    },
    {
      id: 'premios-prueba',
      title: 'Premios de cada prueba',
      items: ['1º clasificado de cada categoría (Primera y Segunda).'],
    },
    {
      id: 'premios-final',
      title: 'Entrega de premios final',
      defaultOpen: true,
      content: [
        'El reparto de trofeos se realizará en una ceremonia el día 21/08/2026.',
      ],
      items: [
        'Primer y segundo clasificado final de cada categoría recibirán un trofeo conmemorativo.',
      ],
    },
    {
      id: 'inscripcion',
      title: 'Inscripción',
      items: [
        'Socios Panorámica: 25 € por prueba.',
        'Bono Liga socios: 100 € a pagar en la primera prueba.',
        'No socios: 50 € por prueba.',
        'Bono Liga no socios: 200 € a pagar en la primera prueba.',
        REGISTRATION,
        NO_SHOW,
      ],
    },
    {
      id: 'comite',
      title: 'Comité de Competición',
      items: COMMITTEE.slice(0, 2),
    },
    {
      id: 'normas',
      title: 'Disposiciones finales',
      items: [...FINAL_DISPOSITIONS],
    },
  ],
};
