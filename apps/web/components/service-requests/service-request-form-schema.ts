import { z } from "zod";

export const serviceRequestSchema = z.object({
  categoryId: z.uuidv4("Selecione uma categoria válida."),
  title: z
    .string()
    .trim()
    .min(2, "O título deve possuir pelo menos 2 caracteres.")
    .max(160, "O título deve possuir no máximo 160 caracteres."),
  description: z
    .string()
    .trim()
    .max(2000, "A descrição deve possuir no máximo 2000 caracteres."),
  location: z.object({
    country: z
      .string()
      .length(2, "O país deve possuir exatamente 2 caracteres."),
    state: z
      .string()
      .trim()
      .length(2, "Informe a sigla do estado com 2 caracteres."),
    city: z
      .string()
      .trim()
      .min(2, "A cidade deve possuir pelo menos 2 caracteres.")
      .max(120, "A cidade deve possuir no máximo 120 caracteres."),
    neighborhood: z
      .string()
      .trim()
      .min(1, "Informe o bairro.")
      .max(120, "O bairro deve possuir no máximo 120 caracteres."),
    postalCode: z
      .string()
      .trim()
      .min(1, "Informe o CEP.")
      .max(16, "O CEP deve possuir no máximo 16 caracteres."),
    addressLine: z
      .string()
      .trim()
      .min(1, "Informe o endereço.")
      .max(255, "O endereço deve possuir no máximo 255 caracteres."),
    addressNumber: z
      .string()
      .trim()
      .min(1, "Informe o número.")
      .max(32, "O número deve possuir no máximo 32 caracteres."),
    addressComplement: z
      .string()
      .trim()
      .max(255, "O complemento deve possuir no máximo 255 caracteres."),
  }),
});

export type ServiceRequestFormData = z.infer<typeof serviceRequestSchema>;
