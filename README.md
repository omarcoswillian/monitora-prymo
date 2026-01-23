# Prymo Monitora

Sistema de monitoramento de paginas web com dashboard Next.js.

## Objetivo

Este projeto monitora paginas web para:

- Verificar disponibilidade (uptime) 4x/dia
- Detectar Soft 404 e erros HTTP
- Medir tempo de resposta
- Auditar performance com PageSpeed Insights
- Gerar relatorios semanais por cliente
- Alertar sobre problemas

## Requisitos

- Node.js >= 18.0.0
- npm

## Instalacao

```bash
# Instalar dependencias do monitor
npm install

# Instalar dependencias do dashboard
cd dashboard && npm install
```

## Configuracao

Crie um arquivo `.env` no diretorio `dashboard/` com as seguintes variaveis:

```bash
# Autenticacao (obrigatorio)
ADMIN_EMAIL=admin@exemplo.com
ADMIN_PASSWORD=sua_senha_segura
NEXTAUTH_SECRET=chave_secreta_aleatoria_longa
NEXTAUTH_URL=http://localhost:3000

# PageSpeed API (opcional, mas recomendado)
PAGESPEED_API_KEY=sua_chave_google_pagespeed

# Rate limit para auditorias manuais (minutos)
AUDIT_RATE_LIMIT_MINUTES=5
```

### Variaveis de ambiente do Monitor

Configure no sistema ou em um arquivo `.env` na raiz:

```bash
# Timezone (padrao: America/Sao_Paulo)
TZ=America/Sao_Paulo

# Horarios de verificacao de uptime (padrao: 00:00,06:00,12:00,18:00)
UPTIME_CHECK_TIMES=00:00,06:00,12:00,18:00

# Horario da auditoria PageSpeed (padrao: 08:00)
AUDIT_TIME=08:00

# Dia do relatorio semanal (0=Dom, 1=Seg, ..., padrao: 1)
REPORT_DAY=1

# Horario do relatorio semanal (padrao: 08:30)
REPORT_TIME=08:30
```

## Scripts

### Monitor (raiz do projeto)

| Comando | Descricao |
|---------|-----------|
| `npm run dev` | Executa monitor + dashboard em desenvolvimento |
| `npm run dev:monitor` | Executa apenas o monitor |
| `npm run dev:dash` | Executa apenas o dashboard |
| `npm run build` | Compila o TypeScript do monitor |
| `npm start` | Executa a versao compilada do monitor |

### Dashboard (pasta dashboard/)

| Comando | Descricao |
|---------|-----------|
| `npm run dev` | Modo desenvolvimento |
| `npm run build` | Build de producao |
| `npm run start` | Executa build de producao |

### Relatorios

```bash
# Gerar relatorios para todos os clientes
npx tsx src/scripts/generate-reports.ts all

# Gerar relatorio para um cliente especifico
npx tsx src/scripts/generate-reports.ts client "Nome do Cliente"

# Listar relatorios gerados
npx tsx src/scripts/generate-reports.ts list
```

## Estrutura do Projeto

```
monitor-pages/
├── src/
│   ├── index.ts                    # Ponto de entrada do monitor
│   ├── checker.ts                  # Verificador de paginas
│   ├── types.ts                    # Tipos TypeScript
│   ├── services/
│   │   ├── uptime-scheduler.ts     # Scheduler 4x/dia
│   │   ├── audit-scheduler.ts      # Scheduler PageSpeed
│   │   ├── report-scheduler.ts     # Scheduler relatorios
│   │   ├── report-generator.ts     # Gerador de relatorios
│   │   └── pagespeed.ts            # API PageSpeed
│   └── scripts/
│       └── generate-reports.ts     # Script CLI relatorios
├── dashboard/
│   ├── app/
│   │   ├── page.tsx                # Home/Dashboard
│   │   ├── login/                  # Pagina de login
│   │   ├── reports/                # Pagina de relatorios
│   │   ├── incidents/              # Pagina de incidentes
│   │   ├── clients/[clientId]/     # Detalhes do cliente
│   │   ├── pages/[pageId]/         # Detalhes da pagina
│   │   └── api/                    # API routes
│   └── components/                 # Componentes React
├── data/
│   ├── pages.json                  # Paginas monitoradas
│   ├── status.json                 # Status atual
│   ├── history.json                # Historico (7 dias)
│   ├── clients.json                # Clientes
│   ├── audits/                     # Auditorias PageSpeed
│   └── reports/                    # Relatorios semanais
└── README.md
```

## Funcionalidades

### Verificacao de Uptime

- **Frequencia:** 4x/dia nos horarios fixos (00:00, 06:00, 12:00, 18:00)
- **Configuravel:** via variavel `UPTIME_CHECK_TIMES`
- **Historico:** 7 dias retidos automaticamente

### Deteccao de Soft 404

O sistema detecta automaticamente:
- URLs que contem `/404`, `/not-found`, `/error`
- Paginas HTTP 200 com conteudo indicando erro
- Padroes em portugues e ingles

### Auditoria PageSpeed

- **Frequencia:** 1x/dia as 08:00 (configuravel)
- **Categorias:** Performance, Acessibilidade, Best Practices, SEO
- **Rate limit:** 5 minutos entre auditorias manuais
- **Historico:** 30 dias por pagina

### Relatorios Semanais

- **Geracao:** Automatica toda segunda as 08:30
- **Formato:** Markdown
- **Conteudo:**
  - Resumo executivo
  - Uptime semanal
  - Top 3 paginas com incidentes
  - Melhor/pior performance
  - Alertas e recomendacoes

### Autenticacao

- Login com email/senha
- Protecao de todas as rotas
- Sessao JWT (7 dias)

### Filtro por Cliente

- Home mostra visao global ou por cliente
- Cards de clientes clicaveis
- Dropdown sincronizado
- Graficos e metricas filtrados

## Desenvolvimento

```bash
# Iniciar em desenvolvimento (monitor + dashboard)
npm run dev

# Acessar dashboard
open http://localhost:3000
```

## Producao

```bash
# Build
npm run build
cd dashboard && npm run build

# Iniciar monitor
npm start

# Iniciar dashboard (em outro terminal)
cd dashboard && npm start
```

## Licenca

MIT
