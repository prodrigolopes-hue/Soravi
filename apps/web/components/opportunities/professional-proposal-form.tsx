"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "../../lib/zod";

import { proposalCreateUrl } from "../../lib/api";

const estimatedDurationUnits = ["HOUR", "DAY", "WEEK", "MONTH"] as const;

type EstimatedDurationUnit = (typeof estimatedDurationUnits)[number];

const durationUnitLabels: Record<EstimatedDurationUnit, string> = {
  HOUR: "Hora(s)",
  DAY: "Dia(s)",
  WEEK: "Semana(s)",
  MONTH: "Mês(es)",
};

const proposalSchema = z.object({
  amount: z
    .string()
    .min(1, "Informe o valor da proposta.")
    .refine((value) => currencyToCents(value) > 0, "Informe um valor maior que zero."),
  estimatedDurationValue: z
    .string()
    .trim()
    .min(1, "Informe o prazo estimado.")
    .regex(/^\d+$/u, "O prazo deve ser um número inteiro.")
    .refine((value) => Number(value) > 0, "Informe um prazo maior que zero."),
  estimatedDurationUnit: z.enum(estimatedDurationUnits),
  message: z
    .string()
    .trim()
    .min(1, "Escreva uma mensagem para o cliente.")
    .max(2000, "A mensagem deve ter no máximo 2000 caracteres."),
});

type ProposalFormData = z.infer<typeof proposalSchema>;

interface ProposalResponse {
  id: string;
  serviceRequestId: string;
  amountInCents: number;
  estimatedDurationValue: number;
  estimatedDurationUnit: EstimatedDurationUnit;
  message: string;
  status: "ACTIVE" | "ACCEPTED" | "REJECTED" | "WITHDRAWN" | "EXPIRED";
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
}

interface ProfessionalProposalFormProps {
  accessToken: string;
  serviceRequestId: string;
}

type SubmissionState = "idle" | "success" | "already-exists" | "closed" | "unavailable" | "error";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isEstimatedDurationUnit(value: unknown): value is EstimatedDurationUnit {
  return estimatedDurationUnits.some((unit) => unit === value);
}

function parseProposalResponse(payload: unknown): ProposalResponse | null {
  if (!isRecord(payload)) {
    return null;
  }

  const root = isRecord(payload.data) ? payload.data : payload;

  if (
    typeof root.id !== "string" ||
    typeof root.serviceRequestId !== "string" ||
    !Number.isInteger(root.amountInCents) ||
    !Number.isInteger(root.estimatedDurationValue) ||
    !isEstimatedDurationUnit(root.estimatedDurationUnit) ||
    typeof root.message !== "string" ||
    typeof root.status !== "string" ||
    typeof root.submittedAt !== "string" ||
    typeof root.createdAt !== "string" ||
    typeof root.updatedAt !== "string"
  ) {
    return null;
  }

  return root as unknown as ProposalResponse;
}

function parseErrorCode(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  const root = isRecord(payload.data) ? payload.data : payload;
  return typeof root.code === "string" ? root.code : null;
}

function currencyToCents(value: string): number {
  const digits = value.replace(/\D/gu, "");
  return digits ? Number(digits) : 0;
}

function formatCurrencyInput(value: string): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(currencyToCents(value) / 100);
}

