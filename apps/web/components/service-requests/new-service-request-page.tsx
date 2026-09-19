"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  CircleAlert,
  CheckCircle2,
  ChevronLeft,
  ImagePlus,
  Loader2,
  MapPin,
  Send,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Controller, useForm } from "react-hook-form";

import {
  categoriesUrl,
  serviceRequestPhotosUrl,
  serviceRequestsUrl,
} from "../../lib/api";
import { useAuth } from "../auth/auth-provider";
import {
  serviceRequestSchema,
  type ServiceRequestFormData,
} from "./service-request-form-schema";
import {
  appendServiceRequestPhotos,
  MAX_SERVICE_REQUEST_PHOTOS,
  removeServiceRequestPhoto,
  SERVICE_REQUEST_PHOTO_ACCEPT,
  uploadServiceRequestPhotos,
} from "./service-request-photo-selection";

interface ServiceCategory {
  id: string;
  name: string;
}

type CategoriesState = "loading" | "success" | "empty" | "error";
type SubmissionState = "idle" | "success" | "partial" | "error";
type PostalCodeLookupState = "idle" | "loading" | "success" | "not-found" | "error";

interface SelectedPhoto {
  file: File;
  previewUrl: string;
}

interface ViaCepResponse {
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
}

const fieldClassName =
  "mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100";

function isServiceCategory(value: unknown): value is ServiceCategory {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<ServiceCategory>;

  return typeof candidate.id === "string" && typeof candidate.name === "string";
}

function isViaCepResponse(value: unknown): value is ViaCepResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<ViaCepResponse>;

  return (
    typeof candidate.logradouro === "string" &&
    typeof candidate.bairro === "string" &&
    typeof candidate.localidade === "string" &&
    typeof candidate.uf === "string"
  );
}

function isViaCepNotFound(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "erro" in value &&
    value.erro === true
  );
}

function formatPostalCode(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);

  return digits.length > 5
    ? `${digits.slice(0, 5)}-${digits.slice(5)}`
    : digits;
}

function extractErrorMessage(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const message = (payload as { message?: unknown }).message;

  if (typeof message === "string" && message.trim().length > 0) {
    return message.trim();
  }

  if (Array.isArray(message)) {
    const firstMessage = message.find(
      (item): item is string =>
        typeof item === "string" && item.trim().length > 0,
    );

    return firstMessage?.trim() ?? null;
  }

  return null;
}

function extractServiceRequestId(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const id = (payload as { id?: unknown }).id;

  return typeof id === "string" && id.length > 0 ? id : null;
}

interface FieldErrorProps {
  id: string;
  message?: string;
}

function FieldError({ id, message }: FieldErrorProps) {
  if (!message) {
    return null;
  }

  return (
    <p id={id} role="alert" className="mt-2 text-sm font-medium text-red-600">
      {message}
    </p>
  );
}

