/**
 * Reglamentos resumidos de las competiciones de Panorámica 2026.
 * Contenido estático: no hay consultas ni almacenamiento en el backend.
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
  'Puntuación Stableford: en cada hoyo se comparan los golpes efectuados con el par ajustado al hándicap del jugador. Doble bogey o peor suma 0 puntos, bogey 1, par 2, birdie 3, eagle 4 y albatros 5. Gana quien acumula más puntos.';

export const individual2026Rules: CompetitionRules = {
  title: 'Orden del Mérito Individual 2026',
  subtitle: 'Resumen práctico de las bases de la competición.',
  summary: [
    { label: 'Modalidad', value: 'Individual Stableford' },
    { label: 'Calendario', value: '8 pruebas' },
    { label: 'Resultados válidos', value: '7 mejores' },
    { label: 'Categorías', value: '1ª, 2ª y Scratch' },
  ],
  sections: [
    {
      id: 'participantes',
      title: 'Participantes',
      items: [
        'Jugadores con licencia federativa en vigor en 2026.',
        'Hándicap limitado según el reglamento oficial.',
        'Las licencias extranjeras requieren la licencia temporal y la acreditación correspondiente.',
      ],
    },
    {
      id: 'categorias',
      title: 'Categorías',
      defaultOpen: true,
      items: [
        '1ª Categoría: hándicap hasta 15,4.',
        '2ª Categoría: hándicap desde 15,5 hasta 36.',
        'Scratch: categoría indistinta.',
        'La categoría queda fijada por el hándicap de la primera prueba disputada.',
        'Un cambio posterior de hándicap no cambia la categoría de la competición.',
      ],
    },
    {
      id: 'modalidad',
      title: 'Modalidad',
      content: [STABLEFORD_NOTE],
      items: [
        'Individual Stableford.',
        'Si alguna prueba utiliza otra modalidad, el resultado se convierte a Stableford para la clasificación.',
      ],
    },
    {
      id: 'clasificacion',
      title: 'Clasificación',
      defaultOpen: true,
      items: [
        'La clasificación suma las 7 mejores puntuaciones de las 8 pruebas.',
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
        'Masculino: barras amarillas.',
        'Femenino: barras rojas.',
        'En la prueba Xperience PGA se aplican las barras especiales indicadas en el reglamento oficial.',
      ],
    },
    {
      id: 'premios',
      title: 'Premios',
      content: [
        'Los detalles completos de los premios finales figuran en el documento oficial; a continuación, un resumen.',
      ],
      items: [
        'Ganador de 1ª Categoría.',
        'Ganador de 2ª Categoría.',
        'Ganador Scratch.',
      ],
    },
    {
      id: 'inscripcion',
      title: 'Inscripción',
      items: [
        'Socios: 27 €.',
        'Junior: 27 €.',
        'Externos y otros: 65 €.',
        'Inscripción mediante recepción, teléfono o correo del club.',
        'El plazo se cierra el día anterior a las 12:00.',
      ],
    },
    {
      id: 'normas',
      title: 'Normas y contacto',
      items: [
        'Las incidencias no recogidas serán resueltas por el Comité de Competición.',
        'Contacto: golf@panoramicagrupo.com.',
      ],
    },
  ],
};

export const verano2026Rules: CompetitionRules = {
  title: 'Liga de Verano 2026',
  subtitle: 'Resumen práctico de las bases de la competición.',
  summary: [
    { label: 'Modalidad', value: 'Individual Stableford' },
    { label: 'Calendario', value: '5 pruebas' },
    { label: 'Resultados válidos', value: '4 mejores' },
    { label: 'Categorías', value: '1ª y 2ª' },
  ],
  sections: [
    {
      id: 'participantes',
      title: 'Participantes',
      items: [
        'Jugadores con licencia federativa en vigor en 2026.',
        'Hándicap limitado según el reglamento oficial.',
        'Las licencias extranjeras requieren licencia temporal y acreditación correspondiente.',
      ],
    },
    {
      id: 'calendario',
      title: 'Calendario',
      items: [
        '10 de agosto de 2026.',
        '12 de agosto de 2026.',
        '17 de agosto de 2026.',
        '19 de agosto de 2026.',
        '21 de agosto de 2026.',
      ],
    },
    {
      id: 'categorias',
      title: 'Categorías',
      defaultOpen: true,
      items: [
        '1ª Categoría: hándicap hasta 16,4.',
        '2ª Categoría: hándicap desde 16,5 hasta 36.',
        'La categoría queda fijada por el hándicap de la primera prueba disputada.',
        'Los cambios posteriores de hándicap no cambian la categoría.',
      ],
    },
    {
      id: 'modalidad',
      title: 'Modalidad',
      content: [STABLEFORD_NOTE],
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
      items: ['Masculino: barras amarillas.', 'Femenino: barras rojas.'],
    },
    {
      id: 'premios',
      title: 'Premios',
      items: [
        'Ganador de cada categoría en cada prueba.',
        'Primer y segundo clasificado final de cada categoría reciben trofeo conmemorativo.',
      ],
    },
    {
      id: 'inscripcion',
      title: 'Inscripción',
      items: [
        'Socios: 25 € por prueba.',
        'Bono socios: 100 €.',
        'No socios: 50 € por prueba.',
        'Bono no socios: 200 €.',
        'El plazo se cierra el día anterior a las 12:00.',
      ],
    },
    {
      id: 'normas',
      title: 'Normas y contacto',
      items: [
        'Las incidencias no recogidas serán resueltas por el Comité de Competición.',
        'Contacto: golf@panoramicagrupo.com.',
      ],
    },
  ],
};
