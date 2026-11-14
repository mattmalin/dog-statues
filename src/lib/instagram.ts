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

export const instagramRequest = z.object({
  photoIds: z.array(idSchema).min(1).max(instagramPhotoLimit),
  caption: z.string().min(1).max(instagramCaptionLimit),
  confirmPublic: z.literal(true),
});

export type InstagramPublication = {
  status: 'preparing' | 'failed' | 'unknown' | 'published';
  permalink: string | null;
};
