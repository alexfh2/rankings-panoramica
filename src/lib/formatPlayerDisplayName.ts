/**
 * Helper pur de PRESENTACIÓ: "APELLIDOS, NOMBRE" → "Nombre Apellido".
 * No modifica dades emmagatzemades ni s'utilitza en cap càlcul.
 */

const capitalizeWord = (word: string): string =>
  word.length === 0 ? word : word[0].toLocaleUpperCase('es-ES') + word.slice(1).toLocaleLowerCase('es-ES');

const prettify = (raw: string): string => {
  const isAllCaps = raw === raw.toLocaleUpperCase('es-ES');
  if (!isAllCaps) return raw;
  return raw
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.split('-').map(capitalizeWord).join('-'))
    .join(' ');
};

export function formatPlayerDisplayName(name: string): string {
  const original = (name ?? '').trim();
  if (!original) return original;

  const commaIndex = original.indexOf(',');
  if (commaIndex === -1) return original;

  const surnames = original.slice(0, commaIndex).trim().split(/\s+/).filter(Boolean);
  const givenNames = original.slice(commaIndex + 1).trim().split(/\s+/).filter(Boolean);

  if (surnames.length === 0 || givenNames.length === 0) return original;

  const display = `${prettify(givenNames[0])} ${prettify(surnames[0])}`.trim();
  return display || original;
}