function formatCurrency(amountInCents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amountInCents / 100);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ProfessionalProposalForm({
  accessToken,
  serviceRequestId,
}: ProfessionalProposalFormProps) {
  const [submissionState, setSubmissionState] = useState<SubmissionState>("idle");
  const [proposal, setProposal] = useState<ProposalResponse | null>(null);
  const submissionInFlightRef = useRef(false);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProposalFormData>({
    resolver: zodResolver(proposalSchema),
    defaultValues: {
      amount: "",
      estimatedDurationValue: "",
      estimatedDurationUnit: "DAY",
      message: "",
    },
    mode: "onTouched",
  });

  const messageLength = watch("message").length;
  const amountField = register("amount");

  async function submitProposal(data: ProposalFormData): Promise<void> {
    if (submissionInFlightRef.current) {
      return;
    }

    submissionInFlightRef.current = true;
    setSubmissionState("idle");

    try {
      const response = await fetch(proposalCreateUrl(serviceRequestId), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          amountInCents: currencyToCents(data.amount),
          estimatedDurationValue: Number(data.estimatedDurationValue),
          estimatedDurationUnit: data.estimatedDurationUnit,
          message: data.message.trim(),
        }),
      });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const errorCode = parseErrorCode(payload);

        if (response.status === 409 && errorCode === "PROPOSAL_ALREADY_EXISTS") {
          setSubmissionState("already-exists");
          return;
        }

        if (
          response.status === 409 &&
          errorCode === "SERVICE_REQUEST_NOT_ACCEPTING_PROPOSALS"
        ) {
          setSubmissionState("closed");
          return;
        }

        if (response.status === 404 && errorCode === "SERVICE_REQUEST_NOT_AVAILABLE") {
          setSubmissionState("unavailable");
          return;
        }

        setSubmissionState("error");
        return;
      }

      const parsedProposal = parseProposalResponse(payload);

      if (!parsedProposal) {
        setSubmissionState("error");
        return;
      }

      setProposal(parsedProposal);
      setSubmissionState("success");
    } catch {
      setSubmissionState("error");
    } finally {
      submissionInFlightRef.current = false;
    }
  }

  if (submissionState === "success" && proposal) {
    return (
      <section aria-labelledby="proposal-success-title" className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm sm:p-7">
        <div className="flex items-start gap-3 text-emerald-950">
          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-emerald-600" />
          <div>
            <h2 id="proposal-success-title" className="text-xl font-bold">
              Proposta enviada
            </h2>
            <p className="mt-2 leading-7 text-emerald-800">
              Sua proposta foi registrada e já está disponível para o cliente.
            </p>
          </div>
        </div>
        <dl className="mt-6 grid gap-4 border-t border-emerald-200 pt-5 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-emerald-700">Valor</dt>
            <dd className="mt-1 font-bold text-emerald-950">{formatCurrency(proposal.amountInCents)}</dd>
          </div>
          <div>
            <dt className="text-sm text-emerald-700">Prazo estimado</dt>
            <dd className="mt-1 font-bold text-emerald-950">
              {proposal.estimatedDurationValue} {durationUnitLabels[proposal.estimatedDurationUnit]}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-emerald-700">Enviada em</dt>
            <dd className="mt-1 font-bold text-emerald-950">{formatDate(proposal.submittedAt)}</dd>
          </div>
        </dl>
        <div className="mt-5 border-t border-emerald-200 pt-5">
          <p className="text-sm text-emerald-700">Mensagem</p>
          <p className="mt-2 whitespace-pre-wrap leading-7 text-emerald-950">{proposal.message}</p>
        </div>
      </section>
    );
  }

  const terminalMessage =
    submissionState === "already-exists"
      ? "Você já enviou uma proposta para esta solicitação."
      : submissionState === "closed"
        ? "Esta solicitação não aceita mais propostas."
        : submissionState === "unavailable"
          ? "Esta oportunidade não está mais disponível."
          : null;

  if (terminalMessage) {
    return (
      <section role="status" className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950 shadow-sm sm:p-7">
        <h2 className="text-xl font-bold">Envio indisponível</h2>
        <p className="mt-2 leading-7 text-amber-800">{terminalMessage}</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="proposal-form-title" className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div>
        <h2 id="proposal-form-title" className="text-xl font-bold text-slate-950">
          Enviar proposta
        </h2>
        <p className="mt-2 leading-7 text-slate-600">
          Informe seu valor, prazo estimado e uma mensagem para o cliente.
        </p>
      </div>

      <form className="mt-6 space-y-5" onSubmit={handleSubmit(submitProposal)} noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="proposal-amount" className="block text-sm font-semibold text-slate-900">
              Valor da proposta
            </label>
            <input
              id="proposal-amount"
              type="text"
              inputMode="numeric"
              placeholder="R$ 0,00"
              className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              aria-invalid={Boolean(errors.amount)}
              aria-describedby={errors.amount ? "proposal-amount-error" : undefined}
              {...amountField}
              onChange={(event) => {
                setValue("amount", formatCurrencyInput(event.target.value), {
                  shouldDirty: true,
                  shouldValidate: true,
                });
              }}
            />
            {errors.amount ? <p id="proposal-amount-error" role="alert" className="mt-2 text-sm text-red-600">{errors.amount.message}</p> : null}
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] gap-3">
            <div>
              <label htmlFor="proposal-duration" className="block text-sm font-semibold text-slate-900">
                Prazo
              </label>
              <input
                id="proposal-duration"
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                aria-invalid={Boolean(errors.estimatedDurationValue)}
                aria-describedby={errors.estimatedDurationValue ? "proposal-duration-error" : undefined}
                {...register("estimatedDurationValue")}
              />
            </div>
            <div>
              <label htmlFor="proposal-duration-unit" className="block text-sm font-semibold text-slate-900">
                Unidade
              </label>
              <select
                id="proposal-duration-unit"
                className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-slate-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                {...register("estimatedDurationUnit")}
              >
                {estimatedDurationUnits.map((unit) => (
                  <option key={unit} value={unit}>{durationUnitLabels[unit]}</option>
                ))}
              </select>
            </div>
            {errors.estimatedDurationValue ? <p id="proposal-duration-error" role="alert" className="col-span-2 text-sm text-red-600">{errors.estimatedDurationValue.message}</p> : null}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="proposal-message" className="text-sm font-semibold text-slate-900">
              Mensagem
            </label>
            <span className={`text-xs ${messageLength > 2000 ? "text-red-600" : "text-slate-500"}`}>
              {messageLength}/2000
            </span>
          </div>
          <textarea
            id="proposal-message"
            rows={6}
            maxLength={2001}
            placeholder="Explique como pretende realizar o serviço e sua disponibilidade."
            className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            aria-invalid={Boolean(errors.message)}
            aria-describedby={errors.message ? "proposal-message-error" : undefined}
            {...register("message")}
          />
          {errors.message ? <p id="proposal-message-error" role="alert" className="mt-2 text-sm text-red-600">{errors.message.message}</p> : null}
        </div>

        {submissionState === "error" ? (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            Não foi possível enviar sua proposta. Revise os dados e tente novamente.
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {isSubmitting ? <Loader2 aria-hidden="true" className="size-5 animate-spin" /> : <Send aria-hidden="true" className="size-5" />}
          {isSubmitting ? "Enviando..." : "Enviar proposta"}
        </button>
      </form>
    </section>
  );
}
