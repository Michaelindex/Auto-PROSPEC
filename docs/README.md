# WhatsApp Campaign Sender (Baileys)

> Sistema local e open-source para disparo controlado de campanhas no WhatsApp via Baileys, com frontend web para gestão de campanhas, contatos, variações de mensagem, agendamento e relatórios.

---

## 📌 Sumário

1. [Visão Geral](#1-visão-geral)
2. [Stack Técnica](#2-stack-técnica)
3. [Estrutura do Projeto](#3-estrutura-do-projeto)
4. [Modelo de Dados (SQLite + Prisma)](#4-modelo-de-dados-sqlite--prisma)
5. [Funcionalidades Detalhadas](#5-funcionalidades-detalhadas)
6. [Fluxos de Negócio](#6-fluxos-de-negócio)
7. [API Backend](#7-api-backend)
8. [WebSocket Events](#8-websocket-events)
9. [Frontend — Telas e Componentes](#9-frontend--telas-e-componentes)
10. [Variáveis de Ambiente](#10-variáveis-de-ambiente)
11. [Instalação e Execução](#11-instalação-e-execução)
12. [Segurança e Open Source](#12-segurança-e-open-source)
13. [Anti-Ban — Boas Práticas](#13-anti-ban--boas-práticas)
14. [Checklist de Entrega](#14-checklist-de-entrega)

---

## 1. Visão Geral

### O que é

Sistema **local** (rodando na máquina do usuário) que conecta-se ao WhatsApp pessoal via [Baileys](https://github.com/WhiskeySockets/Baileys) e dispara campanhas de mensagens para listas de contatos importadas via CSV. Tem um frontend web próprio para gerenciar todo o ciclo de vida das campanhas.

### O que NÃO é

- **Não é um chatbot.** O sistema apenas dispara mensagens iniciais; **nunca responde** a nada que o destinatário enviar de volta. Toda a conversa após o disparo é responsabilidade humana, fora do sistema.
- **Não tem autenticação.** Roda local, sem login, sem usuários. É single-user por design.
- **Não é multi-tenant.** Uma instalação = uma conta WhatsApp = um usuário operando.

### Princípios de design

- **Simples e funcional** — sem over-engineering.
- **Controle total do usuário** — todos os parâmetros (delays, limites, modo) são configuráveis pela UI.
- **Anti-ban first** — delays aleatórios, variações de mensagem, simulação de digitação, limites diários.
- **Transparência** — todos os envios, erros e respostas (apenas registradas, nunca processadas) ficam logados e visíveis em dashboard.

---

## 2. Stack Técnica

### Backend
- **Runtime:** Node.js 20+
- **Framework:** Express
- **WhatsApp:** [`@whiskeysockets/baileys`](https://www.npmjs.com/package/@whiskeysockets/baileys) (versão estável mais recente)
- **ORM:** Prisma
- **Banco:** SQLite (arquivo local em `backend/data/database.db`)
- **Realtime:** WebSocket (`ws` ou `socket.io`) — escolher `socket.io` pela simplicidade
- **Upload de arquivos:** `multer`
- **Parser de CSV:** `csv-parse`
- **Validação de telefone:** `libphonenumber-js`
- **Agendamento:** `node-cron` ou setTimeout interno (preferir setTimeout + persistência no DB pra sobreviver a restarts)
- **Logger:** `pino` com saída para `backend/logs/`

### Frontend
- **Framework:** React 18
- **Bundler:** Vite
- **Estilo:** TailwindCSS
- **Componentes:** shadcn/ui
- **Ícones:** lucide-react
- **HTTP:** axios
- **Realtime:** socket.io-client
- **Estado:** Zustand (leve, sem boilerplate de Redux)
- **Roteamento:** react-router-dom
- **Toast/notificações:** sonner
- **Forms:** react-hook-form + zod

### Monorepo
- Pastas `/backend` e `/frontend` na raiz.
- `package.json` raiz com script `npm run dev` que sobe os dois em paralelo via `concurrently`.

---

## 3. Estrutura do Projeto

```
whatsapp-campaign-sender/
├── .gitignore
├── .env.example
├── README.md
├── LICENSE                          # MIT
├── package.json                     # scripts raiz (concurrently)
│
├── backend/
│   ├── package.json
│   ├── .env                         # IGNORADO no git
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── data/                        # IGNORADO no git
│   │   ├── database.db
│   │   └── auth/                    # sessão Baileys (creds, keys)
│   ├── uploads/                     # IGNORADO no git
│   │   ├── csv/                     # CSVs enviados
│   │   └── images/                  # imagens de campanhas
│   ├── logs/                        # IGNORADO no git
│   └── src/
│       ├── index.js                 # entrypoint Express + Socket.IO
│       ├── config/
│       │   └── env.js
│       ├── routes/
│       │   ├── campaigns.routes.js
│       │   ├── contacts.routes.js
│       │   ├── messages.routes.js
│       │   ├── whatsapp.routes.js
│       │   └── settings.routes.js
│       ├── controllers/
│       ├── services/
│       │   ├── whatsapp.service.js  # gerencia conexão Baileys
│       │   ├── campaign.service.js  # orquestra disparo
│       │   ├── csv.service.js       # parse + classificação fixo/celular
│       │   ├── scheduler.service.js # agendamentos
│       │   └── queue.service.js     # fila de campanhas simultâneas
│       ├── utils/
│       │   ├── phone.js             # detecção fixo vs celular BR
│       │   ├── delay.js             # delay aleatório
│       │   └── name.js              # extrai primeiro nome
│       ├── socket/
│       │   └── index.js
│       └── prisma/
│           └── client.js
│
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── routes.jsx
        ├── components/
        │   ├── ui/                  # shadcn/ui
        │   ├── ConnectionStatus.jsx
        │   ├── QRCodeModal.jsx
        │   ├── CampaignCard.jsx
        │   ├── CampaignForm.jsx
        │   ├── ContactsUploader.jsx
        │   ├── MessageEditor.jsx
        │   ├── VariationsManager.jsx
        │   └── ModeSwitch.jsx
        ├── pages/
        │   ├── Dashboard.jsx        # lista de campanhas + status global
        │   ├── NewCampaign.jsx
        │   ├── CampaignDetail.jsx
        │   └── Settings.jsx
        ├── store/
        │   ├── useWhatsAppStore.js
        │   └── useCampaignsStore.js
        ├── services/
        │   ├── api.js
        │   └── socket.js
        └── lib/
            └── utils.js
```

---

## 4. Modelo de Dados (SQLite + Prisma)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:../data/database.db"
}

model Settings {
  id                    Int      @id @default(1)
  mode                  String   @default("test")        // "test" | "production"
  maxConcurrentCampaigns Int     @default(1)             // quantas campanhas podem rodar simultaneamente
  dailyLimitEnabled     Boolean  @default(false)
  dailyLimitValue       Int      @default(200)
  defaultMinDelaySec    Int      @default(30)
  defaultMaxDelaySec    Int      @default(90)
  simulateTyping        Boolean  @default(true)
  updatedAt             DateTime @updatedAt
}

model Campaign {
  id              String   @id @default(cuid())
  name            String
  status          String   @default("draft")   // draft | scheduled | queued | running | paused | completed | failed
  flowMode        String                       // "sequential_per_contact" | "broadcast" | "shuffled"
  // sequential_per_contact (a): contato A recebe msg1→msg2→msg3, depois B...
  // broadcast (b): todos recebem msg1, depois todos msg2...
  // shuffled (c): intercalado/embaralhado
  
  minDelaySec     Int                          // delay mínimo entre mensagens
  maxDelaySec     Int                          // delay máximo entre mensagens
  simulateTyping  Boolean  @default(true)
  
  scheduledAt     DateTime?                    // null = agora; se passou, dispara imediato
  startedAt       DateTime?
  pausedAt        DateTime?
  completedAt     DateTime?
  
  imagePath       String?                      // caminho da imagem única da campanha (opcional)
  imageCaption    String?                      // legenda da imagem, se houver
  
  stopOnReply     Boolean  @default(true)      // se contato responder, marca como respondido e não envia mais
  
  totalContacts   Int      @default(0)
  sentCount       Int      @default(0)
  failedCount     Int      @default(0)
  repliedCount    Int      @default(0)
  
  messages        Message[]
  contacts        CampaignContact[]
  sendLogs        SendLog[]
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model Message {
  id          String   @id @default(cuid())
  campaignId  String
  order       Int                              // 1, 2, 3... ordem na sequência
  campaign    Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  variations  MessageVariation[]
  
  @@unique([campaignId, order])
}

model MessageVariation {
  id          String   @id @default(cuid())
  messageId   String
  content     String                           // texto, suporta {nome}
  message     Message  @relation(fields: [messageId], references: [id], onDelete: Cascade)
}

model Contact {
  id           String   @id @default(cuid())
  phone        String   @unique                // formato E.164: +5516991831382
  firstName    String                          // primeiro nome extraído
  rawName      String                          // nome completo original do CSV
  type         String                          // "mobile" | "landline"
  createdAt    DateTime @default(now())
  
  campaigns    CampaignContact[]
}

model CampaignContact {
  id              String   @id @default(cuid())
  campaignId      String
  contactId       String
  
  status          String   @default("pending") // pending | in_progress | completed | failed | replied | skipped
  currentMsgOrder Int      @default(0)         // quantas mensagens já recebeu
  lastSentAt      DateTime?
  repliedAt       DateTime?                    // se respondeu, hora da resposta
  
  campaign        Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  contact         Contact  @relation(fields: [contactId], references: [id])
  
  @@unique([campaignId, contactId])
}

model SendLog {
  id              String   @id @default(cuid())
  campaignId      String
  contactId       String
  phone           String
  messageOrder    Int
  variationUsed   String?                      // texto que foi efetivamente enviado
  status          String                       // "sent" | "failed"
  errorType       String?                      // "invalid_number" | "not_on_whatsapp" | "blocked" | "timeout" | "unknown"
  errorMessage    String?
  sentAt          DateTime @default(now())
  
  campaign        Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
}

model IncomingMessage {
  id          String   @id @default(cuid())
  fromPhone   String
  fromName    String?
  content     String
  campaignId  String?                          // se conseguir cruzar com campanha
  receivedAt  DateTime @default(now())
}

model DailyCounter {
  date         String   @id                    // "YYYY-MM-DD"
  sentCount    Int      @default(0)
}
```

---

## 5. Funcionalidades Detalhadas

### 5.1 Conexão WhatsApp (Baileys)

- Ao iniciar o backend, tenta restaurar sessão da pasta `backend/data/auth/`.
- Se não houver sessão, gera QR code e emite via WebSocket para o frontend exibir num **modal**.
- Quando escaneado, salva credenciais e emite `connection: open`.
- Reconecta automaticamente em caso de queda (`DisconnectReason.connectionClosed` etc.), exceto em `loggedOut` (aí limpa pasta e pede QR novo).
- Endpoint para **forçar logout** (apaga `data/auth/`).

### 5.2 Upload e Processamento de CSV

**Formato aceito:**
```csv
nome,numero
"José Advocacia X2","(16) 99183-1382"
"Maria Silva Escritório","(16) 3610-0002"
"Carlos","+55 16 99999-9999"
```

**Regras de parsing:**
1. Aceitar separadores `,` ou `;`.
2. Header opcional (detectar se primeira linha tem "nome"/"numero" ou similar; senão assumir ordem nome, numero).
3. **Nome:** pegar a string, trim, split por espaço, retornar `parts[0]` capitalizado (Primeira letra maiúscula, resto minúsculo). Ex: `"JOSÉ ADVOCACIA X2"` → `"José"`.
4. **Número:**
   - Remover tudo que não for dígito ou `+`.
   - Se não começar com `+`, assumir Brasil (`+55`).
   - Validar com `libphonenumber-js`.
   - **Classificação fixo vs celular (Brasil):** após o código de país `+55` e o DDD (2 dígitos), o próximo dígito determina:
     - `9` → celular (mobile) ✅ guarda
     - `2`, `3`, `4`, `5` → fixo (landline) ❌ descarta
   - Também usar `libphonenumber-js` (`getNumberType()` retorna `MOBILE` ou `FIXED_LINE`) como segunda validação.
5. **Deduplicação:** dentro do mesmo CSV, ignorar números repetidos.
6. **Persistência:** salvar todos os celulares válidos na tabela `Contact` (UPSERT por `phone`).
7. **Resposta da API:** retornar resumo `{ total, mobile, landline, invalid, duplicates, savedContactIds }`.

### 5.3 Criação de Campanha

A tela de criação tem os seguintes campos:

| Campo | Tipo | Obrigatório | Default |
|---|---|---|---|
| Nome da campanha | texto | sim | — |
| Modo de fluxo | radio: sequencial / broadcast / embaralhado | sim | sequencial |
| Lista de contatos | upload CSV ou seleção da base existente | sim | — |
| Mensagens em sequência | array dinâmico (mín 1) | sim | — |
| Variações por mensagem | array dentro de cada mensagem (mín 1) | sim | — |
| Imagem única da campanha | upload (PNG/JPG, máx 5MB) | não | null |
| Legenda da imagem | texto | não | — |
| Delay mínimo (seg) | número | sim | 30 |
| Delay máximo (seg) | número | sim | 90 |
| Simular digitando | toggle | — | true |
| Parar se cliente responder | toggle | — | true |
| Quando disparar | radio: agora / agendado | sim | agora |
| Data/hora agendada | datetime | se agendado | — |

**Validações:**
- `minDelaySec < maxDelaySec`.
- Pelo menos 1 mensagem com pelo menos 1 variação.
- Se imagem foi anexada, ela é enviada **junto com a primeira mensagem** apenas (decisão de design simples).
- Variáveis suportadas no texto: apenas `{nome}` (substituído pelo `firstName` do contato).

### 5.4 Variações de Mensagem

- Cada mensagem da sequência tem N variações.
- No momento do envio, o sistema **sorteia aleatoriamente** uma das variações para aquele contato/aquela mensagem.
- Distribuição: pseudo-aleatória uniforme; não precisa garantir distribuição perfeita.

### 5.5 Disparo de Mensagens

**Algoritmo geral (modo `sequential_per_contact`):**

```
para cada contato C em ordem aleatória:
  se status != pending: pular
  marcar C.status = in_progress
  para cada mensagem M em ordem:
    se C foi respondido (e stopOnReply): break
    se modo == "test": phone = TEST_PHONE
    sortear variação V de M
    substituir {nome} por C.firstName em V
    se M.order == 1 e campanha.imagePath: enviar imagem + V como caption
    senão: enviar V como texto
    se simulateTyping: enviar presence "composing" por (length(V) / 50 * 1000) ms antes do envio real
    registrar SendLog
    incrementar DailyCounter
    delay aleatório entre minDelaySec e maxDelaySec
  marcar C.status = completed
```

**Modo `broadcast`:** itera mensagens externamente, contatos internamente.

**Modo `shuffled`:** monta uma fila `[(C1,M1), (C2,M1), (C1,M2), (C3,M1), ...]` embaralhada respeitando que `M(n+1)` de um contato só vem depois de `M(n)` do mesmo contato.

### 5.6 Modo Teste vs Produção

- **Switch global** em `Settings.mode` (no header da aplicação, sempre visível).
- **Modo teste:** todas as mensagens (todas as sequências, todas as variações, de todas as campanhas ativas) são enviadas para `TEST_PHONE_NUMBER` do `.env`, com prefixo na mensagem:
  ```
  [TESTE - Campanha: NomeDaCampanha] [Contato fictício: {nome}]
  
  {mensagem original}
  ```
- **Modo produção:** envia para os números reais.
- Trocar o modo durante uma campanha ativa pausa imediatamente todas as campanhas e exige confirmação para retomar.

### 5.7 Agendamento

- Se `scheduledAt` é `null` ou no passado quando a campanha é criada/iniciada → dispara imediato.
- Se `scheduledAt` é no futuro → campanha entra em status `scheduled`. Um job interno (intervalo de 30s) verifica campanhas agendadas e move pra fila quando der a hora.
- Persistência: agendamentos sobrevivem a restarts do servidor.

### 5.8 Pausa e Retomada

- Botão **Pausar** numa campanha em execução:
  - Para de iniciar **novos contatos**.
  - Contatos que já estão `in_progress` (meio da sequência) **finalizam toda sua sequência** normalmente antes da campanha realmente ir para `paused`.
  - Status intermediário: `pausing` (UI mostra "Pausando — aguardando contatos em andamento finalizarem"). Só vira `paused` quando não houver mais nenhum `in_progress`.
- Botão **Retomar** numa campanha pausada:
  - Volta status para `running` (ou `queued` se já tiver `maxConcurrentCampaigns` rodando).
  - Continua de onde parou: contatos com status `pending` entram na fila.

### 5.9 Edição

- **Só é possível editar campanha quando status é `paused` ou `draft`**.
- Em `running`, todos os campos são read-only.

### 5.10 Fila de Campanhas Simultâneas

- `Settings.maxConcurrentCampaigns` define quantas podem rodar ao mesmo tempo.
- Quando o usuário inicia uma campanha:
  - Se `runningCount < max`: vira `running`.
  - Senão: vira `queued`.
- Quando uma campanha completa/falha/pausa: a próxima `queued` (FIFO por `createdAt`) vira `running`.
- Usuário pode reordenar a fila manualmente (drag-and-drop opcional, ou setas up/down) na tela do dashboard.

### 5.11 Detecção de Respostas (apenas registro, nunca resposta automática)

- Listener Baileys `messages.upsert` captura mensagens recebidas.
- Se a mensagem vem de um número que está como `in_progress` ou `completed` em alguma campanha:
  - Cria registro em `IncomingMessage`.
  - Marca `CampaignContact.repliedAt = now()` e `status = replied`.
  - Se a campanha tem `stopOnReply = true` e o contato ainda tinha mensagens pendentes → pula as restantes.
- **O bot NUNCA envia nenhuma mensagem de resposta automática.** Não há auto-reply, não há "fora do horário", não há nada. Toda a conversa após o disparo é manual do usuário no celular dele.

### 5.12 Falhas e Relatórios

- Cada tentativa de envio gera um `SendLog`.
- Tipos de erro mapeados:
  - `not_on_whatsapp`: número não tem WhatsApp.
  - `invalid_number`: número malformado.
  - `blocked`: bloqueado pelo destinatário.
  - `timeout`: sem resposta do servidor Baileys.
  - `unknown`: qualquer outro.
- **Export de erros:** botão na campanha exporta CSV com colunas `phone,name,errorType,errorMessage,sentAt`.
- **Log agrupado:** dashboard da campanha mostra contagem por tipo de erro (ex: "12 not_on_whatsapp, 3 blocked, 1 timeout").

### 5.13 Limite Diário

- Toggle global em Settings.
- Se ativo: ao tentar enviar, verifica `DailyCounter` do dia. Se `sentCount >= dailyLimitValue`, todas as campanhas pausam (status `paused_daily_limit`) e retomam automaticamente no dia seguinte às 00:01.

### 5.14 Dashboard da Campanha

Cada campanha tem uma página de detalhes com:

- **Header:** nome, status (badge colorido), modo de fluxo, data criada.
- **Cards de métricas:**
  - Total de contatos
  - Enviados
  - Falhados (com breakdown por tipo de erro)
  - Respondidos
  - Pendentes
- **Progress bar** (% concluído).
- **Tabela de contatos** com colunas: nome, telefone, status, última mensagem enviada, tentativas. Filtros por status. Paginação.
- **Timeline de logs em tempo real** (via socket): cada envio aparece como linha "✅ Enviado para José (+5516...) — mensagem 2/3 — 14:32:11".
- **Aba "Respostas recebidas":** lista de `IncomingMessage` da campanha.
- **Ações:** Iniciar / Pausar / Retomar / Cancelar / Exportar Logs CSV / Exportar Erros CSV / Editar (se pausada/draft) / Excluir.

### 5.15 Dashboard Global

- Lista de todas as campanhas (cards) com status e métricas resumidas.
- Indicador de "X / Y campanhas rodando" (com `maxConcurrentCampaigns`).
- Indicador de conexão WhatsApp (verde conectado, vermelho desconectado, amarelo conectando).
- Indicador de modo (TESTE / PRODUÇÃO) com cor de destaque.
- Botão **+ Nova Campanha**.
- Contador "Mensagens enviadas hoje: X / Y" se limite diário ativo.

---

## 6. Fluxos de Negócio

### 6.1 Fluxo: Primeira execução

1. Usuário clona repo, copia `.env.example` → `.env`, preenche `TEST_PHONE_NUMBER`.
2. Roda `npm install` na raiz (script `postinstall` roda nos dois subprojetos).
3. Roda `npm run db:migrate` (Prisma).
4. Roda `npm run dev`.
5. Abre `http://localhost:5173`.
6. Frontend detecta WhatsApp desconectado → mostra modal com QR code.
7. Usuário escaneia QR no celular → conexão estabelecida → modal fecha.
8. Usuário está pronto para criar campanha.

### 6.2 Fluxo: Criar e disparar campanha

1. Dashboard → **+ Nova Campanha**.
2. Preenche nome, escolhe modo de fluxo, faz upload do CSV.
3. Tela mostra resumo: "187 celulares válidos importados, 23 fixos descartados, 5 inválidos, 12 duplicados".
4. Adiciona mensagens (botão + Adicionar mensagem) — cada uma com suas variações (+ Adicionar variação).
5. (Opcional) Anexa imagem + legenda.
6. Define delays min/max, toggles.
7. Escolhe "Disparar agora" ou agenda data/hora.
8. Confirma → campanha vai pra `running` ou `scheduled` ou `queued`.
9. Redireciona para página de detalhes da campanha — usuário acompanha em tempo real.

### 6.3 Fluxo: Pausar para editar

1. Usuário clica **Pausar** em campanha rodando.
2. Status vira `pausing`. UI mostra "Aguardando 3 contatos finalizarem sequência...".
3. Quando todos os `in_progress` terminam → status `paused`.
4. Botão **Editar** fica disponível.
5. Usuário edita mensagens, salva.
6. Clica **Retomar** → status `running`. Contatos `pending` recebem as **novas** mensagens; contatos `completed` ficam intocados.

---

## 7. API Backend

Base: `http://localhost:3001/api`

### WhatsApp
- `GET /whatsapp/status` — retorna `{ connected, qr?, phone? }`
- `POST /whatsapp/logout` — desconecta e limpa sessão

### Configurações
- `GET /settings`
- `PUT /settings` — body: `{ mode, maxConcurrentCampaigns, dailyLimitEnabled, dailyLimitValue, defaultMinDelaySec, defaultMaxDelaySec, simulateTyping }`

### Contatos
- `POST /contacts/upload` — multipart com `file` (CSV) → retorna resumo de parsing
- `GET /contacts?search=&page=&limit=` — lista contatos
- `DELETE /contacts/:id`

### Campanhas
- `GET /campaigns` — lista
- `POST /campaigns` — cria (multipart se tem imagem)
- `GET /campaigns/:id` — detalhes + métricas
- `PUT /campaigns/:id` — edita (só se paused/draft)
- `DELETE /campaigns/:id`
- `POST /campaigns/:id/start`
- `POST /campaigns/:id/pause`
- `POST /campaigns/:id/resume`
- `POST /campaigns/:id/cancel`
- `GET /campaigns/:id/contacts?status=&page=` — lista de `CampaignContact`
- `GET /campaigns/:id/logs?page=` — lista de `SendLog`
- `GET /campaigns/:id/replies` — lista de `IncomingMessage`
- `GET /campaigns/:id/export/logs.csv`
- `GET /campaigns/:id/export/errors.csv`
- `PUT /campaigns/queue/reorder` — body: `{ orderedIds: [...] }`

### Mensagens (gerenciamento dentro da campanha)
Operações de mensagens/variações são feitas dentro do PUT da campanha (payload aninhado).

---

## 8. WebSocket Events

Canal único, todos os eventos namespaced.

**Servidor → Cliente:**
- `whatsapp:qr` — `{ qr: string }`
- `whatsapp:connected` — `{ phone: string }`
- `whatsapp:disconnected` — `{ reason: string }`
- `campaign:status_changed` — `{ campaignId, status, metrics }`
- `campaign:message_sent` — `{ campaignId, contactId, phone, firstName, messageOrder, variationContent, sentAt }`
- `campaign:message_failed` — `{ campaignId, contactId, phone, errorType, errorMessage }`
- `campaign:reply_received` — `{ campaignId, contactId, phone, content, receivedAt }`
- `campaign:progress` — `{ campaignId, sentCount, failedCount, totalContacts }`
- `daily_limit:reached` — `{ count, limit }`

**Cliente → Servidor:** nenhum (todas as ações vão por HTTP REST).

---

## 9. Frontend — Telas e Componentes

### 9.1 Layout geral

- **Sidebar esquerda fixa** (collapse opcional):
  - Logo + nome do projeto
  - Dashboard (ícone home)
  - Campanhas (lista)
  - Contatos (base global)
  - Configurações
- **Header superior:**
  - Indicador conexão WhatsApp (badge)
  - **Switch grande TESTE / PRODUÇÃO** com cores distintas (amarelo/vermelho)
  - Contador "Hoje: 47 / 200" (se limite ativo)
- **Conteúdo principal**

### 9.2 Tela: Dashboard

- Grid de cards de campanhas (3 colunas em desktop).
- Cada card: nome, status badge, progress bar, métricas mini, botões rápidos (pausar/retomar/abrir).
- Botão flutuante **+ Nova Campanha**.

### 9.3 Tela: Nova Campanha

Multi-step (stepper) ou single page longa, à escolha do agente. Sugestão: single page com seções colapsáveis.

Seções:
1. Informações básicas (nome, modo de fluxo)
2. Contatos (upload CSV ou pick da base)
3. Mensagens (lista editável de mensagens + variações)
4. Mídia (upload de imagem opcional + legenda)
5. Configurações de envio (delays, toggles)
6. Agendamento (radio: agora / data+hora)
7. Revisão e disparo

### 9.4 Tela: Detalhes da Campanha

Já detalhada na seção [5.14](#514-dashboard-da-campanha).

### 9.5 Tela: Contatos

- Tabela paginada de todos os contatos importados.
- Busca por nome ou número.
- Botão de upload em massa (mesmo endpoint).
- Excluir individualmente.

### 9.6 Tela: Configurações

- Todos os campos de `Settings`.
- Botão **Desconectar WhatsApp**.
- Botão **Resetar banco** (apaga tudo, com double-confirm).

### 9.7 Modal QR Code

- Aparece automaticamente se desconectado.
- Mostra QR atual (atualiza via socket).
- Texto: "Abra o WhatsApp no seu celular → Aparelhos conectados → Conectar um aparelho → Escaneie".

### 9.8 Tema

- Light + Dark mode (toggle).
- Paleta principal: verde WhatsApp (`#25D366`) como accent.
- Cores de status:
  - `draft`: cinza
  - `scheduled`: azul
  - `queued`: roxo
  - `running`: verde pulsante
  - `pausing`: amarelo
  - `paused`: laranja
  - `completed`: verde escuro
  - `failed`: vermelho

---

## 10. Variáveis de Ambiente

`.env.example` (versionado):

```env
# Servidor
PORT=3001
NODE_ENV=development

# Frontend (Vite, usa prefixo VITE_)
VITE_API_URL=http://localhost:3001/api
VITE_SOCKET_URL=http://localhost:3001

# WhatsApp - Modo Teste
# Formato E.164 sem espaços (ex: +5516991831382)
TEST_PHONE_NUMBER=+5516999999999

# Banco
DATABASE_URL="file:./data/database.db"

# Logs
LOG_LEVEL=info
```

`.env` real (NÃO versionado) — o usuário copia e preenche.

---

## 11. Instalação e Execução

### Pré-requisitos
- Node.js 20+
- npm 10+

### Passos

```bash
# 1. Clonar
git clone https://github.com/SEU_USUARIO/whatsapp-campaign-sender.git
cd whatsapp-campaign-sender

# 2. Configurar variáveis
cp .env.example .env
# Editar .env e preencher TEST_PHONE_NUMBER

# 3. Instalar dependências (raiz instala recursivamente)
npm install

# 4. Rodar migrations
npm run db:migrate

# 5. Subir tudo
npm run dev
```

Abrir `http://localhost:5173`.

### Scripts raiz (`package.json`)

```json
{
  "scripts": {
    "dev": "concurrently \"npm:dev:backend\" \"npm:dev:frontend\"",
    "dev:backend": "npm --prefix backend run dev",
    "dev:frontend": "npm --prefix frontend run dev",
    "db:migrate": "npm --prefix backend run db:migrate",
    "db:studio": "npm --prefix backend run db:studio",
    "build": "npm --prefix frontend run build",
    "postinstall": "npm --prefix backend install && npm --prefix frontend install"
  }
}
```

---

## 12. Segurança e Open Source

### Repositório público no GitHub

Este projeto é **open-source com licença MIT**. Cuidados obrigatórios:

### `.gitignore` (raiz)

```gitignore
# Node
node_modules/
npm-debug.log*
yarn-debug.log*

# Env
.env
.env.local
.env.*.local

# Backend - dados sensíveis
backend/data/
backend/uploads/
backend/logs/
backend/prisma/migrations/dev.db*

# Build
frontend/dist/
backend/dist/

# Editor
.vscode/
.idea/
*.swp
.DS_Store

# Logs
*.log
```

### Conteúdo sensível que JAMAIS deve ser commitado

- `backend/data/auth/` — credenciais Baileys (acesso ao WhatsApp).
- `backend/data/database.db` — contém todos os contatos, mensagens, logs.
- `backend/uploads/` — CSVs e imagens dos usuários.
- `.env` — pode conter número de telefone pessoal.

### `LICENSE`

Arquivo MIT padrão na raiz.

### `README.md` público

Versão resumida deste documento, focada em "o que é", "como instalar", "como usar", "screenshots", "contribuindo", "licença".

### Disclaimer obrigatório no README

> ⚠️ **Aviso legal:** este projeto é uma ferramenta técnica de automação. O uso para envio de mensagens não solicitadas (spam) viola os Termos de Serviço do WhatsApp e pode resultar em banimento da conta. O usuário é o único responsável pelo uso. Recomenda-se enviar apenas para contatos que consentiram em receber mensagens.

---

## 13. Anti-Ban — Boas Práticas (já implementadas)

1. ✅ **Delays aleatórios** entre mensagens (configuráveis).
2. ✅ **Variações de mensagem** — mesma intenção, textos diferentes.
3. ✅ **Simulação de digitação** (`presence: composing`) antes do envio.
4. ✅ **Limite diário** configurável.
5. ✅ **Validação prévia** de números no WhatsApp (`sock.onWhatsApp()`).
6. ✅ **Sem auto-reply** — bot não responde nada.
7. ✅ **Pausa automática** ao detectar muitas falhas consecutivas (se >10 `blocked` ou `not_on_whatsapp` em sequência, pausar e alertar).
8. ✅ **Aquecimento sugerido** — UI sugere começar com volumes pequenos (50/dia) e aumentar gradualmente.

---

## 14. Checklist de Entrega

O agente deve garantir que ao final:

- [ ] `npm install` na raiz instala tudo sem erro.
- [ ] `npm run dev` sobe backend (porta 3001) e frontend (porta 5173) simultaneamente.
- [ ] QR code aparece no frontend e conecta após escaneio.
- [ ] Upload de CSV com mix de fixos/celulares filtra corretamente.
- [ ] Nome "José Advocacia X2" salva como "José".
- [ ] Criar campanha completa com 3 mensagens, 2 variações cada, imagem, agendamento.
- [ ] Disparar em modo teste manda tudo pro `TEST_PHONE_NUMBER`.
- [ ] Pausar campanha rodando aguarda contatos em andamento finalizarem.
- [ ] Retomar continua de onde parou.
- [ ] Edição só funciona em paused/draft.
- [ ] 2+ campanhas simultâneas respeitam `maxConcurrentCampaigns`.
- [ ] Resposta de contato marca como `replied` e pula restante (se toggle ativo).
- [ ] Export CSV de erros funciona e está agrupado por tipo.
- [ ] Dashboard atualiza em tempo real via WebSocket.
- [ ] Modo TESTE / PRODUÇÃO troca corretamente e é destacado na UI.
- [ ] `.gitignore` cobre todos os arquivos sensíveis.
- [ ] `README.md` público escrito.
- [ ] `LICENSE` MIT presente.
- [ ] Disclaimer legal no README.

---

## 📦 Entregáveis finais

1. Código completo do monorepo.
2. `README.md` resumido para o GitHub (este documento atual fica como `DOCS.md` ou similar).
3. `.env.example` preenchido com placeholders.
4. Migrations do Prisma versionadas.
5. Documentação inline (JSDoc nos services principais).

---

**Fim da documentação.** Qualquer ambiguidade encontrada durante a implementação deve ser resolvida em favor de: simplicidade > funcionalidade > robustez anti-ban > performance.
