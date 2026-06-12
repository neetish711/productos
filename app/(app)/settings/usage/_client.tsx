'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatTokens, formatCost } from '@/lib/utils'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'

interface Log {
  id: string
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  durationMs: number
  createdAt: Date
  prompt: { name: string; category: string } | null
}

export function UsageClient({ logs }: { logs: Log[] }) {
  const totalTokens = useMemo(() => logs.reduce((a, l) => a + l.inputTokens + l.outputTokens, 0), [logs])
  const totalCost = useMemo(() => {
    return logs.reduce((a, l) => {
      const inputCost = (l.inputTokens / 1_000_000) * 3
      const outputCost = (l.outputTokens / 1_000_000) * 15
      return a + inputCost + outputCost
    }, 0)
  }, [logs])
  const avgDuration = useMemo(() => {
    if (!logs.length) return 0
    return Math.round(logs.reduce((a, l) => a + l.durationMs, 0) / logs.length)
  }, [logs])

  // Group by day for chart
  const chartData = useMemo(() => {
    const byDay = new Map<string, { tokens: number; calls: number; cost: number }>()
    logs.forEach(l => {
      const day = formatDate(l.createdAt)
      const existing = byDay.get(day) || { tokens: 0, calls: 0, cost: 0 }
      const tokenCount = l.inputTokens + l.outputTokens
      const cost = ((l.inputTokens / 1_000_000) * 3) + ((l.outputTokens / 1_000_000) * 15)
      byDay.set(day, {
        tokens: existing.tokens + tokenCount,
        calls: existing.calls + 1,
        cost: existing.cost + cost,
      })
    })
    return Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([date, data]) => ({ date, ...data, cost: parseFloat(data.cost.toFixed(4)) }))
  }, [logs])

  // By provider
  const byProvider = useMemo(() => {
    const map = new Map<string, number>()
    logs.forEach(l => {
      map.set(l.provider, (map.get(l.provider) || 0) + l.inputTokens + l.outputTokens)
    })
    return Array.from(map.entries()).map(([provider, tokens]) => ({ provider, tokens }))
  }, [logs])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Usage Analytics</h1>
        <p className="text-muted-foreground text-sm mt-1">AI token usage and cost tracking</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total API Calls', value: logs.length.toLocaleString() },
          { label: 'Total Tokens', value: formatTokens(totalTokens) },
          { label: 'Estimated Cost', value: `$${totalCost.toFixed(4)}` },
          { label: 'Avg Duration', value: `${avgDuration}ms` },
        ].map(stat => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Token usage chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daily Token Usage (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
              No usage data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ fontSize: 12 }}
                  formatter={(value: any, name: string) => [
                    name === 'tokens' ? formatTokens(value) : value,
                    name,
                  ]}
                />
                <Legend />
                <Line type="monotone" dataKey="tokens" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Tokens" />
                <Line type="monotone" dataKey="calls" stroke="#06b6d4" strokeWidth={2} dot={false} name="API Calls" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* By provider */}
      {byProvider.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Usage by Provider</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {byProvider.map(({ provider, tokens }) => (
                <div key={provider} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{provider}</Badge>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">{formatTokens(tokens)} tokens</span>
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${Math.max(8, (tokens / totalTokens) * 200)}px` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent logs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent API Calls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 font-medium">Prompt</th>
                  <th className="text-left py-2 font-medium">Provider</th>
                  <th className="text-left py-2 font-medium">Model</th>
                  <th className="text-right py-2 font-medium">Tokens</th>
                  <th className="text-right py-2 font-medium">Duration</th>
                  <th className="text-right py-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {logs.slice(0, 20).map(log => (
                  <tr key={log.id} className="border-b hover:bg-muted/30">
                    <td className="py-2">
                      {log.prompt ? (
                        <div>
                          <p className="font-medium">{log.prompt.name}</p>
                          <p className="text-xs text-muted-foreground">{log.prompt.category}</p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Direct call</span>
                      )}
                    </td>
                    <td className="py-2">{log.provider}</td>
                    <td className="py-2 text-muted-foreground">{log.model}</td>
                    <td className="py-2 text-right">{formatTokens(log.inputTokens + log.outputTokens)}</td>
                    <td className="py-2 text-right">{log.durationMs}ms</td>
                    <td className="py-2 text-right text-muted-foreground">{formatDate(log.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
