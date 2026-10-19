import { Transform } from "class-transformer";
import {
  IsString,
  MaxLength,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from "class-validator";

import { normalizeCpf } from "../../../common/cpf/cpf";

function IsValidCpf(validationOptions?: ValidationOptions): PropertyDecorator {
  return (target, propertyKey) => {
    registerDecorator({
      name: "isValidCpf",
      target: target.constructor,
      propertyName: propertyKey.toString(),
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          try {
            normalizeCpf(value);
            return true;
          } catch {
            return false;
          }
        },
        defaultMessage(_arguments: ValidationArguments): string {
          return "CPF invalido.";
        },
      },
    });
  };
}

export class RecordPersonalIdentityDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString({ message: "CPF invalido." })
  @MaxLength(14, { message: "CPF invalido." })
  @IsValidCpf({ message: "CPF invalido." })
  cpf!: string;
}
