'use client'

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

export function ResponseTimeChart({ data }: ResponseTimeChartProps) {
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
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis
              dataKey="label"
              stroke="#888"
              fontSize={12}
              tickLine={false}
            />
            <YAxis
              stroke="#888"
              fontSize={12}
              tickLine={false}
              tickFormatter={v => `${v}ms`}
            />
            <Tooltip
              contentStyle={{
                background: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '6px',
              }}
              labelStyle={{ color: '#888' }}
              formatter={(value: number) => [`${value}ms`, 'Avg']}
            />
            <Line
              type="monotone"
              dataKey="avg"
              stroke="#3b82f6"
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
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis
              dataKey="label"
              stroke="#888"
              fontSize={12}
              tickLine={false}
            />
            <YAxis
              stroke="#888"
              fontSize={12}
              tickLine={false}
              tickFormatter={v => `${v}%`}
              domain={[0, 100]}
            />
            <Tooltip
              contentStyle={{
                background: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '6px',
              }}
              labelStyle={{ color: '#888' }}
              formatter={(value: number) => [`${value}%`, 'Uptime']}
            />
            <Bar
              dataKey="uptime"
              fill="#22c55e"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
