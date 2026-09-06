import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, SlidersHorizontal } from "lucide-react";

type ScopeEntry = { key: string; value: string };

const parseObject = (raw: string): Record<string, unknown> | null => {
  try {
    const parsed = raw.trim() ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
};

const stringifyValue = (value: unknown) => {
  if (typeof value === "string") return value;
  return JSON.stringify(value);
};

const parseValue = (value: string): unknown => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try { return JSON.parse(trimmed); } catch { return value; }
};

export function ContractScopeEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const parsed = useMemo(() => parseObject(value), [value]);
  const entries: ScopeEntry[] = parsed
    ? Object.entries(parsed).map(([key, item]) => ({ key, value: stringifyValue(item) }))
    : [];

  const commitEntries = (next: ScopeEntry[]) => {
    const result: Record<string, unknown> = {};
    next.forEach((entry) => {
      const key = entry.key.trim();
      if (!key) return;
      result[key] = parseValue(entry.value);
    });
    onChange(JSON.stringify(result, null, 2));
  };

  const updateEntry = (index: number, patch: Partial<ScopeEntry>) => {
    const next = entries.map((entry, i) => i === index ? { ...entry, ...patch } : entry);
    commitEntries(next);
  };

  const removeEntry = (index: number) => commitEntries(entries.filter((_, i) => i !== index));
  const addEntry = () => commitEntries([...entries, { key: "", value: "" }]);

  return (
    <div className="space-y-3 sm:col-span-2" data-testid="contract-scope-editor">
      <div>
        <Label>Escopo contratado</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Registre os itens contratados em campos simples. Use nomes objetivos, como “encontros”, “diagnóstico” ou “entregáveis”.
        </p>
      </div>

      {parsed === null ? (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          O escopo atual usa uma estrutura avançada. Edite pelo modo técnico abaixo para não perder informações.
        </div>
      ) : (
        <div className="space-y-2">
          {entries.length === 0 && (
            <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-center text-sm text-muted-foreground">
              Nenhum item de escopo registrado.
            </div>
          )}
          {entries.map((entry, index) => (
            <div key={`${index}-${entry.key}`} className="grid grid-cols-1 gap-2 rounded-lg border border-border bg-muted/20 p-2 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto] sm:items-start sm:border-0 sm:bg-transparent sm:p-0">
              <Input
                aria-label={`Nome do item de escopo ${index + 1}`}
                value={entry.key}
                onChange={(e) => updateEntry(index, { key: e.target.value })}
                placeholder="Ex.: encontros"
              />
              <Input
                aria-label={`Valor do item de escopo ${index + 1}`}
                value={entry.value}
                onChange={(e) => updateEntry(index, { value: e.target.value })}
                placeholder="Ex.: 12"
              />
              <Button type="button" size="sm" variant="ghost" className="justify-self-end sm:h-10 sm:w-10 sm:p-0" onClick={() => removeEntry(index)} aria-label={`Remover item de escopo ${index + 1}`}>
                <Trash2 className="h-4 w-4 text-destructive" /><span className="ml-1 sm:hidden">Remover</span>
              </Button>
            </div>
          ))}
          <Button type="button" size="sm" variant="outline" onClick={addEntry}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar item
          </Button>
        </div>
      )}

      <details className="group rounded-lg border border-border bg-muted/20">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3 text-sm font-semibold">
          <span className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-gold" /> Modo técnico (JSON)</span>
          <span className="text-xs font-normal text-muted-foreground group-open:hidden">Mostrar</span>
          <span className="hidden text-xs font-normal text-muted-foreground group-open:inline">Ocultar</span>
        </summary>
        <div className="border-t border-border p-3">
          <Textarea
            rows={5}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label="Escopo contratado em JSON"
            spellCheck={false}
          />
          <p className="mt-2 text-xs text-muted-foreground">Use este modo somente quando precisar de estruturas avançadas.</p>
        </div>
      </details>
    </div>
  );
}
