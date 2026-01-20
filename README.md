# Monitor Pages

Sistema para monitoramento de páginas web.

## Objetivo

Este projeto tem como objetivo monitorar páginas web para:

- Verificar disponibilidade (uptime)
- Detectar mudanças de conteúdo
- Medir tempo de resposta
- Alertar sobre problemas

## Requisitos

- Node.js >= 18.0.0

## Instalação

```bash
npm install
```

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Executa em modo desenvolvimento com hot-reload |
| `npm run build` | Compila o TypeScript para JavaScript |
| `npm start` | Executa a versão compilada |
| `npm run lint` | Verifica o código com ESLint |
| `npm run clean` | Remove a pasta dist/ |

## Estrutura do Projeto

```
monitor-pages/
├── src/
│   └── index.ts      # Ponto de entrada
├── dist/             # Código compilado (gerado)
├── package.json
├── tsconfig.json
└── README.md
```

## Licença

MIT
