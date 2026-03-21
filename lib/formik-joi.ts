import type { FormikErrors } from "formik";
import Joi, { Schema } from "joi";

export function validateWithJoi<T extends object>(schema: Schema, values: T) {
  const result = schema.validate(values, {
    abortEarly: false,
    allowUnknown: true,
    stripUnknown: false,
  });

  if (!result.error) {
    return {} as FormikErrors<T>;
  }

  const errors: FormikErrors<T> = {};
  result.error.details.forEach((detail) => {
    const key = String(detail.path[0] ?? "");
    if (!key || errors[key as keyof T]) {
      return;
    }
    (errors as Record<string, string>)[key] = detail.message;
  });

  return errors;
}

export const joiStringRequired = (label: string) => Joi.string().trim().required().messages({
  "string.empty": `${label} es obligatorio.`,
  "any.required": `${label} es obligatorio.`,
});
