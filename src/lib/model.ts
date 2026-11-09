import { z } from 'zod';

export const idSchema = z.uuidv4();
export const maxUpload = 25 * 1024 * 1024;
export const maxPhotos = 20;

export const fieldsSchema = z
  .strictObject({
    title: z.string().max(160),
    short_summary: z.string().max(300),
    web_description: z.string().max(16000),
    instagram_caption: z.string().max(2200),
    private_notes: z.string().max(16000),
    address: z.string().max(320),
    city: z.string().max(100),
    region: z.string().max(100),
    country: z.string().max(100),
    postal_code: z.string().max(30),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    editorial_status: z.enum(['inbox', 'draft', 'ready']),
    visit_status: z.enum(['unvisited', 'visited']),
  })
  .refine((value) => (value.latitude === null) === (value.longitude === null), {
    message: 'Enter both coordinates, or clear both.',
  });

export const revisionSchema = z.number().int().min(0).max(2147483646);
export const saveSchema = z.strictObject({ revision: revisionSchema, fields: fieldsSchema });
export const publishSchema = z.strictObject({
  revision: revisionSchema,
  action: z.enum(['publish', 'unpublish']),
  waivePhoto: z.boolean(),
});
export const photoEditSchema = z.strictObject({
  action: z.enum(['details', 'cover', 'earlier', 'later', 'delete']),
  alt_text: z.string().max(500).optional(),
  credit: z.string().max(300).optional(),
  rights_status: z.enum(['private', 'approved']).optional(),
});

export type Fields = z.infer<typeof fieldsSchema>;
export const initialFields: Fields = {
  title: '',
  short_summary: '',
  web_description: '',
  instagram_caption: '',
  private_notes: '',
  address: '',
  city: '',
  region: '',
  country: '',
  postal_code: '',
  latitude: null,
  longitude: null,
  editorial_status: 'inbox',
  visit_status: 'unvisited',
};

export type Statue = Fields & {
  id: string;
  slug: string | null;
  web_status: 'unpublished' | 'published' | 'hidden';
  web_published_at: string | null;
  updated_at: string;
  created_at: string;
  revision: number;
  cover_media_id: string | null;
  photo_waiver: boolean;
};

export type Photo = {
  id: string;
  statue_id: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  width: number;
  height: number;
  position: number;
  alt_text: string;
  credit: string;
  rights_status: 'private' | 'approved';
};
export type PublicPhoto = Pick<Photo, 'id' | 'alt_text' | 'credit' | 'width' | 'height'>;
export type PublicStatue = Pick<
  Statue,
  | 'title'
  | 'short_summary'
  | 'web_description'
  | 'address'
  | 'city'
  | 'region'
  | 'country'
  | 'postal_code'
  | 'latitude'
  | 'longitude'
  | 'cover_media_id'
> & { slug: string };
