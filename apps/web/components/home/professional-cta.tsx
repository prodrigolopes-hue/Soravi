"use client";

import { ArrowRight, BriefcaseBusiness, Check } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { useAuth } from "../auth/auth-provider";

const benefits = [
  "Encontre novas oportunidades",
  "Construa sua reputação",
  "Apresente propostas diretamente aos clientes",
];

export function ProfessionalCta() {
  const { isAuthenticated, isLoading } = useAuth();
  const showProfessionalRegistrationCta = !isLoading && !isAuthenticated;

  return (
    <section className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-10 text-white sm:px-10 lg:min-h-[26rem] lg:px-14 lg:py-14">
          <div className="relative z-10 max-w-3xl lg:max-w-[48%]">
            <div className="flex size-12 items-center justify-center rounded-xl bg-blue-600">
              <BriefcaseBusiness aria-hidden="true" className="size-6" />
            </div>

            <h2 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">
              Você é profissional?
            </h2>

            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">
              Crie seu perfil profissional e conecte-se a clientes que estão
              procurando pelos serviços que você oferece.
            </p>

            <ul className="mt-6 space-y-3">
              {benefits.map((benefit) => (
                <li key={benefit} className="flex items-center gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-green-500/15 text-green-400">
                    <Check aria-hidden="true" className="size-4" />
                  </span>
                  <span className="text-slate-200">{benefit}</span>
                </li>
              ))}
            </ul>

            {showProfessionalRegistrationCta ? (
              <div className="mt-8">
                <Link
                  href="/cadastro/profissional"
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 font-semibold text-slate-950 transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:w-auto"
                >
                  Quero trabalhar na Soravi
                  <ArrowRight aria-hidden="true" className="size-5" />
                </Link>
              </div>
            ) : null}
          </div>

          <div className="relative mt-8 aspect-video overflow-hidden rounded-2xl lg:absolute lg:inset-y-0 lg:right-0 lg:mt-0 lg:w-[58%] lg:aspect-auto lg:rounded-none">
            <Image
              src="/images/soravi-banner-profissional.webp"
              alt="Profissional de serviços em uma residência"
              fill
              sizes="(max-width: 1023px) calc(100vw - 3rem), (max-width: 1535px) 58vw, 800px"
              className="object-cover object-right"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 hidden bg-gradient-to-r from-slate-950 via-slate-950/60 to-transparent lg:block"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
