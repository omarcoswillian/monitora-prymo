'use client'

import { useEffect, useState } from 'react'
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
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent'

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

function useChartColors(): ChartColors {
  const [colors, setColors] = useState<ChartColors>({
    grid: '#333',
    axis: '#888',
    tooltipBg: '#1a1a1a',
    tooltipBorder: '#333',
    tooltipText: '#888',
    linePrimary: '#3b82f6',
    barSuccess: '#22c55e',
  })

  useEffect(() => {
    const updateColors = () => {
      const root = document.documentElement
      const styles = getComputedStyle(root)

      setColors({
        grid: styles.getPropertyValue('--border-subtle').trim() || '#333',
        axis: styles.getPropertyValue('--text-tertiary').trim() || '#888',
        tooltipBg: styles.getPropertyValue('--bg-elevated').trim() || '#1a1a1a',
        tooltipBorder: styles.getPropertyValue('--border-default').trim() || '#333',
        tooltipText: styles.getPropertyValue('--text-secondary').trim() || '#888',
        linePrimary: styles.getPropertyValue('--accent-primary').trim() || '#3b82f6',
        barSuccess: styles.getPropertyValue('--color-success').trim() || '#22c55e',
      })
    }

    updateColors()

    // Listen for theme changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          updateColors()
        }
      })
    })

    observer.observe(document.documentElement, { attributes: true })

    return () => observer.disconnect()
  }, [])

  return colors
}

export function ResponseTimeChart({ data }: ResponseTimeChartProps) {
  const colors = useChartColors()

  const formattedData = data.map(d => ({
    ...d,
    label: d.hour.split(' ')[1] || d.hour,
  }))

  return (
    <div className="chart-container">
      <h3 className="chart-title">Response Time (24h)</h3>
      {data.length === 0 ? (
        <div className="chart-empty">No data available</div>
      ) : (
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
              tickFormatter={v => `${v}ms`}
            />
            <Tooltip
              contentStyle={{
                background: colors.tooltipBg,
                border: `1px solid ${colors.tooltipBorder}`,
                borderRadius: '6px',
              }}
              labelStyle={{ color: colors.tooltipText }}
              formatter={(value: ValueType) => [`${value}ms`, 'Avg']}
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
      )}
    </div>
  )
}

export function UptimeChart({ data }: UptimeChartProps) {
  const colors = useChartColors()

  const formattedData = data.map(d => ({
    ...d,
    label: d.date.slice(5),
  }))

  return (
    <div className="chart-container">
      <h3 className="chart-title">Uptime (7 days)</h3>
      {data.length === 0 ? (
        <div className="chart-empty">No data available</div>
      ) : (
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
              tickFormatter={v => `${v}%`}
              domain={[0, 100]}
            />
            <Tooltip
              contentStyle={{
                background: colors.tooltipBg,
                border: `1px solid ${colors.tooltipBorder}`,
                borderRadius: '6px',
              }}
              labelStyle={{ color: colors.tooltipText }}
              formatter={(value: ValueType) => [`${value}%`, 'Uptime']}
            />
            <Bar
              dataKey="uptime"
              fill={colors.barSuccess}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