export function NewServiceRequestPage() {
  const { accessToken, isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [categoriesState, setCategoriesState] =
    useState<CategoriesState>("loading");
  const [categoriesReloadKey, setCategoriesReloadKey] = useState(0);
  const [submissionState, setSubmissionState] =
    useState<SubmissionState>("idle");
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [submissionProgress, setSubmissionProgress] = useState<string | null>(
    null,
  );
  const [isPublishing, setIsPublishing] = useState(false);
  const [reviewData, setReviewData] = useState<ServiceRequestFormData | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<SelectedPhoto[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [postalCodeLookupState, setPostalCodeLookupState] =
    useState<PostalCodeLookupState>("idle");
  const selectedPhotosRef = useRef<SelectedPhoto[]>([]);
  const isPublishingRef = useRef(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const lastLookedUpPostalCodeRef = useRef<string | null>(null);
  const postalCodeAbortControllerRef = useRef<AbortController | null>(null);

  const isCustomer = Boolean(user?.roles.includes("CUSTOMER"));

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    setValue,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<ServiceRequestFormData>({
    resolver: zodResolver(serviceRequestSchema),
    defaultValues: {
      visibleProposalLimit: 3,
      categoryId: "",
      title: "",
      description: "",
      location: {
        country: "BR",
        state: "",
        city: "",
        neighborhood: "",
        postalCode: "",
        addressLine: "",
        addressNumber: "",
        addressComplement: "",
      },
    },
    mode: "onSubmit",
  });

  useEffect(() => {
    if (!isAuthenticated || !isCustomer) {
      return;
    }

    const abortController = new AbortController();

    async function loadCategories(): Promise<void> {
      setCategoriesState("loading");

      try {
        const response = await fetch(categoriesUrl, {
          signal: abortController.signal,
          cache: "no-store",
        });

        if (!response.ok) {
          setCategories([]);
          setCategoriesState("error");
          return;
        }

        const payload: unknown = await response.json();

        if (!Array.isArray(payload)) {
          setCategories([]);
          setCategoriesState("error");
          return;
        }

        const parsedCategories = payload.filter(isServiceCategory);

        setCategories(parsedCategories);
        setCategoriesState(parsedCategories.length > 0 ? "success" : "empty");
      } catch {
        if (!abortController.signal.aborted) {
          setCategories([]);
          setCategoriesState("error");
        }
      }
    }

    void loadCategories();

    return () => abortController.abort();
  }, [categoriesReloadKey, isAuthenticated, isCustomer]);

  useEffect(() => {
    return () => postalCodeAbortControllerRef.current?.abort();
  }, []);

  useEffect(() => {
    selectedPhotosRef.current = selectedPhotos;
  }, [selectedPhotos]);

  useEffect(() => {
    return () => {
      selectedPhotosRef.current.forEach((photo) => {
        URL.revokeObjectURL(photo.previewUrl);
      });
    };
  }, []);

  async function lookupPostalCode(postalCode: string): Promise<void> {
    if (lastLookedUpPostalCodeRef.current === postalCode) {
      return;
    }

    lastLookedUpPostalCodeRef.current = postalCode;
    postalCodeAbortControllerRef.current?.abort();

    const abortController = new AbortController();
    postalCodeAbortControllerRef.current = abortController;
    setPostalCodeLookupState("loading");

    try {
      const response = await fetch(`https://viacep.com.br/ws/${postalCode}/json/`, {
        signal: abortController.signal,
        cache: "no-store",
      });

      if (!response.ok) {
        setPostalCodeLookupState("error");
        return;
      }

      const payload: unknown = await response.json();

      if (isViaCepNotFound(payload)) {
        setPostalCodeLookupState("not-found");
        return;
      }

      if (!isViaCepResponse(payload)) {
        setPostalCodeLookupState("error");
        return;
      }

      if (payload.logradouro) {
        setValue("location.addressLine", payload.logradouro, {
          shouldDirty: true,
        });
      }

      if (payload.bairro) {
        setValue("location.neighborhood", payload.bairro, {
          shouldDirty: true,
        });
      }

      if (payload.localidade) {
        setValue("location.city", payload.localidade, {
          shouldDirty: true,
        });
      }

      if (payload.uf) {
        setValue("location.state", payload.uf, {
          shouldDirty: true,
        });
      }

      clearErrors([
        "location.addressLine",
        "location.neighborhood",
        "location.city",
        "location.state",
      ]);
      setPostalCodeLookupState("success");
    } catch {
      if (!abortController.signal.aborted) {
        setPostalCodeLookupState("error");
      }
    }
  }

  function handlePostalCodeChange(event: ChangeEvent<HTMLInputElement>): void {
    const digits = event.target.value.replace(/\D/g, "").slice(0, 8);

    setValue("location.postalCode", formatPostalCode(digits), {
      shouldDirty: true,
    });

    if (digits.length !== 8) {
      postalCodeAbortControllerRef.current?.abort();
      setPostalCodeLookupState("idle");
      return;
    }

    void lookupPostalCode(digits);
  }

  function handlePhotoSelection(event: ChangeEvent<HTMLInputElement>): void {
    const selectedFiles = Array.from(event.target.files ?? []);

    setSelectedPhotos((currentPhotos) => {
      const currentFiles = currentPhotos.map((photo) => photo.file);
      const result = appendServiceRequestPhotos(currentFiles, selectedFiles);
      const currentPhotoByFile = new Map(
        currentPhotos.map((photo) => [photo.file, photo]),
      );

      setPhotoError(result.errorMessage);

      return result.photos.map(
        (file) =>
          currentPhotoByFile.get(file) ?? {
            file,
            previewUrl: URL.createObjectURL(file),
          },
      );
    });

    event.target.value = "";
  }

  function handlePhotoRemoval(photoIndex: number): void {
    setSelectedPhotos((currentPhotos) => {
      const removedPhoto = currentPhotos[photoIndex];

      if (removedPhoto) {
        URL.revokeObjectURL(removedPhoto.previewUrl);
      }

      const remainingFiles = removeServiceRequestPhoto(
        currentPhotos.map((photo) => photo.file),
        photoIndex,
      );
      const currentPhotoByFile = new Map(
        currentPhotos.map((photo) => [photo.file, photo]),
      );

      return remainingFiles.flatMap((file) => {
        const photo = currentPhotoByFile.get(file);
        return photo ? [photo] : [];
      });
    });
    setPhotoError(null);
  }

  function clearSelectedPhotos(): void {
    setSelectedPhotos((currentPhotos) => {
      currentPhotos.forEach((photo) => {
        URL.revokeObjectURL(photo.previewUrl);
      });
      return [];
    });
    setPhotoError(null);

    if (photoInputRef.current) {
      photoInputRef.current.value = "";
    }
  }

  function openReview(data: ServiceRequestFormData): void {
    const selectedCategoryIsAvailable = categories.some(
      (category) => category.id === data.categoryId,
    );

    if (!selectedCategoryIsAvailable) {
      setError("categoryId", {
        type: "manual",
        message: "Selecione uma categoria disponível.",
      });
      return;
    }

    setFormMessage(null);
    setReviewData(data);
  }

  async function submitServiceRequest(data: ServiceRequestFormData): Promise<void> {
    if (!accessToken || isSubmitting || isPublishingRef.current) {
      return;
    }

    const selectedCategoryIsAvailable = categories.some(
      (category) => category.id === data.categoryId,
    );

    if (!selectedCategoryIsAvailable) {
      setError("categoryId", {
        type: "manual",
        message: "Selecione uma categoria disponível.",
      });
      return;
    }

    setSubmissionState("idle");
    setFormMessage(null);
    setSubmissionProgress("Salvando solicitação...");
    isPublishingRef.current = true;
    setIsPublishing(true);

    const description = data.description.trim();
    const addressComplement = data.location.addressComplement.trim();
    const photosToUpload = selectedPhotos.map((photo) => photo.file);

    try {
      const response = await fetch(serviceRequestsUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          visibleProposalLimit: data.visibleProposalLimit,
          categoryId: data.categoryId,
          title: data.title,
          ...(description ? { description } : {}),
          location: {
            country: "BR",
            state: data.location.state.toUpperCase(),
            city: data.location.city,
            neighborhood: data.location.neighborhood,
            postalCode: data.location.postalCode,
            addressLine: data.location.addressLine,
            addressNumber: data.location.addressNumber,
            ...(addressComplement ? { addressComplement } : {}),
          },
        }),
      });

      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const backendMessage = extractErrorMessage(payload);
        const fallbackMessage =
          response.status === 401
            ? "Sua sessão expirou. Entre novamente para continuar."
            : response.status === 403
              ? "Sua conta não possui permissão para criar solicitações."
              : "Não foi possível salvar a solicitação. Tente novamente.";

        setSubmissionState("error");
        setFormMessage(backendMessage ?? fallbackMessage);
        setSubmissionProgress(null);
        return;
      }

      const serviceRequestId = extractServiceRequestId(payload);
      if (!serviceRequestId) {
        setSubmissionState("error");
        setFormMessage("A solicitação foi publicada, mas não foi possível abrir os detalhes.");
        setSubmissionProgress(null);
        return;
      }
      let failedUploads = 0;

      if (photosToUpload.length > 0) {
        failedUploads = await uploadServiceRequestPhotos(
          photosToUpload,
          async (photo) => {
            const formData = new FormData();
            formData.append("file", photo);

            const photoResponse = await fetch(
              serviceRequestPhotosUrl(serviceRequestId),
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
                credentials: "include",
                body: formData,
              },
            );

            if (!photoResponse.ok) {
              throw new Error("Photo upload failed");
            }
          },
          (current, total) => {
            setSubmissionProgress(`Enviando foto ${current} de ${total}...`);
          },
        );
      }

      if (failedUploads > 0) {
        setSubmissionState("partial");
        setFormMessage(
          "A solicitação foi publicada, mas algumas fotos não puderam ser enviadas.",
        );
      } else {
        router.push(`/solicitacoes/${encodeURIComponent(serviceRequestId)}`);
        return;
      }

      setSubmissionProgress(null);
      reset();
      setReviewData(null);
      clearSelectedPhotos();
      setPostalCodeLookupState("idle");
      lastLookedUpPostalCodeRef.current = null;
    } catch {
      setSubmissionState("error");
      setSubmissionProgress(null);
      setFormMessage(
        "Não foi possível conectar à Soravi. Tente novamente em instantes.",
      );
    } finally {
      isPublishingRef.current = false;
      setIsPublishing(false);
    }
  }

  const hasPostalCodeLookupFeedback =
    postalCodeLookupState === "loading" ||
    postalCodeLookupState === "not-found" ||
    postalCodeLookupState === "error";
  const postalCodeDescribedBy = [
    errors.location?.postalCode ? "postalCode-error" : null,
    hasPostalCodeLookupFeedback ? "postalCode-lookup-feedback" : null,
  ]
    .filter(Boolean)
    .join(" ") || undefined;

  if (isLoading) {
    return (
      <main className="bg-slate-50">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <p className="flex items-center gap-3 text-slate-700" aria-live="polite">
            <Loader2 aria-hidden="true" className="size-5 animate-spin" />
            Carregando sua conta...
          </p>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="bg-slate-50">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 sm:p-8">
            <h1 className="text-2xl font-bold text-amber-950">Entre para criar uma solicitação</h1>
            <p className="mt-3 leading-7 text-amber-900/80">
              A nova solicitação fica vinculada à sua conta de cliente.
            </p>
            <Link href="/entrar" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
              Entrar
            </Link>
          </section>
        </div>
      </main>
    );
  }

  if (!isCustomer) {
    return (
      <main className="bg-slate-50">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <section role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 sm:p-8">
            <h1 className="text-2xl font-bold text-red-950">Acesso exclusivo para clientes</h1>
            <p className="mt-3 leading-7 text-red-900/80">
              Esta página requer uma conta com perfil de cliente.
            </p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
          <ChevronLeft aria-hidden="true" className="size-4" />
          Voltar
        </Link>

        <header className="mt-6">
          <p className="font-semibold text-blue-600">Solicitação de serviço</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Nova solicitação
          </h1>
          <p className="mt-3 max-w-2xl leading-7 text-slate-600">
            Descreva o que você precisa, revise os dados e publique quando estiver pronto.
          </p>
        </header>

        {!reviewData ? <form onSubmit={handleSubmit(openReview)} noValidate className="mt-8 space-y-8">
          <section aria-labelledby="request-details-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <h2 id="request-details-title" className="text-xl font-bold text-slate-950">O que você precisa?</h2>

            <div className="mt-6">
              <label htmlFor="categoryId" className="text-sm font-semibold text-slate-800">Categoria</label>
              <select id="categoryId" disabled={categoriesState !== "success" || isSubmitting} aria-invalid={Boolean(errors.categoryId)} aria-describedby={errors.categoryId ? "categoryId-error" : undefined} className={fieldClassName} {...register("categoryId")}>
                <option value="">
                  {categoriesState === "loading" ? "Carregando categorias..." : "Selecione uma categoria"}
                </option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
              <FieldError id="categoryId-error" message={errors.categoryId?.message} />
              <fieldset className="mt-6">
                <legend className="text-sm font-semibold text-slate-800">Quantas propostas você deseja receber?</legend>
                <p className="mt-1 text-sm text-slate-600">Escolha quantas propostas deseja comparar para esta solicitação.</p>
                <Controller
                  control={control}
                  name="visibleProposalLimit"
                  render={({ field }) => (
                    <div className="mt-3 flex gap-3">
                      {[3, 5, 10].map((limit) => (
                        <label key={limit} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium">
                          <input
                            type="radio"
                            value={limit}
                            checked={field.value === limit}
                            onChange={() => field.onChange(limit)}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                          />
                          {limit} propostas
                        </label>
                      ))}
                    </div>
                  )}
                />
              </fieldset>
              {categoriesState === "error" ? (
                <div className="mt-3 flex flex-wrap items-center gap-3" role="alert">
                  <p className="text-sm font-medium text-red-600">Não foi possível carregar as categorias.</p>
                  <button type="button" onClick={() => setCategoriesReloadKey((value) => value + 1)} className="text-sm font-semibold text-blue-600 underline underline-offset-4">Tentar novamente</button>
                </div>
              ) : null}
              {categoriesState === "empty" ? <p className="mt-2 text-sm text-amber-700" role="status">Nenhuma categoria está disponível no momento.</p> : null}
            </div>

            <div className="mt-5">
              <label htmlFor="title" className="text-sm font-semibold text-slate-800">Título</label>
              <input id="title" type="text" maxLength={160} placeholder="Ex.: Instalação de tomada na sala" disabled={isSubmitting} aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? "title-error" : undefined} className={fieldClassName} {...register("title")} />
              <FieldError id="title-error" message={errors.title?.message} />
            </div>

            <div className="mt-5">
              <label htmlFor="description" className="text-sm font-semibold text-slate-800">Descrição <span className="font-normal text-slate-500">(opcional)</span></label>
              <textarea id="description" rows={5} maxLength={2000} placeholder="Conte os detalhes que ajudam a entender o serviço" disabled={isSubmitting} aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? "description-error" : undefined} className={fieldClassName} {...register("description")} />
              <FieldError id="description-error" message={errors.description?.message} />
            </div>

            <div className="mt-6 border-t border-slate-200 pt-6">
              <div className="flex items-start gap-3">
                <ImagePlus aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-blue-600" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <label htmlFor="service-request-photos" className="font-semibold text-slate-900">
                      Fotos do problema <span className="font-normal text-slate-500">(opcional)</span>
                    </label>
                    <span className="text-sm font-medium text-slate-500">
                      {selectedPhotos.length} de {MAX_SERVICE_REQUEST_PHOTOS} fotos
                    </span>
                  </div>
                  <p id="service-request-photos-help" className="mt-1 text-sm leading-6 text-slate-600">
                    Adicione fotos que ajudem o profissional a entender melhor o serviço.
                  </p>
                </div>
              </div>

              <input
                ref={photoInputRef}
                id="service-request-photos"
                type="file"
                multiple
                accept={SERVICE_REQUEST_PHOTO_ACCEPT}
                disabled={isSubmitting || selectedPhotos.length >= MAX_SERVICE_REQUEST_PHOTOS}
                aria-describedby={`service-request-photos-help${photoError ? " service-request-photos-error" : ""}`}
                onChange={handlePhotoSelection}
                className="mt-4 block w-full cursor-pointer rounded-xl border border-slate-300 bg-white text-sm text-slate-600 file:mr-4 file:min-h-12 file:cursor-pointer file:border-0 file:border-r file:border-slate-200 file:bg-slate-50 file:px-4 file:py-3 file:font-semibold file:text-blue-700 hover:file:bg-blue-50 disabled:cursor-not-allowed disabled:bg-slate-100"
              />

              {photoError ? (
                <p id="service-request-photos-error" role="alert" className="mt-2 text-sm font-medium text-red-600">
                  {photoError}
                </p>
              ) : null}

              {selectedPhotos.length > 0 ? (
                <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Fotos selecionadas">
                  {selectedPhotos.map((photo, photoIndex) => (
                    <li key={photo.previewUrl} className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                        <Image
                          src={photo.previewUrl}
                          alt={`Prévia de ${photo.file.name}`}
                          fill
                          unoptimized
                          className="object-cover"
                        />
                        <button
                          type="button"
                          title="Remover foto"
                          aria-label={`Remover ${photo.file.name}`}
                          disabled={isSubmitting}
                          onClick={() => handlePhotoRemoval(photoIndex)}
                          className="absolute right-2 top-2 inline-flex size-9 items-center justify-center rounded-full bg-slate-950/80 text-white transition hover:bg-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <X aria-hidden="true" className="size-4" />
                        </button>
                      </div>
                      <div className="p-2.5">
                        <p className="truncate text-xs font-medium text-slate-700" title={photo.file.name}>
                          {photo.file.name}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </section>

          <fieldset disabled={isSubmitting} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <legend className="sr-only">Localização do serviço</legend>
            <div className="flex items-start gap-3">
              <MapPin aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-blue-600" />
              <div>
                <h2 className="text-xl font-bold text-slate-950">Onde o serviço será realizado?</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">Informe o endereço do local do serviço.</p>
              </div>
            </div>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="country" className="text-sm font-semibold text-slate-800">País</label>
                <input id="country" type="text" readOnly className={fieldClassName} {...register("location.country")} />
              </div>
              <div>
                <label htmlFor="state" className="text-sm font-semibold text-slate-800">Estado (UF)</label>
                <input id="state" type="text" maxLength={2} autoCapitalize="characters" placeholder="SP" aria-invalid={Boolean(errors.location?.state)} aria-describedby={errors.location?.state ? "state-error" : undefined} className={fieldClassName} {...register("location.state")} />
                <FieldError id="state-error" message={errors.location?.state?.message} />
              </div>
              <div>
                <label htmlFor="city" className="text-sm font-semibold text-slate-800">Cidade</label>
                <input id="city" type="text" maxLength={120} autoComplete="address-level2" aria-invalid={Boolean(errors.location?.city)} aria-describedby={errors.location?.city ? "city-error" : undefined} className={fieldClassName} {...register("location.city")} />
                <FieldError id="city-error" message={errors.location?.city?.message} />
              </div>
              <div>
                <label htmlFor="neighborhood" className="text-sm font-semibold text-slate-800">Bairro</label>
                <input id="neighborhood" type="text" maxLength={120} aria-invalid={Boolean(errors.location?.neighborhood)} aria-describedby={errors.location?.neighborhood ? "neighborhood-error" : undefined} className={fieldClassName} {...register("location.neighborhood")} />
                <FieldError id="neighborhood-error" message={errors.location?.neighborhood?.message} />
              </div>
              <div>
                <label htmlFor="postalCode" className="text-sm font-semibold text-slate-800">CEP</label>
                <input id="postalCode" type="text" maxLength={9} inputMode="numeric" autoComplete="postal-code" aria-invalid={Boolean(errors.location?.postalCode)} aria-describedby={postalCodeDescribedBy} className={fieldClassName} {...register("location.postalCode")} onChange={handlePostalCodeChange} />
                <FieldError id="postalCode-error" message={errors.location?.postalCode?.message} />
                {postalCodeLookupState === "loading" ? (
                  <p id="postalCode-lookup-feedback" role="status" className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                    <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                    Buscando endereço...
                  </p>
                ) : null}
                {postalCodeLookupState === "not-found" ? (
                  <p id="postalCode-lookup-feedback" role="alert" className="mt-2 text-sm font-medium text-amber-700">
                    CEP não encontrado. Confira o número ou preencha o endereço manualmente.
                  </p>
                ) : null}
                {postalCodeLookupState === "error" ? (
                  <p id="postalCode-lookup-feedback" role="status" className="mt-2 text-sm text-slate-600">
                    Não foi possível buscar o CEP agora. Continue preenchendo o endereço manualmente.
                  </p>
                ) : null}
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="addressLine" className="text-sm font-semibold text-slate-800">Endereço</label>
                <input id="addressLine" type="text" maxLength={255} autoComplete="address-line1" placeholder="Rua, avenida ou travessa" aria-invalid={Boolean(errors.location?.addressLine)} aria-describedby={errors.location?.addressLine ? "addressLine-error" : undefined} className={fieldClassName} {...register("location.addressLine")} />
                <FieldError id="addressLine-error" message={errors.location?.addressLine?.message} />
              </div>
              <div>
                <label htmlFor="addressNumber" className="text-sm font-semibold text-slate-800">Número</label>
                <input id="addressNumber" type="text" maxLength={32} aria-invalid={Boolean(errors.location?.addressNumber)} aria-describedby={errors.location?.addressNumber ? "addressNumber-error" : undefined} className={fieldClassName} {...register("location.addressNumber")} />
                <FieldError id="addressNumber-error" message={errors.location?.addressNumber?.message} />
              </div>
              <div>
                <label htmlFor="addressComplement" className="text-sm font-semibold text-slate-800">Complemento <span className="font-normal text-slate-500">(opcional)</span></label>
                <input id="addressComplement" type="text" maxLength={255} autoComplete="address-line2" aria-invalid={Boolean(errors.location?.addressComplement)} aria-describedby={errors.location?.addressComplement ? "addressComplement-error" : undefined} className={fieldClassName} {...register("location.addressComplement")} />
                <FieldError id="addressComplement-error" message={errors.location?.addressComplement?.message} />
              </div>
            </div>
          </fieldset>

          {formMessage ? (
            <div role={submissionState === "success" ? "status" : "alert"} className={`flex items-start gap-3 rounded-xl border p-4 ${submissionState === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : submissionState === "partial" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-red-200 bg-red-50 text-red-800"}`}>
              {submissionState === "success" ? <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0" /> : null}
              {submissionState === "partial" ? <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" /> : null}
              <p className="font-medium leading-6">{formMessage}</p>
            </div>
          ) : null}

          {submissionProgress ? (
            <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              {submissionProgress}
            </p>
          ) : null}

          <button type="submit" disabled={isSubmitting || categoriesState !== "success"} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto">
            {isSubmitting ? <Loader2 aria-hidden="true" className="size-5 animate-spin" /> : <Send aria-hidden="true" className="size-5" />}
            {isSubmitting ? "Processando..." : "Revisar solicitação"}
          </button>
        </form> : (
          <section className="mt-8 space-y-6" aria-labelledby="review-service-request-title">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <p className="font-semibold text-blue-600">Revise antes de publicar</p>
              <h2 id="review-service-request-title" className="mt-2 text-2xl font-bold text-slate-950">Confira sua solicitação</h2>
              <dl className="mt-6 space-y-5 text-slate-700">
                <div><dt className="text-sm font-semibold text-slate-500">Categoria</dt><dd className="mt-1 font-medium text-slate-950">{categories.find((category) => category.id === reviewData.categoryId)?.name ?? "Categoria selecionada"}</dd></div>
                <div><dt className="text-sm font-semibold text-slate-500">Quantidade de propostas</dt><dd className="mt-1 font-medium text-slate-950">Até {reviewData.visibleProposalLimit} propostas</dd></div>
                <div><dt className="text-sm font-semibold text-slate-500">Título</dt><dd className="mt-1 font-medium text-slate-950">{reviewData.title}</dd></div>
                {reviewData.description.trim() ? <div><dt className="text-sm font-semibold text-slate-500">Descrição</dt><dd className="mt-1 whitespace-pre-wrap">{reviewData.description}</dd></div> : null}
                <div><dt className="text-sm font-semibold text-slate-500">Localização</dt><dd className="mt-1">{reviewData.location.addressLine}, {reviewData.location.addressNumber}{reviewData.location.addressComplement ? ` - ${reviewData.location.addressComplement}` : ""}<br />{reviewData.location.neighborhood}, {reviewData.location.city} - {reviewData.location.state}<br />CEP {reviewData.location.postalCode}</dd></div>
                <div><dt className="text-sm font-semibold text-slate-500">Fotos</dt><dd className="mt-1">{selectedPhotos.length === 0 ? "Nenhuma foto adicionada" : `${selectedPhotos.length} ${selectedPhotos.length === 1 ? "foto adicionada" : "fotos adicionadas"}`}</dd></div>
              </dl>
              {selectedPhotos.length > 0 ? <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">{selectedPhotos.map((photo) => <div key={photo.previewUrl} className="relative aspect-[4/3] overflow-hidden rounded-lg border border-slate-200"><Image src={photo.previewUrl} alt={`Prévia de ${photo.file.name}`} fill unoptimized className="object-cover" /></div>)}</div> : null}
            </div>
            {formMessage ? <div role={submissionState === "success" ? "status" : "alert"} className={`rounded-xl border p-4 font-medium ${submissionState === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : submissionState === "partial" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-red-200 bg-red-50 text-red-800"}`}>{formMessage}</div> : null}
            {submissionProgress ? <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm font-medium text-slate-700"><Loader2 aria-hidden="true" className="size-4 animate-spin" />{submissionProgress}</p> : null}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" disabled={isSubmitting || isPublishing} onClick={() => setReviewData(null)} className="inline-flex min-h-12 items-center justify-center px-5 py-3 font-semibold text-slate-700 hover:text-slate-950 disabled:opacity-50">Voltar e editar</button>
              <button type="button" disabled={isSubmitting || isPublishing} onClick={() => void submitServiceRequest(reviewData)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400">{isSubmitting || isPublishing ? <Loader2 aria-hidden="true" className="size-5 animate-spin" /> : <Send aria-hidden="true" className="size-5" />}{isSubmitting || isPublishing ? "Enviando..." : "Enviar solicitação"}</button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
