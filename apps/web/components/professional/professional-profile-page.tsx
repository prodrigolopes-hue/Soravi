"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, BriefcaseBusiness, LoaderCircle, MapPin, Save, ShieldCheck, Trash2, Upload, UserRound } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";

import { categoriesUrl, currentProfessionalProfilePhotoUrl, currentProfessionalProfileUrl, professionalVerificationSubmissionUrl } from "../../lib/api";
import { PersonalIdentityCollection } from "./personal-identity-collection";
import { ProfessionalIdentityDocumentUpload } from "./professional-identity-document-upload";
import { ProfessionalContactVerification } from "./professional-contact-verification";
import {
  type ProfessionalCategory,
  type ProfessionalProfile,
  parseProfessionalCategories,
  parseProfessionalProfile,
} from "../../lib/professional-profile";
import { z } from "../../lib/zod";
import { useAuth } from "../auth/auth-provider";
import { ProfessionalAvatar } from "./professional-avatar";

const profileFormSchema = z.object({
  displayName: z.string().trim().min(2, "Informe um nome público com pelo menos 2 caracteres.").max(120, "Use no máximo 120 caracteres."),
  professionalTitle: z.string().trim().max(80, "Use no máximo 80 caracteres."),
  serviceArea: z.string().trim().max(100, "Use no máximo 100 caracteres."),
  bio: z.string().trim().max(1000, "Use no máximo 1000 caracteres."),
  categorySlugs: z.array(z.string()).min(1, "Selecione pelo menos uma categoria.").max(3, "Selecione no máximo três categorias.").refine((values) => new Set(values).size === values.length, "Não selecione categorias duplicadas."),
  isAvailable: z.boolean(),
});

type ProfileFormData = z.infer<typeof profileFormSchema>;
type LoadState = "loading" | "ready" | "error";

const emptyForm: ProfileFormData = {
  displayName: "",
  professionalTitle: "",
  serviceArea: "",
  bio: "",
  categorySlugs: [],
  isAvailable: true,
};

const verificationLabels = {
  NOT_STARTED: "Não iniciada",
  PENDING: "Em análise",
  APPROVED: "Aprovado",
  REJECTED: "Não aprovado",
} as const;

const verificationStyles = {
  NOT_STARTED: "border-slate-200 bg-slate-100 text-slate-700",
  PENDING: "border-amber-200 bg-amber-50 text-amber-800",
  APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  REJECTED: "border-red-200 bg-red-50 text-red-800",
} as const;

