import type { Statue } from './model';

export type DraftListRow = Statue & {
  instagram_draft: string | null;
  thumbnail_media_id: string | null;
  photo_count: number;
  missing_alt: boolean;
  search_text: string;
};

export type ListOption = { value: string; label: string };
export const sortOptions: ListOption[] = [
  { value: 'updated_desc', label: 'Recently updated' },
  { value: 'updated_asc', label: 'Least recently updated' },
  { value: 'created_desc', label: 'Newest added' },
  { value: 'created_asc', label: 'Oldest added' },
  { value: 'name_asc', label: 'Name A–Z' },
  { value: 'name_desc', label: 'Name Z–A' },
  { value: 'city', label: 'City A–Z' },
  { value: 'country', label: 'Country A–Z' },
  { value: 'photos_desc', label: 'Most images first' },
  { value: 'photos_asc', label: 'Fewest images first' },
];

export function normalizeSearch(value: string) {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replaceAll('_', ' ');
}

export function searchText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return Object.values(value).map(searchText).join(' ');
  return normalizeSearch(String(value));
}

export function matchesSearch(index: string, query: string) {
  return normalizeSearch(query)
    .trim()
    .split(/\s+/)
    .every((term) => index.includes(term));
}

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });
export const samePlace = (a: string, b: string) =>
  normalizeSearch(a.trim()) === normalizeSearch(b.trim());
export function places(values: string[]) {
  const unique = new Map<string, string>();
  for (const value of values)
    if (value.trim()) unique.set(normalizeSearch(value.trim()), value.trim());
  return [...unique.values()].sort(collator.compare);
}

export function sortRecords<
  T extends { id: string; city: string; country: string; created_at: string; updated_at: string },
>(rows: T[], sort: string, name: (row: T) => string, images: (row: T) => number) {
  return [...rows].sort((a, b) => {
    let order = 0;
    switch (sort) {
      case 'name_asc':
        order = collator.compare(name(a), name(b));
        break;
      case 'name_desc':
        order = collator.compare(name(b), name(a));
        break;
      case 'created_desc':
        order = b.created_at.localeCompare(a.created_at);
        break;
      case 'created_asc':
        order = a.created_at.localeCompare(b.created_at);
        break;
      case 'updated_asc':
        order = a.updated_at.localeCompare(b.updated_at);
        break;
      case 'photos_desc':
        order = images(b) - images(a);
        break;
      case 'photos_asc':
        order = images(a) - images(b);
        break;
      case 'city':
        order = collator.compare(a.city, b.city);
        break;
      case 'country':
        order = collator.compare(a.country, b.country) || collator.compare(a.city, b.city);
        break;
      case 'london_first':
        order =
          Number(samePlace(b.city, 'London')) - Number(samePlace(a.city, 'London')) ||
          collator.compare(a.country, b.country) ||
          collator.compare(a.city, b.city);
        break;
      default:
        order = b.updated_at.localeCompare(a.updated_at);
    }
    return order || collator.compare(name(a), name(b)) || a.id.localeCompare(b.id);
  });
}
