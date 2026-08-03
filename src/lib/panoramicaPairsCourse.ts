/**
 * Panorámica Golf juega siempre el mismo recorrido y la distribución de HCP por hoyo
 * es idéntica para hombres y mujeres. Por eso, en las competiciones de Parejas,
 * course_handicap es el array canónico para ambos géneros.
 *
 * Este helper solo prepara los argumentos que recibe buildFourballScorecard:
 * no altera su lógica interna, ni el Net/Brt oficial, ni el género del jugador.
 */

/**
 * Índices de hoyo aplicables a jugadoras en Parejas Panorámica.
 * Usa course_handicap_women si existe; si no, el course_handicap compartido.
 */
export const resolvePairsWomenHoleHandicap = (
  courseHandicap: readonly number[] | null | undefined,
  courseHandicapWomen: readonly number[] | null | undefined,
): readonly number[] | null =>
  (courseHandicapWomen && courseHandicapWomen.length === 18
    ? courseHandicapWomen
    : courseHandicap && courseHandicap.length === 18
      ? courseHandicap
      : null);
