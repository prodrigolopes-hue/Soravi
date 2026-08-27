import {
  ValidateBy,
  ValidationOptions,
  buildMessage,
} from "class-validator";

import { normalizeBrazilianPhoneToE164 } from "./brazilian-phone";

export const IS_BRAZILIAN_PHONE = "isBrazilianPhone";

export function IsBrazilianPhone(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: IS_BRAZILIAN_PHONE,
      validator: {
        validate: (value: unknown) =>
          typeof value === "string" &&
          normalizeBrazilianPhoneToE164(value) !== null,
        defaultMessage: buildMessage(
          () => "Informe um telefone brasileiro válido com DDD.",
          validationOptions,
        ),
      },
    },
    validationOptions,
  );
}
