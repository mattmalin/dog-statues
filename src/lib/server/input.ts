import { error } from '@sveltejs/kit';
import type { ZodType } from 'zod';
import { idSchema } from '$lib/model';

export function uuid(value: unknown) {
  const result = idSchema.safeParse(value);
  if (!result.success) error(404, 'Record not found.');
  return result.data.toLowerCase();
}

export async function body<T>(request: Request, schema: ZodType<T>) {
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') {
    error(415, 'Send JSON for this action.');
  }
  const input = await request.json().catch(() => null);
  const result = schema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    error(
      422,
      issue.path.length
        ? `Check ${issue.path.at(-1)?.toString().replaceAll('_', ' ')}. ${issue.message}`
        : issue.message,
    );
  }
  return result.data;
}
