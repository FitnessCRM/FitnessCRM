"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { tokens } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";

export interface TrendSeries {
  /** Clave del dato dentro de cada punto. */
  key: string;
  label: string;
  /** Índice en `tokens.chart.series`; 0 es el acento. */
  colorIndex?: number;
}

export interface TrendPoint {
  /** Etiqueta del eje X ("S1", "1 ago"). */
  label: string;
  /** `null` = hueco: la línea se corta, nunca se interpola (semana saltada, pesaje ausente). */
  [key: string]: string | number | null;
}

/**
 * Gráfica de líneas de la demo: rejilla horizontal fina, sin eje Y visible, punto en el último
 * valor, acento para la serie principal. `connectNulls` está a false a propósito: un hueco en
 * los datos tiene que verse como hueco.
 */
export function TrendChart({
  data,
  series,
  unit,
  height = 220,
  className,
}: {
  data: TrendPoint[];
  series: TrendSeries[];
  unit?: string;
  height?: number;
  className?: string;
}) {
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: 12 }}>
          <CartesianGrid vertical={false} stroke={tokens.color.borderSubtle} />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: tokens.color.textSubtle, fontSize: 11, fontFamily: tokens.font.ui }}
            dy={8}
          />
          <YAxis hide domain={["auto", "auto"]} />
          <Tooltip
            cursor={{ stroke: tokens.color.border }}
            contentStyle={{
              background: tokens.color.surfaceRaised,
              border: `1px solid ${tokens.color.border}`,
              borderRadius: 6,
              fontFamily: tokens.font.ui,
              fontSize: 13,
            }}
            labelStyle={{ color: tokens.color.textMuted }}
            itemStyle={{ color: tokens.color.textPrimary }}
            formatter={(value) => (unit ? `${value} ${unit}` : value)}
          />
          {series.map((s, i) => {
            const color = tokens.chart.series[s.colorIndex ?? i] ?? tokens.chart.series[0];
            return (
              <Line
                key={s.key}
                type="linear"
                dataKey={s.key}
                name={s.label}
                stroke={color}
                strokeWidth={i === 0 ? 2.5 : 2}
                dot={false}
                activeDot={{ r: 4, fill: color, stroke: "none" }}
                connectNulls={false}
                isAnimationActive={false}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
