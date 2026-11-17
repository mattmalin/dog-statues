import { z } from 'zod';
import { googleMapsUrl } from './maps';
import { idSchema, revisionSchema } from './model';

export const potentialStatuses = {
  researching: 'Researching',
  to_visit: 'To visit',
  visited: 'Visited',
  archived: 'Archived',
} as const;

export const potentialFieldsSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(160),
    city: z.string().trim().max(100),
    country: z.string().trim().max(100),
    location: z.string().trim().max(320),
    maps_url: z
      .string()
      .trim()
      .max(2048)
      .refine((value) => !value || googleMapsUrl(value), 'Enter a Google Maps link.'),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    pin_checked: z.boolean(),
    source_url: z
      .string()
      .trim()
      .max(2048)
      .refine((value) => {
        if (!value) return true;
        try {
          const url = new URL(value);
          return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
        } catch {
          return false;
        }
      }, 'Enter an http or https source link.'),
    notes: z.string().max(12000),
    status: z.enum(['researching', 'to_visit', 'visited', 'archived']),
  })
  .refine((value) => (value.latitude === null) === (value.longitude === null), {
    message: 'Enter both coordinates, or clear both.',
  });

export const potentialSaveSchema = z.object({
  id: idSchema,
  revision: revisionSchema.nullable(),
  fields: potentialFieldsSchema,
});

export type PotentialFields = z.infer<typeof potentialFieldsSchema>;
export type PotentialStatue = PotentialFields & {
  id: string;
  revision: number;
  created_at: string;
  updated_at: string;
};

export const initialPotential: PotentialFields = {
  name: '',
  city: '',
  country: '',
  location: '',
  maps_url: '',
  latitude: null,
  longitude: null,
  pin_checked: false,
  source_url: '',
  notes: '',
  status: 'researching',
};
