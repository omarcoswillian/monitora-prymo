'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

// ============================================
// Types
// ============================================

interface HourlyAvg {
  hour: string
  avg: number
}

interface DailyUptime {
  date: string
  uptime: number
}

interface ResponseTimeChartProps {
  data: HourlyAvg[]
}

interface UptimeChartProps {
  data: DailyUptime[]
}

interface ChartColors {
  grid: string
  axis: string
  tooltipBg: string
  tooltipBorder: string
  tooltipText: string
  linePrimary: string
  barSuccess: string
}

// ============================================
// Custom Tooltip Components (avoid formatter typing issues)
// ============================================

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ value: number; name: string }>
  label?: string
  suffix: string
  valueLabel: string
  colors: ChartColors
}

function CustomChartTooltip({ active, payload, label, suffix, valueLabel, colors }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null
  }

  const value = payload[0]?.value ?? 0

  return (
    <div
      style={{
        background: colors.tooltipBg,
        border: `1px solid ${colors.tooltipBorder}`,
        borderRadius: '6px',
        padding: '8px 12px',
      }}
    >
      <p style={{ color: colors.tooltipText, margin: 0, marginBottom: 4 }}>{label}</p>
      <p style={{ color: colors.tooltipText, margin: 0 }}>
        <strong>{valueLabel}:</strong> {value}{suffix}
      </p>
    </div>
  )
}

// ============================================
// Hook for dynamic theme colors
// ============================================

const defaultColors: ChartColors = {
  grid: '#333',
  axis: '#888',
  tooltipBg: '#1a1a1a',
  tooltipBorder: '#333',
  tooltipText: '#888',
  linePrimary: '#3b82f6',
  barSuccess: '#22c55e',
}

function useChartColors(): ChartColors {
  const [colors, setColors] = useState<ChartColors>(defaultColors)

  const updateColors = useCallback(() => {
    if (typeof window === 'undefined') return

    const root = document.documentElement
    const styles = getComputedStyle(root)

    setColors({
      grid: styles.getPropertyValue('--border-subtle').trim() || defaultColors.grid,
      axis: styles.getPropertyValue('--text-tertiary').trim() || defaultColors.axis,
      tooltipBg: styles.getPropertyValue('--bg-elevated').trim() || defaultColors.tooltipBg,
      tooltipBorder: styles.getPropertyValue('--border-default').trim() || defaultColors.tooltipBorder,
      tooltipText: styles.getPropertyValue('--text-secondary').trim() || defaultColors.tooltipText,
      linePrimary: styles.getPropertyValue('--accent-primary').trim() || defaultColors.linePrimary,
      barSuccess: styles.getPropertyValue('--color-success').trim() || defaultColors.barSuccess,
    })
  }, [])

  useEffect(() => {
    updateColors()

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === 'data-theme') {
          updateColors()
          break
        }
      }
    })

    observer.observe(document.documentElement, { attributes: true })

    return () => observer.disconnect()
  }, [updateColors])

  return colors
}

// ============================================
// Chart Components
// ============================================

export function ResponseTimeChart({ data }: ResponseTimeChartProps) {
  const colors = useChartColors()

  if (data.length === 0) {
    return (
      <div className="chart-container">
        <h3 className="chart-title">Response Time (24h)</h3>
        <div className="chart-empty">No data available</div>
      </div>
    )
  }

  const formattedData = data.map((d) => ({
    hour: d.hour,
    avg: d.avg,
    label: d.hour.split(' ')[1] || d.hour,
  }))

  return (
    <div className="chart-container">
      <h3 className="chart-title">Response Time (24h)</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={formattedData}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
          <XAxis
            dataKey="label"
            stroke={colors.axis}
            fontSize={12}
            tickLine={false}
          />
          <YAxis
            stroke={colors.axis}
            fontSize={12}
            tickLine={false}
            tickFormatter={(v: number) => `${v}ms`}
          />
          <Tooltip
            content={
              <CustomChartTooltip
                suffix="ms"
                valueLabel="Avg"
                colors={colors}
              />
            }
          />
          <Line
            type="monotone"
            dataKey="avg"
            stroke={colors.linePrimary}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function UptimeChart({ data }: UptimeChartProps) {
  const colors = useChartColors()

  if (data.length === 0) {
    return (
      <div className="chart-container">
        <h3 className="chart-title">Uptime (7 days)</h3>
        <div className="chart-empty">No data available</div>
      </div>
    )
  }

  const formattedData = data.map((d) => ({
    date: d.date,
    uptime: d.uptime,
    label: d.date.slice(5),
  }))

  return (
    <div className="chart-container">
      <h3 className="chart-title">Uptime (7 days)</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={formattedData}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
          <XAxis
            dataKey="label"
            stroke={colors.axis}
            fontSize={12}
            tickLine={false}
          />
          <YAxis
            stroke={colors.axis}
            fontSize={12}
            tickLine={false}
            tickFormatter={(v: number) => `${v}%`}
            domain={[0, 100]}
          />
          <Tooltip
            content={
              <CustomChartTooltip
                suffix="%"
                valueLabel="Uptime"
                colors={colors}
              />
            }
          />
          <Bar
            dataKey="uptime"
            fill={colors.barSuccess}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
