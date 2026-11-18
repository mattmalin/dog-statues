import { z } from 'zod';

export const maxVideos = 6;
export const maxVideoUpload = 100 * 1024 * 1024;
export const maxVideoSeconds = 90;
export const videoEditSchema = z.strictObject({
  action: z.enum(['details', 'earlier', 'later', 'delete']),
  description: z.string().max(1000).optional(),
  credit: z.string().max(300).optional(),
  captions: z
    .string()
    .max(50000)
    .refine(
      (value) => !value.trim() || /^WEBVTT(?:\s|$)/.test(value.trim()),
      'Captions must start with WEBVTT.',
    )
    .optional(),
  rights_status: z.enum(['private', 'approved']).optional(),
});
export type Video = {
  id: string;
  statue_id: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  width: number;
  height: number;
  duration_seconds: number;
  position: number;
  description: string;
  credit: string;
  captions: string;
  rights_status: 'private' | 'approved';
};
export type PublicVideo = Pick<
  Video,
  'id' | 'description' | 'credit' | 'captions' | 'width' | 'height' | 'duration_seconds'
>;
