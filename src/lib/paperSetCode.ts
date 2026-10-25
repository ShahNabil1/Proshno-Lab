/** Stable, unbounded set labels; index zero is the original paper. */
export function paperSetCode(index: number, english = false): string {
  const letters = english ? Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ') : Array.from('কখগঘঙচছজঝঞটঠডঢণতথদধনপফবভমযরলশষসহ');
  let value = Number.isSafeInteger(index) && index >= 0 ? index + 1 : 1;
  let label = '';
  while (value > 0) {
    value--;
    label = letters[value % letters.length] + label;
    value = Math.floor(value / letters.length);
  }
  return label;
}
