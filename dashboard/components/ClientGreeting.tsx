"use client";

import { Activity, CheckCircle2, AlertTriangle, Globe } from "lucide-react";

interface ClientGreetingProps {
  companyName: string;
  totalPages: number;
  onlineCount: number;
  offlineCount: number;
  slowCount: number;
  uptime7d: number | null;
  avgPerformance: number | null;
}

export default function ClientGreeting({
  companyName,
  totalPages,
  onlineCount,
  offlineCount,
  slowCount,
  uptime7d,
  avgPerformance,
}: ClientGreetingProps) {
  const today = new Date();
  const dateStr = today.toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Health score: 0.6 * uptime7d + 0.4 * avgPerformance
  const hasUptime = uptime7d !== null && uptime7d !== undefined;
  const hasPerf = avgPerformance !== null && avgPerformance !== undefined;

  let healthScore: number | null = null;
  if (hasUptime && hasPerf) {
    healthScore = Math.round(0.6 * uptime7d + 0.4 * avgPerformance);
  } else if (hasUptime) {
    healthScore = Math.round(uptime7d);
  } else if (hasPerf) {
    healthScore = Math.round(avgPerformance);
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return "health-score-green";
    if (score >= 70) return "health-score-yellow";
    return "health-score-red";
  };

  const problemCount = offlineCount + slowCount;

  return (
    <div className="client-greeting">
      <div className="client-greeting-main">
        <div className="client-greeting-text">
          <h1>
            Ola, {companyName}
          </h1>
          <p className="client-greeting-date">{dateStr}</p>
          <p className="client-greeting-summary">
            <Globe size={16} />
            {totalPages} paginas monitoradas
            <span className="client-greeting-dot">&middot;</span>
            <CheckCircle2 size={16} />
            {onlineCount} online
            <span className="client-greeting-dot">&middot;</span>
            <Activity size={16} />
            Uptime {hasUptime ? `${uptime7d.toFixed(1)}%` : "--"} (7d)
          </p>
        </div>

        {healthScore !== null && (
          <div className={`health-score-badge ${getScoreColor(healthScore)}`} title="Saude do Site">
            <span className="health-score-value">{healthScore}</span>
          </div>
        )}
      </div>

      {problemCount > 0 && (
        <div className="client-greeting-alert">
          <AlertTriangle size={16} />
          Atencao: {problemCount} pagina(s) com problema
        </div>
      )}
    </div>
  );
}
