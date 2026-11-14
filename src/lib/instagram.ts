import { z } from 'zod';
import { idSchema } from './model';

export const instagramHandle = '@dogstatues';
export const instagramPhotoLimit = 10;
export const instagramCaptionLimit = 2200;

export function instagramCaption(description: string, city: string, country: string) {
  return description.trim() && city.trim() && country.trim()
    ? `${description.trim()}\n\nLocation: ${city.trim()}, ${country.trim()}`
    : '';
}

export const squareCropSchema = z.strictObject({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  zoom: z.number().min(1).max(3),
});
export type SquareCrop = z.infer<typeof squareCropSchema>;
export const defaultCrop: SquareCrop = { x: 50, y: 50, zoom: 1 };

export function cropBounds(width: number, height: number, crop: SquareCrop) {
  const size = Math.max(1, Math.floor(Math.min(width, height) / crop.zoom));
  return {
    left: Math.round(((width - size) * crop.x) / 100),
    top: Math.round(((height - size) * crop.y) / 100),
    width: size,
    height: size,
  };
}

export const instagramDraftSchema = z.strictObject({
  photoIds: z.array(idSchema).max(instagramPhotoLimit),
  crops: z.record(idSchema, squareCropSchema),
});
export type InstagramDraft = z.infer<typeof instagramDraftSchema>;

export const instagramRequest = instagramDraftSchema.extend({
  photoIds: z.array(idSchema).min(1).max(instagramPhotoLimit),
  crops: instagramDraftSchema.shape.crops.optional(),
  caption: z.string().min(1).max(instagramCaptionLimit),
  confirmPublic: z.literal(true),
});

export type InstagramPublication = {
  status: 'preparing' | 'failed' | 'unknown' | 'published';
  permalink: string | null;
};
