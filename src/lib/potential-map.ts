import type { PotentialStatue } from './potential';

export type PotentialMapRow = Pick<
  PotentialStatue,
  'id' | 'name' | 'location' | 'city' | 'country' | 'status'
> & {
  map_location: {
    latitude: number;
    longitude: number;
    approximate: boolean;
    description: string;
    source_url?: string;
  } | null;
};
