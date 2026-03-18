import { z } from 'zod';

export const requestOtpSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(100, 'First name is too long'),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(100, 'Last name is too long'),
  email: z
    .string()
    .min(1, 'Email address is required')
    .email('Invalid email address')
    .max(255, 'Email is too long'),
  companyName: z
    .string()
    .min(1, 'Company name is required')
    .max(255, 'Company name is too long'),
});