export function ProfessionalProfilePage() {
  const { accessToken, isAuthenticated, isLoading, user, refreshSession } = useAuth();
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadMessage, setLoadMessage] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null);
  const [categories, setCategories] = useState<ProfessionalCategory[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSubmittingVerification, setIsSubmittingVerification] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submissionMessage, setSubmissionMessage] = useState<string | null>(null);
  const [isReadyToResubmit, setIsReadyToResubmit] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [isPhotoMutating, setIsPhotoMutating] = useState(false);
  const [photoMessage, setPhotoMessage] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const mountedRef = useRef(false);
  const activeSessionRef = useRef("");
  const photoQueryRef = useRef<AbortController | null>(null);
  const photoMutationRef = useRef(false);
  const photoConfirmationRequiredRef = useRef(false);
  const photoOperationRef = useRef(0);
  const sessionId = `${user?.id ?? "anonymous"}:${accessToken ?? ""}`;
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: emptyForm,
  });

  const selectedCategories = watch("categorySlugs");
  const bioLength = watch("bio").length;
  const isProfessional = Boolean(user?.roles.includes("PROFESSIONAL"));

  const loadProfile = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    const requestToken = accessToken;

    setLoadState("loading");
    setLoadMessage(null);

    try {
      const [profileResponse, categoriesResponse] = await Promise.all([
        fetch(currentProfessionalProfileUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
          credentials: "include",
          cache: "no-store",
        }),
        fetch(categoriesUrl, { cache: "no-store" }),
      ]);

      if (profileResponse.status === 401) {
        throw new Error("Sua sessão expirou. Entre novamente para continuar.");
      }
      if (profileResponse.status === 403) {
        throw new Error("Sua conta não possui permissão para editar um perfil profissional.");
      }
      if (!profileResponse.ok || !categoriesResponse.ok) {
        throw new Error("Não foi possível carregar seu perfil agora. Tente novamente.");
      }

      const parsedProfile = parseProfessionalProfile(
        await profileResponse.json().catch(() => null),
      );
      const parsedCategories = parseProfessionalCategories(
        await categoriesResponse.json().catch(() => null),
      );

      if (!mountedRef.current || activeSessionRef.current !== `${user?.id ?? "anonymous"}:${requestToken}`) {
        return;
      }

      if (!parsedProfile || !parsedCategories) {
        throw new Error("Não foi possível carregar seu perfil agora. Tente novamente.");
      }

      setProfile(parsedProfile);
      setCategories(mergeProfileCategories(parsedCategories, parsedProfile.categories));
      reset(formValuesFromProfile(parsedProfile));
      setIsEditing(false);
      setLoadState("ready");
    } catch (error) {
      if (!mountedRef.current || activeSessionRef.current !== `${user?.id ?? "anonymous"}:${requestToken}`) {
        return;
      }
      setLoadState("error");
      setLoadMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar seu perfil agora. Tente novamente.",
      );
    }
  }, [accessToken, reset, user?.id]);

  useEffect(() => {
    if (isAuthenticated && isProfessional && accessToken) {
      void loadProfile();
    }
  }, [accessToken, isAuthenticated, isProfessional, loadProfile]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      photoQueryRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    activeSessionRef.current = sessionId;
    photoQueryRef.current?.abort();
    photoMutationRef.current = false;
    photoConfirmationRequiredRef.current = false;
    setIsPhotoMutating(false);
    setPhotoFile(null);
    setPhotoMessage(null);
    setPhotoError(null);
  }, [sessionId]);

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  useEffect(() => {
    setPhotoFile(null); setPhotoMessage(null); setPhotoError(null);
    if (previewUrlRef.current) { URL.revokeObjectURL(previewUrlRef.current); previewUrlRef.current = null; }
    setPhotoPreviewUrl(null);
  }, [accessToken]);

  const categoryOptions = useMemo(
    () => categories.filter((category, index, values) =>
      values.findIndex((candidate) => candidate.slug === category.slug) === index,
    ),
    [categories],
  );

  async function saveProfile(data: ProfileFormData): Promise<void> {
    if (!accessToken || !profile || isSaving) {
      return;
    }

    const payload = toPayload(data);

    if (hasSameValues(profile, payload)) {
      setSaveError(null);
      setSaveMessage("Nenhuma alteração para salvar.");
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveMessage(null);

    try {
      const response = await fetch(currentProfessionalProfileUrl, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        throw new Error("Sua sessão expirou. Entre novamente para continuar.");
      }
      if (response.status === 403) {
        throw new Error("Sua conta não possui permissão para editar este perfil.");
      }
      if (!response.ok) {
        throw new Error("Não foi possível salvar seu perfil agora. Revise os dados e tente novamente.");
      }

      const updatedProfile = parseProfessionalProfile(
        await response.json().catch(() => null),
      );

      if (!updatedProfile) {
        throw new Error("Não foi possível confirmar as alterações salvas. Tente novamente.");
      }

      setProfile(updatedProfile);
      setCategories((current) => mergeProfileCategories(current, updatedProfile.categories));
      reset(formValuesFromProfile(updatedProfile));
      setSaveMessage("Perfil profissional atualizado com sucesso.");
      if (updatedProfile.verificationStatus === "REJECTED") { setSaveMessage("Perfil atualizado com sucesso. Agora você pode reenviá-lo para análise."); setIsReadyToResubmit(true); }
      setIsEditing(false);
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar seu perfil agora. Tente novamente.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function submitForVerification(): Promise<void> {
    if (!accessToken || !profile || !["NOT_STARTED", "REJECTED"].includes(profile.verificationStatus) || isSubmittingVerification) return;
    setIsSubmittingVerification(true); setSubmissionError(null); setSubmissionMessage(null);
    try {
      const response = await fetch(professionalVerificationSubmissionUrl, { method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, credentials: "include" });
      if (!response.ok) { const payload: unknown = await response.json().catch(() => null); throw new Error(typeof payload === "object" && payload !== null && "message" in payload && typeof payload.message === "string" ? payload.message : "Não foi possível enviar seu perfil agora."); }
      await refreshSession(); await loadProfile(); setSubmissionMessage("Perfil enviado para análise. O próximo passo é aguardar a revisão da Soravi.");
    } catch (error) { setSubmissionError(error instanceof Error ? error.message : "Não foi possível enviar seu perfil agora."); } finally { setIsSubmittingVerification(false); }
  }

  function toggleCategory(slug: string): void {
    const isSelected = selectedCategories.includes(slug);
    const nextCategories = isSelected
      ? selectedCategories.filter((value) => value !== slug)
      : [...selectedCategories, slug];

    if (nextCategories.length > 3) {
      return;
    }

    setValue("categorySlugs", nextCategories, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setSaveMessage(null);
  }

  function startEditing(): void {
    if (!profile) {
      return;
    }

    setSaveError(null);
    setSaveMessage(null);
    reset(formValuesFromProfile(profile));
    setIsEditing(true);
  }

  function cancelEditing(): void {
    if (isSaving || !profile) {
      return;
    }

    reset(formValuesFromProfile(profile));
    setSaveError(null);
    setSaveMessage(null);
    setIsEditing(false);
  }

  function selectPhoto(file: File | undefined): void {
    setPhotoError(null); setPhotoMessage(null);
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null; setPhotoPreviewUrl(null); setPhotoFile(null);
      setPhotoError(file.size > 5 * 1024 * 1024 ? "A foto deve ter no máximo 5 MiB." : "Selecione uma imagem JPEG, PNG ou WebP.");
      return;
    }
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const preview = URL.createObjectURL(file);
    previewUrlRef.current = preview;
    setPhotoPreviewUrl(preview); setPhotoFile(file);
  }

  async function refreshPhotoState(expectedSession: string, clearSelection = false): Promise<boolean> {
    if (!accessToken || activeSessionRef.current !== expectedSession) return false;
    if (photoMutationRef.current) return false;
    photoQueryRef.current?.abort();
    const controller = new AbortController(); photoQueryRef.current = controller;
    try {
      const response = await fetch(currentProfessionalProfileUrl, { headers: { Authorization: `Bearer ${accessToken}` }, credentials: "include", cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("photo-state-unavailable");
      const parsed = parseProfessionalProfile(await response.json().catch(() => null));
      if (controller.signal.aborted || !mountedRef.current || activeSessionRef.current !== expectedSession) return false;
      if (!parsed) throw new Error("photo-state-invalid");
      setProfile((current) => current ? { ...current, photo: parsed.photo } : current);
      if (clearSelection) {
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null; setPhotoPreviewUrl(null); setPhotoFile(null);
      }
      return true;
    } catch {
      if (controller.signal.aborted) return false;
      return false;
    }
  }

  async function savePhoto(): Promise<void> {
    if (!accessToken || !photoFile || isPhotoMutating || photoMutationRef.current || photoConfirmationRequiredRef.current) return;
    const mutationSession = sessionId;
    const operation = ++photoOperationRef.current;
    const controller = new AbortController(); photoMutationRef.current = true;
    setIsPhotoMutating(true); setPhotoError(null); setPhotoMessage(null);
    let mutationError: string | null = null;
    try {
      const body = new FormData(); body.append("photo", photoFile);
      const response = await fetch(currentProfessionalProfilePhotoUrl, { method: "PUT", headers: { Authorization: `Bearer ${accessToken}` }, credentials: "include", body, signal: controller.signal });
      if (!response.ok) throw new Error(photoErrorMessage(response.status));
      const payload: unknown = await response.json().catch(() => null);
      if (!isRecordedPhotoMutation(payload)) throw new Error("Não foi possível confirmar a atualização da foto.");
    } catch (error) {
      mutationError = error instanceof Error ? error.message : "Não foi possível atualizar a foto agora.";
    }
    if (controller.signal.aborted || !mountedRef.current || activeSessionRef.current !== mutationSession || photoOperationRef.current !== operation) return;
    photoMutationRef.current = false;
    const confirmed = await refreshPhotoState(mutationSession, !mutationError);
    if (!mountedRef.current || activeSessionRef.current !== mutationSession || photoOperationRef.current !== operation) return;
    if (!confirmed) { photoConfirmationRequiredRef.current = true; setPhotoError("Não foi possível confirmar o estado da foto."); return; }
    photoConfirmationRequiredRef.current = false;
    setIsPhotoMutating(false);
    if (mutationError) setPhotoError(mutationError); else setPhotoMessage("Foto profissional atualizada.");
  }

  async function removePhoto(): Promise<void> {
    if (!accessToken || isPhotoMutating || photoMutationRef.current || photoConfirmationRequiredRef.current || !window.confirm("Remover sua foto profissional?")) return;
    const mutationSession = sessionId;
    const operation = ++photoOperationRef.current;
    const controller = new AbortController(); photoMutationRef.current = true;
    setIsPhotoMutating(true); setPhotoError(null); setPhotoMessage(null);
    let mutationError: string | null = null;
    try {
      const response = await fetch(currentProfessionalProfilePhotoUrl, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` }, credentials: "include", signal: controller.signal });
      if (response.status !== 204) throw new Error(photoErrorMessage(response.status));
    } catch (error) {
      mutationError = error instanceof Error ? error.message : "Não foi possível remover a foto agora.";
    }
    if (controller.signal.aborted || !mountedRef.current || activeSessionRef.current !== mutationSession || photoOperationRef.current !== operation) return;
    photoMutationRef.current = false;
    const confirmed = await refreshPhotoState(mutationSession, !mutationError);
    if (!mountedRef.current || activeSessionRef.current !== mutationSession || photoOperationRef.current !== operation) return;
    if (!confirmed) { photoConfirmationRequiredRef.current = true; setPhotoError("Não foi possível confirmar o estado da foto."); return; }
    photoConfirmationRequiredRef.current = false;
    setIsPhotoMutating(false);
    if (mutationError) setPhotoError(mutationError); else setPhotoMessage("Foto profissional removida.");
  }

  async function confirmPhotoState(): Promise<void> {
    if (!photoConfirmationRequiredRef.current) return;
    const confirmationSession = sessionId;
    const operation = photoOperationRef.current;
    setIsPhotoMutating(true);
    const confirmed = await refreshPhotoState(confirmationSession);
    if (confirmed && mountedRef.current && activeSessionRef.current === confirmationSession && photoOperationRef.current === operation) {
      photoConfirmationRequiredRef.current = false;
      setPhotoError(null);
      setIsPhotoMutating(false);
      return;
    }
    if (mountedRef.current && activeSessionRef.current === confirmationSession && photoOperationRef.current === operation) setPhotoError("Não foi possível confirmar o estado da foto.");
  }

  if (isLoading || (isAuthenticated && isProfessional && loadState === "loading")) {
    return <PageMessage title="Carregando seu perfil..." />;
  }

  if (!isAuthenticated) {
    return <PageMessage title="Entre para editar seu perfil" description="Acesse sua conta profissional para atualizar suas informações." action={{ href: "/entrar", label: "Entrar" }} />;
  }

  if (!isProfessional) {
    return <PageMessage title="Acesso exclusivo para profissionais" description="Esta página requer uma conta com perfil profissional." />;
  }

  if (loadState === "error") {
    const sessionExpired = loadMessage === "Sua sessão expirou. Entre novamente para continuar.";
    return <PageMessage title="Não foi possível carregar seu perfil" description={loadMessage ?? undefined} action={sessionExpired ? { href: "/entrar", label: "Entrar" } : { href: "/profissional/perfil", label: "Tentar novamente", onClick: () => void loadProfile() }} />;
  }

  if (!profile) {
    return <PageMessage title="Perfil profissional não encontrado" description="Não foi possível localizar um perfil profissional ativo para esta conta." />;
  }

  return (
    <main className="min-h-full bg-slate-50">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <Link href="/conta" className="inline-flex min-h-11 items-center text-sm font-semibold text-blue-700 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
          Voltar para conta
        </Link>
        <header className="mt-5">
          <p className="font-semibold text-blue-700">Área do profissional</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Meu perfil profissional</h1>
          <p className="mt-3 max-w-2xl leading-7 text-slate-600">Mantenha suas informações atualizadas para apresentar melhor seu trabalho na Soravi.</p>
        </header>

        {accessToken && user ? <ProfessionalContactVerification accessToken={accessToken} email={user.email} phone={user.phone} emailVerified={user.emailVerified} phoneVerified={user.phoneVerified} onPhoneVerified={refreshSession} /> : null}

        <section className="mt-7 rounded-2xl border border-blue-200 bg-blue-50 p-5" aria-labelledby="registration-summary-title">
          <h2 id="registration-summary-title" className="font-bold text-blue-950">Resumo do cadastro profissional</h2>
          <ul className="mt-3 space-y-1 text-sm leading-6 text-blue-900"><li>E-mail: {user?.emailVerified ? "confirmado" : "pendente"}</li><li>Telefone: {user?.phoneVerified ? "confirmado" : "pendente"}</li><li>CPF e documento privado: {user?.professionalRegistrationCompleted ? "enviados" : "pendentes"}</li><li>Informações e categorias: {profile.categories.length > 0 ? "preenchidas" : "pendentes"}</li></ul>
          <p className="mt-3 text-sm leading-6 text-blue-900">A análise de identidade confirma seu documento. A verificação do perfil profissional é uma decisão separada e não libera oportunidades automaticamente.</p>
        </section>

        {accessToken && user ? (
          <PersonalIdentityCollection
            key={`${user.id}:${accessToken}`}
            accessToken={accessToken}
            userId={user.id}
          />
        ) : null}

        {accessToken ? <ProfessionalIdentityDocumentUpload accessToken={accessToken} /> : null}

        <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="professional-photo-title">
          <h2 id="professional-photo-title" className="text-xl font-bold text-slate-950">Foto profissional</h2>
          <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-center">
            {photoPreviewUrl ? <img src={photoPreviewUrl} alt="Prévia da nova foto" className="size-24 rounded-full border border-slate-200 object-cover" /> : <ProfessionalAvatar name={profile.displayName} photo={profile.photo} className="size-24" onRefresh={() => { if (!photoMutationRef.current && !isPhotoMutating && !photoConfirmationRequiredRef.current) void refreshPhotoState(sessionId); }} />}
            <div className="flex-1"><p className="text-sm leading-6 text-slate-600">JPEG, PNG ou WebP de até 5 MiB. A imagem terá corte central quadrado.</p><label className="mt-3 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"><Upload aria-hidden="true" className="size-4" />Selecionar foto<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={isPhotoMutating} onChange={(event) => selectPhoto(event.target.files?.[0])} /></label>{photoFile ? <button type="button" disabled={isPhotoMutating} onClick={() => void savePhoto()} className="mt-3 block min-h-11 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{isPhotoMutating ? "Salvando..." : "Salvar foto"}</button> : null}{profile.photo && !photoFile ? <button type="button" disabled={isPhotoMutating} onClick={() => void removePhoto()} className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-red-700 disabled:opacity-60"><Trash2 aria-hidden="true" className="size-4" />Remover foto</button> : null}</div>
          </div>
          {photoError ? <p role="alert" className="mt-4 text-sm font-medium text-red-700">{photoError}</p> : null}{photoConfirmationRequiredRef.current ? <button type="button" onClick={() => void confirmPhotoState()} className="mt-3 min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800">Consultar novamente</button> : null}{photoMessage ? <p role="status" className="mt-4 text-sm font-medium text-emerald-700">{photoMessage}</p> : null}
        </section>

        <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="verification-status-title">
          <div className="flex items-start gap-3">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-blue-700" />
            <div>
              <h2 id="verification-status-title" className="font-bold text-slate-950">{profile.verificationStatus === "REJECTED" ? "Perfil profissional não aprovado" : profile.verificationStatus === "PENDING" ? "Verificação do perfil profissional em análise" : "Verificação do perfil profissional"}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">{profile.verificationStatus === "REJECTED" ? "Revise as informações abaixo antes de reenviar seu perfil para uma nova análise." : profile.verificationStatus === "PENDING" ? "Seu perfil foi reenviado e está aguardando uma nova análise da Soravi." : "Este status é somente leitura nesta tela."}</p>
              <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${verificationStyles[profile.verificationStatus]}`}>{verificationLabels[profile.verificationStatus]}</span>
              {profile.verificationStatus === "REJECTED" && user?.professionalProfile?.reviewNotes ? <p className="mt-3 text-sm leading-6 text-red-800"><span className="font-semibold">Motivo da revisão:</span> {user.professionalProfile.reviewNotes}</p> : null}
              {["NOT_STARTED", "REJECTED"].includes(profile.verificationStatus) && !isEditing ? <button type="button" disabled={isSubmittingVerification || (profile.verificationStatus === "REJECTED" && !isReadyToResubmit)} onClick={() => void submitForVerification()} className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{isSubmittingVerification ? "Enviando..." : profile.verificationStatus === "REJECTED" ? "Reenviar perfil para análise" : "Enviar perfil para análise"}</button> : null}
              {submissionError ? <p role="alert" className="mt-3 text-sm font-medium text-red-700">{submissionError}</p> : null}
              {submissionMessage ? <p role="status" className="mt-3 text-sm font-medium text-emerald-700">{submissionMessage}</p> : null}
            </div>
          </div>
        </section>

        {isEditing ? <form className="mt-6 space-y-6" onSubmit={handleSubmit(saveProfile)} noValidate>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="professional-data-title">
            <h2 id="professional-data-title" className="text-xl font-bold text-slate-950">Informações profissionais</h2>

            <Field label="Nome público" htmlFor="displayName" error={errors.displayName?.message} helper="Este é o nome exibido na Soravi.">
              <div className="relative"><UserRound aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" /><input id="displayName" type="text" autoComplete="name" maxLength={120} className={inputClass} aria-invalid={Boolean(errors.displayName)} aria-describedby="displayName-help displayName-error" {...register("displayName", { onChange: () => setSaveMessage(null) })} /></div>
            </Field>

            <Field label="Título profissional" htmlFor="professionalTitle" error={errors.professionalTitle?.message} helper="Exemplo: Eletricista residencial.">
              <div className="relative"><BriefcaseBusiness aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" /><input id="professionalTitle" type="text" maxLength={80} className={inputClass} aria-invalid={Boolean(errors.professionalTitle)} aria-describedby="professionalTitle-help professionalTitle-error" {...register("professionalTitle", { onChange: () => setSaveMessage(null) })} /></div>
            </Field>

            <Field label="Área de atendimento" htmlFor="serviceArea" error={errors.serviceArea?.message} helper="Exemplo: Niterói e região.">
              <div className="relative"><MapPin aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" /><input id="serviceArea" type="text" maxLength={100} className={inputClass} aria-invalid={Boolean(errors.serviceArea)} aria-describedby="serviceArea-help serviceArea-error" {...register("serviceArea", { onChange: () => setSaveMessage(null) })} /></div>
            </Field>

            <Field label="Descrição profissional" htmlFor="bio" error={errors.bio?.message} helper="Não informe telefone, e-mail, CPF ou endereço completo.">
              <textarea id="bio" rows={6} maxLength={1000} className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100" aria-invalid={Boolean(errors.bio)} aria-describedby="bio-help bio-error bio-counter" placeholder="Conte sobre sua experiência, especialidades e forma de trabalho." {...register("bio", { onChange: () => setSaveMessage(null) })} />
              <p id="bio-counter" className="mt-2 text-right text-xs text-slate-500" aria-live="polite">{bioLength}/1000 caracteres</p>
            </Field>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="categories-title">
            <h2 id="categories-title" className="text-xl font-bold text-slate-950">Categorias de serviço</h2>
            <p id="categories-help" className="mt-2 text-sm leading-6 text-slate-600">Selecione de 1 a 3 categorias. Você escolheu {selectedCategories.length} de 3.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {categoryOptions.map((category) => {
                const isSelected = selectedCategories.includes(category.slug);
                const isDisabled = !isSelected && selectedCategories.length >= 3;
                return <label key={category.id} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${isSelected ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-white hover:border-blue-300"} ${isDisabled ? "cursor-not-allowed opacity-60" : ""}`}><input type="checkbox" checked={isSelected} disabled={isDisabled} onChange={() => toggleCategory(category.slug)} aria-describedby="categories-help categories-error" className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600" /><span className="text-sm font-semibold text-slate-800">{category.name}</span></label>;
              })}
            </div>
            {errors.categorySlugs ? <p id="categories-error" role="alert" className="mt-3 text-sm font-medium text-red-700">{errors.categorySlugs.message}</p> : null}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="availability-title">
            <h2 id="availability-title" className="text-xl font-bold text-slate-950">Disponibilidade</h2>
            <label className="mt-4 flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border border-slate-300 p-4 transition hover:border-blue-300">
              <input type="checkbox" className="mt-1 size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600" {...register("isAvailable", { onChange: () => setSaveMessage(null) })} />
              <span><span className="block font-semibold text-slate-900">Disponível para novas oportunidades</span><span className="mt-1 block text-sm leading-6 text-slate-600">Quando indisponível, você não receberá novas oportunidades. Seus serviços já existentes não são alterados.</span></span>
            </label>
          </section>

          {saveError ? <div role="alert" className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800"><AlertCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0" />{saveError}</div> : null}
          {saveMessage ? <div role="status" aria-live="polite" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium leading-6 text-emerald-800">{saveMessage}</div> : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" disabled={isSaving} onClick={cancelEditing} className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-800 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
              Cancelar
            </button>
            <button type="submit" disabled={isSaving} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400">
              {isSaving ? <LoaderCircle aria-hidden="true" className="size-5 animate-spin" /> : <Save aria-hidden="true" className="size-5" />}{isSaving ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </form> : <ProfileView profile={profile} onEdit={startEditing} saveMessage={saveMessage} />}
      </div>
    </main>
  );
}

const inputClass = "min-h-12 w-full rounded-xl border border-slate-300 bg-white py-3 pl-12 pr-4 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

function Field({ label, htmlFor, helper, error, children }: { label: string; htmlFor: string; helper: string; error?: string; children: React.ReactNode }) {
  return <div className="mt-5"><label htmlFor={htmlFor} className="block text-sm font-semibold text-slate-800">{label}</label>{children}<p id={`${htmlFor}-help`} className="mt-2 text-sm leading-6 text-slate-600">{helper}</p>{error ? <p id={`${htmlFor}-error`} role="alert" className="mt-2 text-sm font-medium text-red-700">{error}</p> : null}</div>;
}

function ProfileView({ profile, onEdit, saveMessage }: { profile: ProfessionalProfile; onEdit: () => void; saveMessage: string | null }) {
  return <div className="mt-6 space-y-6">
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="professional-data-title">
      <div className="flex items-start justify-between gap-4">
        <div><h2 id="professional-data-title" className="text-xl font-bold text-slate-950">Informações profissionais</h2><p className="mt-2 text-sm leading-6 text-slate-600">Confira como suas informações aparecem na Soravi.</p></div>
        <UserRound aria-hidden="true" className="size-6 shrink-0 text-blue-700" />
      </div>
      <dl className="mt-6 space-y-5">
        <ProfileValue label="Nome público" value={profile.displayName} />
        <ProfileValue label="Título profissional" value={profile.professionalTitle} />
        <ProfileValue label="Área de atendimento" value={profile.serviceArea} />
        <ProfileValue label="Descrição profissional" value={profile.bio} multiline />
      </dl>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="current-categories-title">
      <h2 id="current-categories-title" className="text-xl font-bold text-slate-950">Categorias de serviço</h2>
      <div className="mt-4 flex flex-wrap gap-2">{profile.categories.map((category) => <span key={category.id} className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-800">{category.name}</span>)}</div>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="current-availability-title">
      <h2 id="current-availability-title" className="text-xl font-bold text-slate-950">Disponibilidade</h2>
      <p className={`mt-3 font-semibold ${profile.isAvailable ? "text-emerald-800" : "text-slate-700"}`}>{profile.isAvailable ? "Disponível para novas oportunidades" : "Indisponível para novas oportunidades"}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">A indisponibilidade impede novas oportunidades, sem alterar serviços já existentes.</p>
    </section>

    {saveMessage ? <div role="status" aria-live="polite" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium leading-6 text-emerald-800">{saveMessage}</div> : null}
    <button type="button" onClick={onEdit} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"><Save aria-hidden="true" className="size-5" />Editar perfil</button>
  </div>;
}

function ProfileValue({ label, value, multiline = false }: { label: string; value: string | null; multiline?: boolean }) {
  return <div><dt className="text-sm font-semibold text-slate-700">{label}</dt><dd className={`mt-1 text-slate-950 ${multiline ? "whitespace-pre-wrap leading-7" : ""}`}>{value || "Não informado"}</dd></div>;
}

function PageMessage({ title, description, action }: { title: string; description?: string; action?: { href: string; label: string; onClick?: () => void } }) {
  return <main className="bg-slate-50"><div className="mx-auto max-w-3xl px-4 py-10 sm:px-6"><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h1 className="text-2xl font-bold text-slate-950">{title}</h1>{description ? <p className="mt-3 text-slate-600">{description}</p> : null}{action ? <Link href={action.href} onClick={action.onClick} className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">{action.label}</Link> : null}</section></div></main>;
}

function formValuesFromProfile(profile: ProfessionalProfile): ProfileFormData {
  return {
    displayName: profile.displayName,
    professionalTitle: profile.professionalTitle ?? "",
    serviceArea: profile.serviceArea ?? "",
    bio: profile.bio ?? "",
    categorySlugs: profile.categories.map((category) => category.slug),
    isAvailable: profile.isAvailable,
  };
}

function toPayload(data: ProfileFormData) {
  return {
    displayName: data.displayName.trim(),
    professionalTitle: nullableValue(data.professionalTitle),
    serviceArea: nullableValue(data.serviceArea),
    bio: nullableValue(data.bio),
    categorySlugs: data.categorySlugs,
    isAvailable: data.isAvailable,
  };
}

function nullableValue(value: string): string | null {
  const trimmedValue = value.trim();
  return trimmedValue.length === 0 ? null : trimmedValue;
}

function hasSameValues(profile: ProfessionalProfile, payload: ReturnType<typeof toPayload>): boolean {
  return profile.displayName === payload.displayName && profile.professionalTitle === payload.professionalTitle && profile.serviceArea === payload.serviceArea && profile.bio === payload.bio && profile.isAvailable === payload.isAvailable && sameValues(profile.categories.map((category) => category.slug), payload.categorySlugs);
}

function sameValues(left: string[], right: string[]): boolean {
  return left.length === right.length && [...left].sort().every((value, index) => value === [...right].sort()[index]);
}

function mergeProfileCategories(categories: ProfessionalCategory[], profileCategories: ProfessionalCategory[]): ProfessionalCategory[] {
  const values = new Map<string, ProfessionalCategory>();
  [...categories, ...profileCategories].forEach((category) => values.set(category.slug, category));
  return Array.from(values.values()).sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
}

function photoErrorMessage(status: number): string {
  if (status === 400) return "A foto enviada é inválida. Use JPEG, PNG ou WebP.";
  if (status === 401 || status === 403) return "Sua sessão não permite alterar a foto. Entre novamente.";
  if (status === 409) return "A foto não pôde ser atualizada agora. Tente novamente.";
  if (status === 413) return "A foto excede o limite de 5 MiB.";
  if (status === 429) return "Muitas tentativas. Aguarde um momento antes de tentar novamente.";
  return "Não foi possível atualizar a foto agora. Tente novamente.";
}

function isRecordedPhotoMutation(value: unknown): value is { recorded: true } {
  return typeof value === "object" && value !== null && "recorded" in value && value.recorded === true;
}
