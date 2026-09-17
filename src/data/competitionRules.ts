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

export type CompetitionRulesLocale = 'es' | 'en';

export type CompetitionRulesCollection = {
  es: CompetitionRules;
  en?: CompetitionRules;
};

export type CompetitionRulesSource = CompetitionRules | CompetitionRulesCollection;

export type CompetitionRulesPdfUrl = string | {
  es: string;
  en?: string;
};

export type LocalizedRulesText = string | {
  es: string;
  en?: string;
};

export const resolveCompetitionRules = (
  rules: CompetitionRulesSource,
  locale: CompetitionRulesLocale,
): CompetitionRules => {
  if ('summary' in rules) return rules;
  return rules[locale] ?? rules.es;
};

export const resolveCompetitionRulesPdfUrl = (
  pdfUrl: CompetitionRulesPdfUrl | undefined,
  locale: CompetitionRulesLocale,
): string | undefined => {
  if (!pdfUrl) return undefined;
  if (typeof pdfUrl === 'string') return pdfUrl;
  return pdfUrl[locale] ?? pdfUrl.es;
};

export const resolveLocalizedRulesText = (
  text: LocalizedRulesText | undefined,
  locale: CompetitionRulesLocale,
  fallback: string,
): string => {
  if (!text) return fallback;
  if (typeof text === 'string') return text;
  return text[locale] ?? text.es;
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
  'Inscripción a través de GolfDirecto (golfdirecto.com), en recepción del club, llamando al 964 493 072 o enviando un correo con nombre y número de licencia a golf@panoramicagrupo.com. El plazo se cierra el día antes de la competición a las 12:00 h.';

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

export const individual2026Rules: CompetitionRulesCollection = {
  es: {
    title: 'Orden de Mérito Individual 2026',
    subtitle: 'Resumen práctico de las bases oficiales de la competición.',
    summary: [
      { label: 'Modalidad', value: 'Individual Stableford Hándicap, a 18 hoyos' },
      { label: 'Temporada', value: '8 pruebas' },
      { label: 'Resultados válidos', value: '7 mejores' },
      { label: 'Descartes', value: '1 descarte' },
      { label: 'Categorías', value: 'Hándicap Inferior, Hándicap Superior y Scratch' },
    ],
    sections: [
      {
        id: 'modalidad',
        title: 'Modalidad',
        defaultOpen: true,
        content: ['Individual Stableford Hándicap, a 18 hoyos.'],
      },
      {
        id: 'temporada',
        title: 'Temporada',
        defaultOpen: true,
        content: [
          '8 pruebas. Puntúan los 7 mejores resultados, por lo que cada jugador descarta su peor jornada. No disputar una prueba puede actuar como ese descarte.',
        ],
      },
      {
        id: 'categorias',
        title: 'Categorías',
        defaultOpen: true,
        content: [
          'Tres clasificaciones independientes en cada prueba y en la general — Hándicap Inferior (15,4 o menos), Hándicap Superior (15,5 o más) y Scratch, esta última por resultado bruto.',
          'La categoría queda fijada por el hándicap del jugador en su primera prueba del circuito y se mantiene durante toda la temporada, aunque después su hándicap varíe y pase a otro rango.',
        ],
      },
      {
        id: 'participacion',
        title: 'Participación',
        defaultOpen: true,
        content: [
          'Abierta a jugadores y jugadoras con licencia federativa en vigor del año 2026. Hándicap máximo de juego 28; quien lo supere puede competir, pero clasifica con hándicap limitado a 28. Los jugadores con licencia extranjera necesitan la Licencia Temporal de la Federación de Golf de la Comunitat Valenciana y un justificante de hándicap de su federación de origen.',
        ],
      },
      {
        id: 'calendario',
        title: 'Calendario',
        defaultOpen: true,
        content: [
          '7 de febrero · 4 de abril · 20 de abril · 13 de junio · 12 de septiembre · 10 de octubre · 7 de noviembre · 5 de diciembre (final).',
          'Las fechas pueden variar por causas meteorológicas u organizativas.',
        ],
      },
      {
        id: 'empates',
        title: 'Empates en la general',
        defaultOpen: true,
        content: [
          'Decide el mejor resultado de la última prueba disputada y, si persiste, se comparan las pruebas anteriores de forma sucesiva.',
        ],
      },
      {
        id: 'inscripciones',
        title: 'Inscripciones',
        defaultOpen: true,
        content: [
          'A través de los canales del club, principalmente GolfDirecto. Inscribirse en una prueba no inscribe en el resto.',
        ],
      },
    ],
  },
  en: {
    title: 'Individual Order of Merit 2026',
    subtitle: 'Practical summary of the official competition rules.',
    summary: [
      { label: 'Format', value: 'Individual Stableford Handicap over 18 holes' },
      { label: 'Season', value: '8 events' },
      { label: 'Counting results', value: 'Best 7' },
      { label: 'Discards', value: '1 discard' },
      { label: 'Categories', value: 'Lower Handicap, Higher Handicap and Scratch' },
    ],
    sections: [
      {
        id: 'format',
        title: 'Format',
        defaultOpen: true,
        content: ['Individual Stableford Handicap over 18 holes.'],
      },
      {
        id: 'season',
        title: 'Season',
        defaultOpen: true,
        content: [
          '8 events. The best 7 results count, so every player discards their worst round. Missing an event may serve as that discard.',
        ],
      },
      {
        id: 'categories',
        title: 'Categories',
        defaultOpen: true,
        content: [
          'Three separate standings at each event and overall — Lower Handicap (15.4 or less), Higher Handicap (15.5 or more) and Scratch, the latter on gross score.',
          "A player's category is fixed by their handicap at their first event of the circuit and is held for the whole season, even if their handicap later moves into another band.",
        ],
      },
      {
        id: 'eligibility',
        title: 'Eligibility',
        defaultOpen: true,
        content: [
          'Open to all players, men and women, holding a valid federation licence for the year 2026. Maximum playing handicap is 28; players above it may take part but are classified off a handicap capped at 28. Players with a foreign licence require the Temporary Licence of the Valencian Golf Federation and proof of handicap from their home federation.',
        ],
      },
      {
        id: 'calendar',
        title: 'Calendar',
        defaultOpen: true,
        content: [
          '7 February · 4 April · 20 April · 13 June · 12 September · 10 October · 7 November · 5 December (final).',
          'Dates may change for weather or organisational reasons.',
        ],
      },
      {
        id: 'ties',
        title: 'Ties in the overall standings',
        defaultOpen: true,
        content: [
          'Decided on the best result in the most recent event played and, if still level, by comparing earlier events in turn.',
        ],
      },
      {
        id: 'entries',
        title: 'Entries',
        defaultOpen: true,
        content: [
          "Through the club's usual channels, mainly GolfDirecto. Entering one event does not enter you in the others.",
        ],
      },
    ],
  },
};

export const pairs2026Rules: CompetitionRulesCollection = {
  es: {
    title: 'Orden de Mérito de Parejas 2026',
    subtitle: 'Resumen práctico de las bases oficiales de la competición.',
    summary: [
      { label: 'Modalidad', value: 'Fourball Stableford Hándicap' },
      { label: 'Temporada', value: '8 pruebas' },
      { label: 'Resultados válidos', value: '6 mejores' },
      { label: 'Descartes', value: '2 descartes' },
      { label: 'Categorías', value: '1.ª categoría y 2.ª categoría' },
    ],
    sections: [
      {
        id: 'modalidad',
        title: 'Modalidad',
        defaultOpen: true,
        content: [
          'Fourball Stableford Hándicap. Cada jugador juega su propia bola y, para el resultado de la pareja, cuenta el mejor Stableford de los dos en cada hoyo.',
        ],
      },
      {
        id: 'temporada',
        title: 'Temporada',
        defaultOpen: true,
        content: [
          '8 pruebas. Puntúan los 6 mejores resultados, por lo que cada pareja descarta sus dos peores jornadas. No disputar una prueba puede actuar como uno de esos descartes.',
        ],
      },
      {
        id: 'categorias',
        title: 'Categorías',
        defaultOpen: true,
        content: [
          '1.ª categoría hasta hándicap 15,4 y 2.ª categoría desde 15,5.',
          'La categoría de la pareja queda fijada en su primera prueba del circuito y se mantiene durante toda la temporada, aunque después varíen los hándicaps de sus integrantes.',
        ],
      },
      {
        id: 'participacion',
        title: 'Participación',
        defaultOpen: true,
        content: [
          'Jugadores y jugadoras con licencia federativa en vigor y hándicap activo. La pareja debe mantener la misma composición para poder acumular resultados en la clasificación general.',
        ],
      },
      {
        id: 'calendario',
        title: 'Calendario',
        defaultOpen: true,
        content: [
          '25 de abril · 30 de mayo · 28 de junio · 12 de julio · 26 de septiembre · 17 de octubre · 21 de noviembre · 19 de diciembre (final).',
        ],
      },
      {
        id: 'premios-prueba',
        title: 'Premios por prueba',
        defaultOpen: true,
        content: [
          '1.ª y 2.ª pareja clasificada de cada categoría, independientes de los premios de la clasificación general.',
        ],
      },
      {
        id: 'empates',
        title: 'Empates en la general',
        defaultOpen: true,
        content: [
          'Decide el mejor resultado de la última prueba disputada y, si persiste, se comparan sucesivamente las anteriores.',
        ],
      },
      {
        id: 'inscripciones',
        title: 'Inscripciones',
        defaultOpen: true,
        content: ['A través de los canales del club, principalmente GolfDirecto.'],
      },
    ],
  },
  en: {
    title: 'Pairs Order of Merit 2026',
    subtitle: 'Practical summary of the official competition rules.',
    summary: [
      { label: 'Format', value: 'Fourball Stableford Handicap' },
      { label: 'Season', value: '8 events' },
      { label: 'Counting results', value: 'Best 6' },
      { label: 'Discards', value: '2 discards' },
      { label: 'Categories', value: '1st Category and 2nd Category' },
    ],
    sections: [
      {
        id: 'format',
        title: 'Format',
        defaultOpen: true,
        content: [
          "Fourball Stableford Handicap. Each player plays their own ball and, for the pair's score, the better Stableford result of the two counts on every hole.",
        ],
      },
      {
        id: 'season',
        title: 'Season',
        defaultOpen: true,
        content: [
          '8 events. The best 6 results count, so every pair discards its two worst rounds. Missing an event may serve as one of those discards.',
        ],
      },
      {
        id: 'categories',
        title: 'Categories',
        defaultOpen: true,
        content: [
          '1st Category up to handicap 15.4 and 2nd Category from 15.5.',
          "A pair's category is fixed at their first event of the circuit and is held for the whole season, even if the members' handicaps later move into another band.",
        ],
      },
      {
        id: 'eligibility',
        title: 'Eligibility',
        defaultOpen: true,
        content: [
          'Players, men and women, holding a valid federation licence and an active handicap. A pair must keep the same composition in order to accumulate results in the overall standings.',
        ],
      },
      {
        id: 'calendar',
        title: 'Calendar',
        defaultOpen: true,
        content: [
          '25 April · 30 May · 28 June · 12 July · 26 September · 17 October · 21 November · 19 December (final).',
        ],
      },
      {
        id: 'prizes-per-event',
        title: 'Prizes per event',
        defaultOpen: true,
        content: [
          '1st and 2nd placed pair in each category, separate from the overall standings prizes.',
        ],
      },
      {
        id: 'ties',
        title: 'Ties in the overall standings',
        defaultOpen: true,
        content: [
          'Decided on the best result in the most recent event played and, if still level, by comparing earlier events in turn.',
        ],
      },
      {
        id: 'entries',
        title: 'Entries',
        defaultOpen: true,
        content: ["Through the club's usual channels, mainly GolfDirecto."],
      },
    ],
  },
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
