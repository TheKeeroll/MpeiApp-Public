import {z} from 'zod';

const hasUnsafeClientNameCharacter = (value: string): boolean => /[\u0000-\u001F\u007F-\u009F/\\]/.test(value);

export const clientNameSchema = z
  .string()
  .min(1)
  .max(256)
  .refine(value => value === value.trim(), 'Client name must not be padded')
  .refine(value => !hasUnsafeClientNameCharacter(value), 'Client name contains an unsafe character');

export const proxyRequestSchema = z.discriminatedUnion('purpose', [
  z.object({
    purpose: z.literal('verify'),
    clientName: clientNameSchema,
  }).strict(),
  z.object({
    purpose: z.literal('demo'),
  }).strict(),
]);

export type ProxyRequest = z.infer<typeof proxyRequestSchema>;

export const failedResponse = Object.freeze({reqStatus: 'failed'} as const);
