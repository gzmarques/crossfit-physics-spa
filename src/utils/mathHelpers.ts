export const G = 9.81;
export const MASSA_SLED = 43.0;

export function parseClockTime(str: string | number): number {
  if (str === undefined || str === null) return -1;
  const cleanStr = str.toString().trim();
  if (cleanStr === "") return -1;

  if (!cleanStr.includes(':')) {
    const val = Number(cleanStr);
    return (!isNaN(val) && val >= 0) ? val : -1;
  }

  const parts = cleanStr.split(':').map(p => Number(p.trim()));
  if (parts.some(p => isNaN(p) || p < 0)) return -1;

  if (parts.length === 2) {
    return (parts[0] * 60) + parts[1];
  } else if (parts.length === 3) {
    return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
  }
  return -1;
}

export function getAlturaCaixaMetros(extraVal: number, isMasc: boolean): number {
  const h = extraVal > 0 ? extraVal : (isMasc ? 0.61 : 0.51);
  return h > 3.0 ? h * 0.0254 : h; 
}