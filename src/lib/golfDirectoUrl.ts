/**
 * Helpers purs per llegir URLs de GolfDirecto.
 * No fan cap petició: només extreuen i validen identificadors.
 */

export interface GolfDirectoUrlParts {
  url: string;
  gameId: string | null;
  categoryId: string | null;
}

const ID_RE = '[a-f0-9]{24}';

export const isGolfDirectoUrl = (url: string): boolean =>
  url.toLowerCase().includes('golfdirecto.com');

/** Extreu gameId i categoryId d'una URL de GolfDirecto (qualsevol variant: /next/, /micro/, /web/). */
export const parseGolfDirectoUrl = (rawUrl: string): GolfDirectoUrlParts => {
  const url = (rawUrl || '').trim();
  const game = url.match(new RegExp(`game/(${ID_RE})`, 'i'));
  const category = url.match(new RegExp(`category=(${ID_RE})`, 'i'));
  return {
    url,
    gameId: game ? game[1].toLowerCase() : null,
    categoryId: category ? category[1].toLowerCase() : null,
  };
};

/** Converteix un textarea (una URL per línia) en una llista neta d'URLs. */
export const splitUrlLines = (value: string): string[] =>
  (value || '')
    .split(/[\r\n]+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

export interface GolfDirectoUrlGroupResult {
  ok: boolean;
  gameId: string | null;
  parts: GolfDirectoUrlParts[];
  /** Codi d'error bloquejant, si n'hi ha. */
  code?: 'GOLFDIRECTO_DIFFERENT_GAME' | 'GOLFDIRECTO_MISSING_GAME_ID';
  error?: string;
}

/**
 * Comprova que totes les URLs de GolfDirecto pertanyin al MATEIX torneig.
 * Si no, retorna un error bloquejant (no s'han de fusionar mai dos tornejos).
 */
export const validateSameGolfDirectoGame = (urls: string[]): GolfDirectoUrlGroupResult => {
  const parts = urls.map(parseGolfDirectoUrl);
  const gameIds = Array.from(new Set(parts.map((p) => p.gameId).filter((g): g is string => !!g)));

  if (gameIds.length === 0) {
    return {
      ok: false,
      gameId: null,
      parts,
      code: 'GOLFDIRECTO_MISSING_GAME_ID',
      error: "No s'ha pogut extreure l'ID del torneig de la URL de GolfDirecto.",
    };
  }
  if (gameIds.length > 1) {
    return {
      ok: false,
      gameId: null,
      parts,
      code: 'GOLFDIRECTO_DIFFERENT_GAME',
      error: 'Los enlaces pertenecen a torneos diferentes de GolfDirecto.',
    };
  }
  return { ok: true, gameId: gameIds[0], parts };
};
