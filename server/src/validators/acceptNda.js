import { z } from 'zod';

export const acceptNdaSchema = z.object({
  ndaVersion: z
    .string()
    .min(1, 'NDA version is required')
    .max(50, 'NDA version is too long'),
});
