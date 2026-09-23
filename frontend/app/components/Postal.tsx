import Link from "next/link";
import type { ReactNode } from "react";
import { colorForMood } from "../lib/types";

export function Arrow({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={`inline-block h-[0.9em] w-[0.9em] ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 8h11M9 3.5 13.5 8 9 12.5" />
    </svg>
  );
}

// Airmail etiquette: the blue label with an inner white rule.
const etiquette =
  "postal inline-flex items-center justify-center gap-2 border-2 px-3 py-1.5 text-[0.8rem] leading-none transition-[background-color,color,box-shadow] duration-200 disabled:cursor-not-allowed disabled:opacity-40";

export function etiquetteClass(active = false) {
  return `${etiquette} ${
    active
      ? "border-airmail-blue bg-airmail-blue text-stamp-paper shadow-[inset_0_0_0_2px_var(--airmail-blue),inset_0_0_0_3px_var(--stamp-paper)]"
      : "border-airmail-blue bg-transparent text-airmail-blue hover:bg-airmail-blue/10 enabled:active:bg-airmail-blue/20"
  }`;
}

export function EtiquetteButton({
  children,
  onClick,
  disabled,
  label,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={etiquetteClass()}
    >
      {children}
    </button>
  );
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-1.5 text-sm font-medium text-airmail-blue underline decoration-airmail-blue/40 hover:decoration-airmail-blue"
    >
      {children}
      <Arrow className="transition-transform duration-200 group-hover:translate-x-0.5" />
    </Link>
  );
}

// Rubber handstamp in the mood's ink, slightly askew.
export function MoodStamp({ mood, className = "" }: { mood: string; className?: string }) {
  const ink = colorForMood(mood);
  return (
    <span
      className={`postal inline-block -rotate-3 border-2 px-2 py-1 text-[0.8rem] leading-none ${className}`}
      style={{
        color: ink,
        borderColor: ink,
        boxShadow: `inset 0 0 0 2px var(--stamp-paper), inset 0 0 0 3px ${ink}`,
      }}
    >
      {mood}
    </span>
  );
}

export function SectionHeading({
  id,
  children,
  action,
}: {
  id: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
      <h2 id={id} className="text-2xl font-semibold text-ink [font-stretch:90%] [word-spacing:0.1em]">
        {children}
      </h2>
      {action}
    </div>
  );
}

export function Problem({
  what,
  message,
  onRetry,
}: {
  what: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 text-sm text-ink-2">
      <p>
        <span className="font-semibold text-danger">Couldn’t load {what}.</span>{" "}
        The panel backend answered: <span className="text-ink">{message}</span>. Check that it’s
        running, then try again.
      </p>
      <EtiquetteButton onClick={onRetry}>Try again</EtiquetteButton>
    </div>
  );
}
