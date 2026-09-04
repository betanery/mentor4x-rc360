// @ts-nocheck
import * as React from "react";
import * as RechartsPrimitive from "recharts";

import { cn } from "@/lib/utils";

const THEMES = { light: "", dark: ".dark" } as const;

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode;
    icon?: React.ComponentType;
  } & ({ color?: string; theme?: never } | { color?: never; theme: Record<keyof typeof THEMES, string> });
};

type ChartContextProps = { config: ChartConfig };

const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) throw new Error("useChart must be used within a <ChartContainer />");
  return context;
}

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    config: ChartConfig;
    children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
  }
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = React.useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`;
  const safeConfig = config ?? {};

  return (
    <ChartContext.Provider value={{ config: safeConfig }}>
      <div data-chart={chartId} ref={ref} className={cn("flex aspect-video justify-center text-xs", className)} {...props}>
        <ChartStyle id={chartId} config={safeConfig} />
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
});
ChartContainer.displayName = "Chart";

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config ?? {}).filter(([, itemConfig]) => Boolean(itemConfig && (itemConfig.theme || itemConfig.color)));
  if (!colorConfig.length) return null;

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, itemConfig]) => {
    if (!itemConfig) return null;
    const color = itemConfig.theme?.[theme as keyof typeof itemConfig.theme] || itemConfig.color;
    return color ? `  --color-${key}: ${color};` : null;
  })
  .filter(Boolean)
  .join("\n")}
}`,
          )
          .join("\n"),
      }}
    />
  );
};

const ChartTooltip = RechartsPrimitive.Tooltip;
const ChartTooltipContent = React.forwardRef<HTMLDivElement, any>((props, ref) => {
  const {
    active,
    payload,
    className,
    indicator = "dot",
    hideLabel = false,
    hideIndicator = false,
    label,
    labelFormatter,
    labelClassName,
    formatter,
    color,
    nameKey,
    labelKey,
  } = props;
  useChart();
  if (!active || !payload?.length) return null;

  const safePayload = payload.filter(Boolean);
  if (!safePayload.length) return null;

  return (
    <div ref={ref} className={cn("grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl", className)}>
      {!hideLabel && label && <div className={cn("font-medium", labelClassName)}>{labelFormatter ? labelFormatter(label, safePayload) : label}</div>}
      <div className="grid gap-1.5">
        {safePayload.map((item: any, index: number) => (
          <div key={item?.dataKey ?? index} className="flex w-full items-center gap-2">
            {!hideIndicator && <div className="h-2.5 w-2.5 rounded-[2px]" style={{ background: color || item?.color || "transparent" }} />}
            <span className="text-muted-foreground">{item?.name ?? ""}</span>
            <span className="ml-auto font-mono font-medium tabular-nums text-foreground">{item?.value ?? ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
});
ChartTooltipContent.displayName = "ChartTooltip";

const ChartLegend = RechartsPrimitive.Legend;
const ChartLegendContent = React.forwardRef<HTMLDivElement, any>((props, ref) => {
  const { className, hideIcon = false, payload, verticalAlign = "bottom", nameKey } = props;
  if (!payload?.length) return null;

  const safePayload = payload.filter(Boolean);
  if (!safePayload.length) return null;

  return (
    <div ref={ref} className={cn("flex items-center justify-center gap-4", verticalAlign === "top" ? "pb-3" : "pt-3", className)}>
      {safePayload.map((item: any, index: number) => (
        <div key={item?.value ?? index} className="flex items-center gap-1.5">
          {!hideIcon && <div className="h-2 w-2 rounded-[2px]" style={{ background: item?.color || "transparent" }} />}
          {item?.value ?? ""}
        </div>
      ))}
    </div>
  );
});
ChartLegendContent.displayName = "ChartLegend";

export { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, ChartStyle };
