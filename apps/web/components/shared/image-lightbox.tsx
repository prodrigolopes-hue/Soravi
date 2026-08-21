import { useEffect, useRef } from "react";

export interface LightboxImage {
  src: string;
  alt: string;
}

interface ImageLightboxProps {
  image: LightboxImage | null;
  onClose: () => void;
}

export function ImageLightbox({ image, onClose }: ImageLightboxProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!image) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [image, onClose]);

  if (!image) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Ampliar imagem ${image.alt}`}
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] max-w-[90vw] rounded-2xl bg-white/5 p-2 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          ref={closeButtonRef}
          type="button"
          aria-label="Fechar imagem ampliada"
          onClick={onClose}
          className="absolute right-3 top-3 inline-flex size-10 items-center justify-center rounded-full bg-slate-900/75 text-lg font-semibold text-white shadow-lg transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          ×
        </button>

        <img
          src={image.src}
          alt={image.alt}
          className="max-h-[80vh] max-w-[90vw] rounded-xl object-contain"
        />
      </div>
    </div>
  );
}
