/**
 * Validate request body against a Zod schema.
 * On failure, passes error to next() with status 400.
 * @param {z.ZodSchema} schema
 */
export function validate(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (result.success) {
      req.validated = result.data;
      next();
    } else {
      const first = result.error.issues?.[0];
      const err = new Error(first?.message ?? 'Validation failed');
      err.status = 400;
      next(err);
    }
  };
}
