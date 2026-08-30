import { ANSWER_SCALE, SCALE_INSTRUCTION } from "@/lib/see4x";

/**
 * Pergunta única do Diagnóstico 4X. A afirmação positiva é a pergunta em
 * destaque; a etiqueta do BlindSpot é opcional e só aparece para o time interno,
 * para não sugestionar a resposta de quem responde.
 */
export function ScaleQuestion({
  id,
  statement,
  tag,
  value,
  onChange,
}: {
  id: string;
  statement: string;
  tag?: string;
  value?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="rounded-lg border p-4">
      {tag && (
        <p className="text-[10px] font-bold tracking-[0.16em] uppercase text-muted-foreground mb-1">{tag}</p>
      )}
      <p className="text-sm font-semibold leading-snug">{statement}</p>
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2">
        {ANSWER_SCALE.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={active}
              aria-label={`${statement} — ${opt.value}: ${opt.label}. ${opt.hint}`}
              title={opt.hint}
              onClick={() => onChange(opt.value)}
              className={`rounded-lg border px-2 py-2 text-center text-[11px] font-semibold leading-tight transition-colors ${
                active
                  ? "border-gold bg-gold/15 text-foreground"
                  : "border-border text-muted-foreground hover:border-gold/50 hover:bg-accent"
              }`}
            >
              <span className="block text-base font-black">{opt.value}</span>
              {opt.label}
            </button>
          );
        })}
      </div>
      <span className="sr-only" id={`${id}-help`}>
        {SCALE_INSTRUCTION}
      </span>
    </div>
  );
}

/** Legenda da escala, exibida uma vez por bloco de perguntas. */
export function ScaleLegend({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-lg border border-dashed bg-muted/40 p-3 ${className}`}>
      <p className="text-xs text-muted-foreground">{SCALE_INSTRUCTION}</p>
      <ul className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
        {ANSWER_SCALE.map((opt) => (
          <li key={opt.value} className="text-xs text-muted-foreground">
            <strong className="text-foreground">
              {opt.value} · {opt.label}
            </strong>{" "}
            — {opt.hint}
          </li>
        ))}
      </ul>
    </div>
  );
}
