export function normalizeLatex(text: string): string {
  return text
    .replace(/\\[a-zA-Z]+/g, ' ')
    .replace(/[{}\s()[\]]/g, '');
}

export function compactFormula(text: string): string {
  return normalizeLatex(text)
    .replace(/[−–]/g, '-')
    .replace(/[·×⋅]/g, '*')
    .toLowerCase();
}

export function normalizeSearchText(text: string): string {
  return text.toLowerCase().replace(/ё/g, 'е').trim();
}