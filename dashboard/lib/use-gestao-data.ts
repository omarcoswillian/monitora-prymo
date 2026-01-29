import { useState, useEffect, useCallback } from 'react'

export interface RankedPage {
  pageId: string
  url: string
  pageName: string
  clientName: string
  clientId: string
  performanceScore: number | null
  uptime: number
  avgResponseTime: number
  incidentCount: number
  healthScore: number
  status: 'Online' | 'Lento' | 'Offline'
  previousHealthScore: number | null
  previousUptime: number | null
  previousAvgResponseTime: number | null
  previousIncidentCount: number | null
  variation: 'up' | 'down' | 'stable' | null
}

export interface DailyPoint {
  date: string
  avgResponseTime: number
  uptime: number
  incidentCount: number
}

export interface IncidentByType {
  type: string
  count: number
}

export interface ClientOption {
  id: string
  name: string
}

export interface GestaoData {
  ranking: RankedPage[]
  clients: ClientOption[]
  daily: DailyPoint[]
  incidentsByType: IncidentByType[]
  loading: boolean
  selectedClient: string
  setSelectedClient: (v: string) => void
  period: number
  setPeriod: (v: number) => void
}

export function useGestaoData(): GestaoData {
  const [ranking, setRanking] = useState<RankedPage[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [daily, setDaily] = useState<DailyPoint[]>([])
  const [incidentsByType, setIncidentsByType] = useState<IncidentByType[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedClient, setSelectedClient] = useState('')
  const [period, setPeriod] = useState(7)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ period: String(period) })
      if (selectedClient) params.set('client', selectedClient)
      const res = await fetch(`/api/ranking?${params}`)
      const data = await res.json()
      setRanking(data.ranking || [])
      setDaily(data.daily || [])
      setIncidentsByType(data.incidentsByType || [])
      if (data.clients?.length && clients.length === 0) {
        setClients(data.clients)
      }
    } catch {
      setRanking([])
      setDaily([])
      setIncidentsByType([])
    } finally {
      setLoading(false)
    }
  }, [selectedClient, period])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    ranking, clients, daily, incidentsByType,
    loading, selectedClient, setSelectedClient, period, setPeriod,
  }
}
