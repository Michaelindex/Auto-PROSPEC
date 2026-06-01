# WhatsApp Campaign Sender (Baileys)

> Sistema local e open-source para disparo controlado de campanhas no WhatsApp via Baileys, com frontend web para gestão de campanhas, contatos, variações de mensagem, agendamento, relatórios e módulo de respostas com chat manual em tempo real.

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Stack Técnica](#2-stack-técnica)
3. [Estrutura do Projeto](#3-estrutura-do-projeto)
4. [Modelo de Dados (SQLite + Prisma)](#4-modelo-de-dados-sqlite--prisma)
5. [Funcionalidades Detalhadas](#5-funcionalidades-detalhadas)
6. [Fluxos de Negócio](#6-fluxos-de-negócio)
7. [API Backend](#7-api-backend)
8. [WebSocket Events](#8-websocket-events)
9. [Frontend — Telas e Componentes](#9-frontend--telas-e-componentes)
10. [Sincronização em Tempo Real](#10-sincronização-em-tempo-real)
11. [Variáveis de Ambiente](#11-variáveis-de-ambiente)
12. [Instalação e Execução](#12-instalação-e-execução)
13. [Segurança e Open Source](#13-segurança-e-open-source)
14. [Anti-Ban — Boas Práticas](#14-anti-ban--boas-práticas)
15. [Checklist de Entrega](#15-checklist-de-entrega)

---

## 1. Visão Geral

### O que é

Sistema **local** (rodando na máquina do usuário) que conecta-se ao WhatsApp pessoal via [Baileys](https://github.com/WhiskeySockets/Baileys) e dispara campanhas de mensagens para listas de contatos importadas via CSV. Tem um frontend web próprio para gerenciar todo o ciclo de vida das campanhas, além de um **módulo de chat manual** (Respostas) onde o operador pode responder mensagens recebidas diretamente pela interface.

### O que NÃO é

- **Não é um chatbot.** O sistema apenas dispara mensagens iniciais e permite respostas **manuais** do operador; nunca responde automaticamente.
- **Não tem autenticação.** Roda local, sem login, sem usuários. É single-user por design.
- **Não é multi-tenant.** Uma instalação = uma conta WhatsApp = um usuário operando.

### Princípios de design

- **Simples e funcional** — sem over-engineering.
- **Controle total do usuário** — todos os parâmetros (delays, limites, modo) são configuráveis pela UI.
- **Anti-ban first** — delays aleatórios, variações de mensagem, simulação de digitação, limites diários.
- **Transparência** — todos os envios, erros e respostas ficam logados e visíveis em dashboard.
- **Sincronização em tempo real** — Socket.IO garante que UI, histórico de chat e contadores de não-lidas atualizem instantaneamente em todos os clientes conectados.

---

## 2. Stack Técnica

### Backend
- **Runtime:** Node.js 20+
- **Framework:** Express
- **WhatsApp:** `@whiskeysockets/baileys` (v6.7.9+, versão estável)
- **ORM:** Prisma
- **Banco:** SQLite (arquivo local em `backend/data/database.db`)
- **Realtime:** Socket.IO (servidor) — `socket.io`
- **Upload de arquivos:** `multer`
- **Parser de CSV:** `csv-parse`
- **Validação de telefone:** `libphonenumber-js`
- **Agendamento:** setTimeout + persistência no DB (sobrevive a restarts)
- **Logger:** pino com saída para `backend/logs/`

### Frontend
- **Framework:** React 18
- **Bundler:** Vite
- **Estilo:** TailwindCSS
- **Componentes:** shadcn/ui
- **Ícones:** lucide-react
- **HTTP:** axios
- **Realtime:** socket.io-client
- **Estado:** Zustand (useChatStore, useCampaignsStore, useWhatsAppStore)
- **Roteamento:** react-router-dom
- **Toast/notificações:** sonner
- **Forms:** react-hook-form + zod

### Monorepo
- Pastas `/backend` e `/frontend` na raiz.
- `package.json` raiz com script `npm run dev` que sobe os dois em paralelo via `concurrently`.

---

## 3. Estrutura do Projeto

```
Auto-PROSPEC/
├── .gitignore
├── .env.example
├── package.json                     # scripts raiz (concurrently)
│
├── docs/
│   └── README.md                    # esta documentação
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
│   │   ├── images/                  # imagens de campanhas
│   │   └── chat/                    # mídias do módulo de chat
│   ├── logs/                        # IGNORADO no git
│   └── src/
│       ├── index.js                 # entrypoint Express + Socket.IO
│       ├── config/
│       │   └── env.js
│       ├── routes/
│       │   ├── campaigns.routes.js
│       │   ├── contacts.routes.js
│       │   ├── whatsapp.routes.js
│       │   ├── settings.routes.js
│       │   └── chat.routes.js
│       ├── controllers/
│       │   └── chat.controller.js
│       ├── services/
│       │   ├── whatsapp.service.js  # conexão Baileys + recepção de msgs
│       │   ├── campaign.service.js  # orquestra disparo
│       │   ├── csv.service.js       # parse + classificação fixo/celular
│       │   ├── scheduler.service.js # agendamentos
│       │   ├── queue.service.js     # fila de campanhas simultâneas
│       │   └── chat.service.js      # chat manual + histórico unificado
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
        ├── App.jsx                  # bootstrap: socket listeners globais
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
        │   ├── ModeSwitch.jsx
        │   └── chat/
        │       ├── CampaignSelector.jsx
        │       ├── ContactList.jsx
        │       ├── ContactListItem.jsx
        │       ├── ChatWindow.jsx
        │       ├── ChatMessage.jsx
        │       ├── ChatInput.jsx
        │       └── ChatSearchBar.jsx
        ├── pages/
        │   ├── Dashboard.jsx
        │   ├── NewCampaign.jsx
        │   ├── CampaignDetail.jsx
        │   ├── Settings.jsx
        │   └── Respostas.jsx
        ├── store/
        │   ├── useWhatsAppStore.js
        │   ├── useCampaignsStore.js
        │   └── useChatStore.js
        ├── services/
        │   ├── api.js
        │   └── socket.js
        └── lib/
            └── utils.js
```

---

## 4. Modelo de Dados (SQLite + Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Settings {
  id                    Int      @id @default(1)
  mode                  String   @default("test")        // "test" | "production"
  maxConcurrentCampaigns Int     @default(1)
  dailyLimitEnabled     Boolean  @default(false)
  dailyLimitValue       Int      @default(200)
  defaultContactDelayMinSec Int  @default(30)   // entre contatos
  defaultContactDelayMaxSec Int  @default(90)
  defaultMsgDelayMinSec     Int  @default(5)    // entre mensagens do mesmo contato
  defaultMsgDelayMaxSec     Int  @default(15)
  simulateTyping        Boolean  @default(true)
  updatedAt             DateTime @updatedAt
}

model Campaign {
  id              String   @id @default(cuid())
  name            String
  status          String   @default("draft")
  // draft | scheduled | queued | running | paused | completed | failed
  flowMode        String
  // "sequential_per_contact" | "broadcast" | "shuffled"
  contactDelayMinSec Int   @default(30)   // espera para trocar de contato (faixa aleatória)
  contactDelayMaxSec Int   @default(90)
  msgDelayMinSec     Int   @default(5)    // espera entre mensagens do mesmo contato (faixa aleatória)
  msgDelayMaxSec     Int   @default(15)
  simulateTyping  Boolean  @default(true)
  scheduledAt     DateTime?
  startedAt       DateTime?
  pausedAt        DateTime?
  completedAt     DateTime?
  imagePath       String?
  imageCaption    String?
  stopOnReply     Boolean  @default(true)
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
  order       Int
  campaign    Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  variations  MessageVariation[]
  @@unique([campaignId, order])
}

model MessageVariation {
  id          String   @id @default(cuid())
  messageId   String
  content     String                           // suporta {nome}
  message     Message  @relation(fields: [messageId], references: [id], onDelete: Cascade)
}

model Contact {
  id                      String    @id @default(cuid())
  phone                   String    @unique                // E.164: +5516991831382
  firstName               String
  rawName                 String
  type                    String                           // "mobile" | "landline"
  profilePictureUrl       String?                         // URL cacheada da foto de perfil
  profilePictureUpdatedAt DateTime?                       // controle de TTL (24h)
  createdAt               DateTime  @default(now())
  campaigns               CampaignContact[]
  manualMessages          ManualMessage[]
}

model CampaignContact {
  id              String    @id @default(cuid())
  campaignId      String
  contactId       String
  status          String    @default("pending")
  // pending | in_progress | completed | failed | replied | skipped
  currentMsgOrder Int       @default(0)
  lastSentAt      DateTime?
  repliedAt       DateTime?
  unreadCount     Int       @default(0)         // msgs recebidas não lidas pelo operador
  lastReadAt      DateTime?                     // última vez que o operador abriu a conversa
  campaign        Campaign        @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  contact         Contact         @relation(fields: [contactId], references: [id])
  manualMessages  ManualMessage[]
  @@unique([campaignId, contactId])
}

model SendLog {
  id              String   @id @default(cuid())
  campaignId      String
  contactId       String
  phone           String
  messageOrder    Int
  variationUsed   String?
  status          String                        // "sent" | "failed"
  errorType       String?
  errorMessage    String?
  sentAt          DateTime @default(now())
  campaign        Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
}

model IncomingMessage {
  id          String   @id @default(cuid())
  fromPhone   String
  fromName    String?
  content     String
  campaignId  String?
  receivedAt  DateTime @default(now())
}

model ManualMessage {
  id                  String    @id @default(cuid())
  campaignContactId   String
  contactId           String
  direction           String                           // "out" | "in"
  content             String?
  mediaPath           String?
  mediaType           String?                          // "image" | "document" | "audio" | "video"
  mediaCaption        String?
  whatsappMessageId   String?                          // ID do Baileys (para ticks de leitura)
  status              String    @default("sent")       // "sent" | "delivered" | "read" | "failed"
  sentAt              DateTime  @default(now())
  deliveredAt         DateTime?
  readAt              DateTime?
  campaignContact     CampaignContact @relation(fields: [campaignContactId], references: [id], onDelete: Cascade)
  contact             Contact         @relation(fields: [contactId], references: [id])
}

model DailyCounter {
  date         String   @id                    // "YYYY-MM-DD"
  sentCount    Int      @default(0)
}
```

---

## 5. Funcionalidades Detalhadas

### 5.1 Conexão WhatsApp (Baileys)

- Ao iniciar o backend, tenta restaurar sessão de `backend/data/auth/`.
- Se não houver sessão, gera QR code e emite via WebSocket (`whatsapp:qr`) para o frontend exibir num modal.
- Quando escaneado, salva credenciais e emite `whatsapp:connected`.
- Reconecta automaticamente (delays de 5s e 10s) exceto em `loggedOut`.
- **Resolução de JID:** suporte ao novo formato `@lid` do WhatsApp (além do formato legado `@s.whatsapp.net`). A função `resolveSendJid()` testa o formato LID primeiro e faz fallback para o formato PN.
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
1. Aceita separadores `,` ou `;`.
2. Header opcional (detecta se primeira linha tem "nome"/"numero"; senão assume ordem nome, numero).
3. **Nome:** trim → split por espaço → `parts[0]` capitalizado. Ex: `"JOSÉ ADVOCACIA X2"` → `"José"`.
4. **Número:**
   - Remove tudo que não for dígito ou `+`.
   - Se não começar com `+`, assume Brasil (`+55`).
   - Valida com `libphonenumber-js`.
   - Classificação (BR): após `+55` + DDD, dígito `9` = celular ✅, dígitos `2–5` = fixo ❌.
5. **Deduplicação:** ignora números repetidos dentro do mesmo CSV.
6. **Persistência:** UPSERT em `Contact` por `phone`.
7. **Resposta:** `{ total, mobile, landline, invalid, duplicates, savedContactIds }`.

### 5.3 Criação de Campanha

| Campo | Tipo | Obrigatório |
|---|---|---|
| Nome da campanha | texto | sim |
| Modo de fluxo | radio | sim |
| Lista de contatos | CSV ou base existente | sim |
| Mensagens em sequência | array dinâmico | sim |
| Variações por mensagem | array por mensagem | sim |
| Imagem única | upload PNG/JPG (máx 5MB) | não |
| Legenda da imagem | texto | não |
| Delay troca de contato — min/máx (seg) | número | sim |
| Delay entre mensagens do mesmo contato — min/máx (seg) | número | sim |
| Simular digitando | toggle | — |
| Parar se cliente responder | toggle | — |
| Quando disparar | agora / agendado | sim |

### 5.4 Variações de Mensagem

- Cada mensagem tem N variações.
- No envio, o sistema sorteia aleatoriamente uma variação para cada contato/mensagem.
- Variável suportada: `{nome}` → substituída pelo `firstName` do contato.

### 5.5 Disparo de Mensagens

**Algoritmo (modo `sequential_per_contact`):**

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
    se simulateTyping: enviar presence "composing" antes do envio
    registrar SendLog
    incrementar DailyCounter
    se ainda há próxima mensagem: delay aleatório entre msgDelayMinSec e msgDelayMaxSec
  marcar C.status = completed
  delay aleatório entre contactDelayMinSec e contactDelayMaxSec (antes do próximo contato)
```

**Modo `broadcast`:** itera mensagens externamente, contatos internamente.

**Modo `shuffled`:** fila `[(C1,M1), (C2,M1), (C1,M2), ...]` embaralhada, respeitando ordem de mensagens por contato.

### 5.6 Modo Teste vs Produção

- Switch global em `Settings.mode` (sempre visível no header).
- **Modo teste:** todas as mensagens vão para `TEST_PHONE_NUMBER` com prefixo:
  ```
  [TESTE - Campanha: NomeDaCampanha] [Contato fictício: {nome}]
  
  {mensagem original}
  ```
- **Modo produção:** envia para os números reais.
- Trocar o modo durante campanha ativa pausa todas imediatamente.

### 5.7 Agendamento

- `scheduledAt null` ou no passado → dispara imediato.
- `scheduledAt` no futuro → status `scheduled`. Job interno (intervalo 30s) verifica e move pra fila.
- Persiste restarts.

### 5.8 Pausa e Retomada

- **Pausar:** para de iniciar novos contatos. Contatos `in_progress` finalizam sua sequência. Status intermediário: `pausing` → `paused`.
- **Retomar:** volta para `running` (ou `queued` se limite de simultâneas atingido). Continua de onde parou.

### 5.9 Edição

- Só é possível editar campanha com status `paused` ou `draft`.

### 5.10 Fila de Campanhas Simultâneas

- `Settings.maxConcurrentCampaigns` define o limite.
- Quando nova campanha é iniciada: `runningCount < max` → `running`, senão → `queued`.
- Quando campanha finaliza/pausa → próxima `queued` (FIFO por `createdAt`) vira `running`.

### 5.11 Detecção e Registro de Respostas

- `messages.upsert` do Baileys captura mensagens recebidas.
- **Suporte ao formato LID do WhatsApp:** o número é extraído tanto do campo `remoteJid` quanto do `sender`, com tratamento para o novo formato `@lid`.
- Se a mensagem vem de um contato ativo em campanhas:
  - Cria `IncomingMessage`.
  - Marca `CampaignContact.status = 'replied'`, `repliedAt = now()`.
  - **Para CADA campanha** onde o telefone aparece: salva `ManualMessage { direction: 'in' }`, incrementa `unreadCount`.
  - Emite `chat:new_message` e `chat:unread_updated` via Socket.IO.
- O bot **nunca** envia resposta automática.

### 5.12 Falhas e Relatórios

- Cada tentativa gera `SendLog`.
- Tipos de erro: `not_on_whatsapp`, `invalid_number`, `blocked`, `timeout`, `unknown`.
- Export CSV de erros por campanha.
- Dashboard agrupa erros por tipo.

### 5.13 Limite Diário

- Toggle global em Settings.
- Ao atingir `dailyLimitValue`, campanhas pausam (`paused_daily_limit`) e retomam às 00:01.

### 5.14 Dashboard da Campanha

- Métricas: total, enviados, falhados (por tipo), respondidos, pendentes.
- Progress bar e timeline em tempo real (via Socket.IO).
- Aba "Respostas recebidas": lista de `IncomingMessage`.
- Ações: Iniciar / Pausar / Retomar / Cancelar / Exportar Logs / Exportar Erros / Editar / Excluir.

### 5.15 Dashboard Global

- Grid de cards de campanhas.
- Indicador de conexão WhatsApp e modo (TESTE/PRODUÇÃO).
- Contador "Mensagens enviadas hoje: X / Y".
- Botão "+ Nova Campanha".

### 5.16 Módulo de Respostas — Chat Manual por Campanha

#### Visão geral

Interface estilo WhatsApp Web integrada ao sistema. Permite ao operador visualizar e responder manualmente às mensagens de todos os contatos de cada campanha, com histórico unificado (mensagens automáticas + recebidas + manuais), contadores de não-lidas em tempo real e suporte a envio de texto e mídia.

#### Acesso e navegação

- Item **"Respostas"** no menu lateral com badge numérico (soma de todos os `unreadCount`).
- Rota `/respostas` — seletor de campanha centralizado.
- Rota `/respostas/:campaignId` — layout split 25%/75%.

#### Layout

```
┌─────────────────────┬──────────────────────────────────────────────────┐
│   PAINEL ESQUERDO   │              PAINEL DIREITO                       │
│      (~25%)         │                 (~75%)                            │
│  [Campanha: Nome ▼] │  ┌ José Andrade — +5516991831382 ──────────────┐ │
│  [🔍 Buscar...]     │  │                                               │ │
│  [Todos][Não lidos] │  │  [msg automática campanha]  14:20 ✓✓         │ │
│  [Lidos]            │  │  [resposta do contato]          14:35        │ │
│                     │  │  [msg manual operador]      14:40 ✓✓🔵      │ │
│ ┌─────────────────┐ │  └─────────────────────────────────────────────┘ │
│ │ 📷 José Andrade │ │                                                   │
│ │ Última msg...   │ │  ┌─────────────────────────────────────────────┐  │
│ │ 14:40  ✓✓  2   │ │  │  📎  │  Digite uma mensagem...    │  [Enviar]│  │
│ └─────────────────┘ │  └─────────────────────────────────────────────┘  │
└─────────────────────┴──────────────────────────────────────────────────┘
```

#### Painel Esquerdo — Lista de Contatos

- **Todos** os contatos da campanha aparecem (não só quem respondeu).
- Cada item: foto de perfil (ou avatar com iniciais), `rawName`, prévia da última mensagem, timestamp, badge de não-lidas, ícone de tick.
- **Ordenação:** não-lidos primeiro, depois por timestamp (mais recente no topo).
- **Busca:** filtra por `rawName` ou telefone em tempo real.
- **Filtros rápidos:** Todos / Não lidos / Lidos.

#### Painel Direito — Janela de Chat

- Histórico **unificado e cronológico** mesclando:
  1. `SendLog` — mensagens automáticas disparadas (tag `[automático]`).
  2. `IncomingMessage` / `ManualMessage { direction: 'in' }` — recebidas do contato.
  3. `ManualMessage { direction: 'out' }` — enviadas manualmente pelo operador.
- Bolhas: enviadas à direita (verde), recebidas à esquerda (cinza).
- Agrupamento por data: separadores "Hoje", "Ontem", "DD/MM/YYYY".
- Ticks de status: `✓` enviado, `✓✓` cinza entregue, `✓✓` azul lido.
- Scroll automático para a mensagem mais recente.
- Paginação infinita (scroll para cima carrega mensagens mais antigas, 50 por página).

#### Input de Mensagem

- Campo multi-linha. `Enter` envia, `Shift+Enter` quebra linha.
- Botão 📎: seleciona imagem (PNG/JPG/WEBP ≤ 10MB), documento (PDF/DOCX/XLSX ≤ 16MB), áudio, vídeo.
- Pré-visualização de mídia com botão de cancelar.
- Legenda opcional (apenas imagem/vídeo).
- Botão Enviar desabilitado se input vazio e sem mídia.

#### Foto de Perfil — Estratégia de Cache

- TTL: 24 horas.
- Buscada via `sock.profilePictureUrl(jid, 'image')` de forma assíncrona ao carregar contatos.
- URL salva em `Contact.profilePictureUrl` com timestamp em `profilePictureUpdatedAt`.
- Fallback: avatar gerado com iniciais do `rawName`.
- Refresh forçado via `GET /contacts/:id/profile-picture/refresh`.

#### Leitura e Contagem de Não-Lidos

- Ao abrir uma conversa: `unreadCount` zerado, `lastReadAt` atualizado, evento `chat:unread_updated` emitido.
- Mensagens recebidas com conversa fechada: `unreadCount += 1`, badge no menu e no item da lista atualizam via Socket.IO.
- Mensagens recebidas com conversa aberta: `POST .../read` chamado automaticamente.

#### Ticks de Status (Read Receipts)

- Baileys emite `message-receipt.update`:
  - `delivery_ack` → `status = 'delivered'`, `deliveredAt = now()`
  - `read` ou `played` → `status = 'read'`, `readAt = now()`
- Backend atualiza `ManualMessage` via `whatsappMessageId`.
- Frontend recebe `chat:message_status` e re-renderiza o ícone do tick.

---

## 6. Fluxos de Negócio

### 6.1 Primeira execução

1. Clonar repo, copiar `.env.example` → `.env`, preencher `TEST_PHONE_NUMBER`.
2. `npm install` na raiz.
3. `npm run db:migrate`.
4. `npm run dev`.
5. Abrir `http://localhost:5173`.
6. Modal QR code aparece → escanear → conexão estabelecida.

### 6.2 Criar e disparar campanha

1. Dashboard → "+ Nova Campanha".
2. Preencher nome, modo de fluxo, upload CSV.
3. Tela mostra resumo do parsing.
4. Adicionar mensagens e variações.
5. Configurar delays, toggles, agendamento.
6. Confirmar → campanha vai para `running`, `scheduled` ou `queued`.
7. Redireciona para detalhes com acompanhamento em tempo real.

### 6.3 Pausar para editar

1. Clicar **Pausar** → status `pausing`.
2. UI mostra "Aguardando contatos finalizarem...".
3. Quando sem `in_progress` → status `paused`.
4. Editar mensagens, salvar, clicar **Retomar**.
5. Contatos `pending` recebem as novas mensagens.

### 6.4 Receber e responder mensagem no módulo de Respostas

1. Contato responde no WhatsApp.
2. Baileys emite `messages.upsert`.
3. Backend identifica o contato, incrementa `unreadCount`, salva `ManualMessage { direction: 'in' }`.
4. Socket.IO emite `chat:new_message` e `chat:unread_updated`.
5. Frontend atualiza badge do menu e item na lista sem recarregar.
6. Operador clica no contato → conversa abre, `unreadCount` zerado, `POST .../read` enviado.
7. Operador digita resposta e clica Enviar → `POST .../messages` → Baileys envia → `ManualMessage { direction: 'out' }` salvo → socket `chat:new_message` emitido → bolha aparece para todos os clientes.

---

## 7. API Backend

Base: `http://localhost:3001/api`

### WhatsApp
- `GET /whatsapp/status` — `{ connected, qr?, phone? }`
- `POST /whatsapp/logout` — desconecta e limpa sessão

### Configurações
- `GET /settings`
- `PUT /settings` — atualiza campos de `Settings`

### Contatos
- `POST /contacts/upload` — multipart com `file` (CSV) → resumo de parsing
- `GET /contacts?search=&page=&limit=` — lista contatos
- `DELETE /contacts/:id`
- `GET /contacts/:id/profile-picture/refresh` — força re-fetch da foto via Baileys

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
- `GET /campaigns/:id/contacts?status=&page=`
- `GET /campaigns/:id/logs?page=`
- `GET /campaigns/:id/replies`
- `GET /campaigns/:id/export/logs.csv`
- `GET /campaigns/:id/export/errors.csv`
- `PUT /campaigns/queue/reorder` — `{ orderedIds: [...] }`

### Chat / Respostas
- `GET /chat/summary` — `{ totalUnread, campaigns: [{ campaignId, name, unreadCount }] }`
- `GET /chat/:campaignId/contacts?search=&filter=all|unread|read&page=&limit=`
  - Resposta por contato: `{ contactId, rawName, phone, profilePictureUrl, lastMessage, lastMessageAt, unreadCount, lastMessageStatus, lastMessageDirection }`
- `GET /chat/:campaignId/contacts/:contactId/messages?page=&limit=`
  - Histórico unificado: `{ id, type: "automated"|"incoming"|"manual", direction: "in"|"out", content, mediaPath?, mediaType?, mediaCaption?, status, sentAt, readAt?, isAutomated }`
- `POST /chat/:campaignId/contacts/:contactId/messages` — envia mensagem manual (multipart: `content`, `media`, `mediaCaption`)
- `POST /chat/:campaignId/contacts/:contactId/read` — zera `unreadCount`, atualiza `lastReadAt`

---

## 8. WebSocket Events

Canal único Socket.IO, todos os eventos namespaced.

**Servidor → Cliente:**

| Evento | Payload | Quando |
|---|---|---|
| `whatsapp:qr` | `{ qr: string }` | QR code gerado/atualizado |
| `whatsapp:connected` | `{ phone: string }` | Conexão estabelecida |
| `whatsapp:disconnected` | `{ reason: string }` | Conexão perdida |
| `campaign:status_changed` | `{ campaignId, status, metrics }` | Status da campanha mudou |
| `campaign:message_sent` | `{ campaignId, contactId, phone, firstName, messageOrder, variationContent, sentAt }` | Mensagem automática enviada |
| `campaign:message_failed` | `{ campaignId, contactId, phone, errorType, errorMessage }` | Falha no envio |
| `campaign:reply_received` | `{ campaignId, contactId, phone, content, receivedAt }` | Contato respondeu |
| `campaign:progress` | `{ campaignId, sentCount, failedCount, totalContacts }` | Progresso atualizado |
| `daily_limit:reached` | `{ count, limit }` | Limite diário atingido |
| `chat:new_message` | `{ campaignId, contactId, message: { id, direction, content, mediaPath?, mediaType?, sentAt }, unreadCount }` | Nova mensagem recebida ou enviada manualmente |
| `chat:message_status` | `{ messageId, campaignContactId, status: "delivered"\|"read", deliveredAt?, readAt? }` | Tick de leitura atualizado |
| `chat:unread_updated` | `{ campaignId, contactId, unreadCount, totalUnread }` | Contagem de não-lidas mudou |

**Cliente → Servidor:** nenhum (todas as ações vão por HTTP REST).

---

## 9. Frontend — Telas e Componentes

### 9.1 Layout geral

- **Sidebar esquerda fixa:**
  - Dashboard (home)
  - Campanhas
  - Contatos
  - **Respostas** (com badge de não-lidas)
  - Configurações
- **Header superior:**
  - Indicador conexão WhatsApp
  - Switch grande **TESTE / PRODUÇÃO**
  - Contador "Hoje: X / Y" (se limite ativo)
- **Conteúdo principal**

### 9.2 App.jsx — Bootstrap e Listeners Globais

`AppBootstrap` registra todos os listeners de Socket.IO ao montar:

```javascript
// Listeners no App.jsx
socket.on('whatsapp:qr', ...)          // exibe modal QR
socket.on('whatsapp:connected', ...)   // atualiza store de conexão
socket.on('whatsapp:disconnected', ...)
socket.on('chat:new_message', ...)     // useChatStore.appendMessage()
socket.on('chat:message_status', ...) // useChatStore.updateMessageStatus()
socket.on('chat:unread_updated', ...) // useChatStore.updateUnreadCount()
socket.on('campaign:reply_received', ...)
socket.on('campaign:status_changed', ...)
socket.on('campaign:progress', ...)
```

### 9.3 useChatStore.js — Estado do Chat

Store Zustand com:

```javascript
{
  totalUnread: number,
  campaignsSummary: [{ campaignId, name, unreadCount }],
  contacts: { [campaignId]: { [contactId]: contactData } },
  messages: { [`${campaignId}-${contactId}`]: message[] },
  hasMore: { [key]: boolean }
}

// Ações:
selectCampaign(campaignId)
selectContact(contactId)
markAsRead(campaignId, contactId)
appendMessage(campaignId, contactId, message)
updateMessageStatus(messageId, status, timestamps)
updateUnreadCount({ campaignId, contactId, unreadCount, totalUnread })
```

### 9.4 Tela: Dashboard

- Grid de cards (3 colunas desktop).
- Cada card: nome, status badge, progress bar, métricas, botões rápidos.
- Botão flutuante "+ Nova Campanha".

### 9.5 Tela: Nova Campanha

Single page com seções:
1. Informações básicas
2. Contatos (upload CSV ou pick da base)
3. Mensagens + variações
4. Mídia (imagem + legenda)
5. Configurações de envio
6. Agendamento
7. Revisão e disparo

### 9.6 Tela: Detalhes da Campanha

- Header, métricas, progress bar.
- Tabela de contatos paginada com filtros.
- Timeline de logs em tempo real.
- Aba de respostas recebidas.
- Ações contextuais.

### 9.7 Tela: Respostas (`/respostas` e `/respostas/:campaignId`)

**Painel Esquerdo — `ContactList.jsx`:**
- `CampaignSelector.jsx` no topo.
- `ChatSearchBar.jsx`: busca + filtros Todos/Não lidos/Lidos.
- Lista de `ContactListItem.jsx` (avatar, rawName, prévia, timestamp, badge, ticks).
- Contato ativo destacado.

**Painel Direito — `ChatWindow.jsx`:**
- Cabeçalho fixo com avatar, nome, telefone.
- Área de scroll com `ChatMessage.jsx`:
  - Bolha direita (enviadas): verde.
  - Bolha esquerda (recebidas): cinza.
  - Tag `[automático]` para msgs de campanha.
  - Ticks animados.
  - Renderização de mídia: thumbnail clicável para imagem, ícone para documentos, player nativo para áudio.
  - Separadores de data.
- `ChatInput.jsx` fixo no rodapé.

### 9.8 Modal QR Code

- Aparece automaticamente se desconectado.
- Atualiza QR via socket.
- Instruções de escaneio.

### 9.9 Tema

- Light + Dark mode.
- Paleta: verde WhatsApp (`#25D366`) como accent.
- Cores de status: draft=cinza, scheduled=azul, queued=roxo, running=verde pulsante, pausing=amarelo, paused=laranja, completed=verde escuro, failed=vermelho.

---

## 10. Sincronização em Tempo Real

### 10.1 Arquitetura de Sincronização

O Socket.IO é passado como dependência para os três serviços principais no `index.js`:

```javascript
// backend/src/index.js
const io = new Server(httpServer, { cors: { origin: '*' } });
await initWhatsApp(io);       // passa io para whatsapp.service
initCampaignService(io);      // passa io para campaign.service
initChatService(io);          // passa io para chat.service
```

### 10.2 Fluxo: Mensagem Recebida

```
WhatsApp → Baileys messages.upsert
    ↓
whatsapp.service.js onMessage()
    ↓ Extrai phone (suporte a @lid e @s.whatsapp.net)
    ↓ Download de mídia se presente
    ↓ Busca CampaignContact(s) ativos para o phone
    ↓
Para cada CampaignContact:
    ├── Salva ManualMessage { direction: 'in' }
    ├── CampaignContact.unreadCount += 1
    └── Emite chat:new_message + chat:unread_updated
    ↓
Salva IncomingMessage (log geral)
```

### 10.3 Fluxo: Mensagem Enviada pelo Operador

```
Operador clica Enviar
    ↓
POST /chat/:campaignId/contacts/:contactId/messages
    ↓
chat.service.js sendManualMessage()
    ↓ Salva arquivo de mídia em /uploads/chat/ (se houver)
    ↓ Baileys sock.sendMessage() → retorna whatsappMessageId
    ↓ Salva ManualMessage { direction: 'out', status: 'sent' }
    ↓ Emite chat:new_message para todos os clientes
    ↓
Baileys message-receipt.update (assíncrono)
    ↓ Atualiza ManualMessage.status → 'delivered' ou 'read'
    ↓ Emite chat:message_status
    ↓
Frontend atualiza tick da bolha
```

### 10.4 Fluxo: Conversa Marcada como Lida

```
Operador abre conversa
    ↓
Frontend chama POST .../read automaticamente
    ↓
chat.service.js markConversationRead()
    ↓ CampaignContact.unreadCount = 0
    ↓ CampaignContact.lastReadAt = now()
    ↓ Recalcula totalUnread
    ↓ Emite chat:unread_updated { campaignId, contactId, unreadCount: 0, totalUnread }
    ↓
Todos os clientes conectados atualizam badge do menu e lista de contatos
```

### 10.5 Histórico Unificado — Mesclagem de Fontes

O endpoint `GET /chat/:campaignId/contacts/:contactId/messages` mescla três fontes:

```javascript
// SendLog (mensagens automáticas de campanha)
automated = sendLogs.map(m => ({
  ...m, type: 'automated', direction: 'out',
  content: m.variationUsed, sentAt: m.sentAt
}))

// IncomingMessage (respostas do contato — source alternativa)
// ManualMessage direction:'in' é a fonte principal para o chat

// ManualMessage (manuais enviadas e recebidas)
manual = manualMessages.map(m => ({ ...m, type: 'manual' }))

// Mescla e ordena cronologicamente
unified = [...automated, ...manual].sort((a, b) => a.sentAt - b.sentAt)
```

---

## 11. Variáveis de Ambiente

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

`.env` real (não versionado) — copiar e preencher.

---

## 12. Instalação e Execução

### Pré-requisitos
- Node.js 20+
- npm 10+

### Passos

```bash
# 1. Clonar
git clone <repo-url>
cd Auto-PROSPEC

# 2. Configurar variáveis
cp .env.example .env
# Editar .env e preencher TEST_PHONE_NUMBER

# 3. Instalar dependências
npm install

# 4. Rodar migrations
npm run db:migrate

# 5. Subir tudo
npm run dev
```

Abrir `http://localhost:5173`.

### Scripts raiz

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

## 13. Segurança e Open Source

### `.gitignore` (raiz)

```gitignore
node_modules/
npm-debug.log*

.env
.env.local
.env.*.local

backend/data/
backend/uploads/
backend/logs/
backend/prisma/migrations/dev.db*

frontend/dist/
backend/dist/

.vscode/
.idea/
*.swp
.DS_Store
*.log
```

### Conteúdo sensível que JAMAIS deve ser commitado

- `backend/data/auth/` — credenciais Baileys.
- `backend/data/database.db` — contatos, mensagens, logs.
- `backend/uploads/` — CSVs e mídias.
- `.env` — pode conter número de telefone pessoal.

> **Aviso legal:** este projeto é uma ferramenta técnica de automação. O uso para envio de mensagens não solicitadas (spam) viola os Termos de Serviço do WhatsApp e pode resultar em banimento da conta. O usuário é o único responsável pelo uso. Recomenda-se enviar apenas para contatos que consentiram em receber mensagens.

---

## 14. Anti-Ban — Boas Práticas

1. **Delays aleatórios** entre mensagens (configuráveis por campanha).
2. **Variações de mensagem** — mesma intenção, textos diferentes.
3. **Simulação de digitação** (`presence: composing`) antes do envio.
4. **Limite diário** configurável.
5. **Validação prévia** via `sock.onWhatsApp()` antes de enviar.
6. **Sem auto-reply** — bot nunca responde automaticamente.
7. **Pausa automática** ao detectar muitas falhas consecutivas (>10 `blocked`/`not_on_whatsapp` em sequência).
8. **Aquecimento sugerido** — UI sugere começar com volumes pequenos (50/dia).

---

## 15. Checklist de Entrega

### Core
- [ ] `npm install` na raiz instala tudo sem erro
- [ ] `npm run dev` sobe backend (3001) e frontend (5173)
- [ ] QR code aparece e conecta após escaneio
- [ ] Upload CSV filtra fixos/celulares corretamente
- [ ] Nome "José Advocacia X2" salva como "José"
- [ ] Criar campanha com 3 mensagens, 2 variações cada, imagem, agendamento
- [ ] Modo teste manda tudo para `TEST_PHONE_NUMBER`
- [ ] Pausar aguarda contatos em andamento finalizarem
- [ ] Retomar continua de onde parou
- [ ] Edição só funciona em paused/draft
- [ ] 2+ campanhas simultâneas respeitam `maxConcurrentCampaigns`
- [ ] Resposta de contato marca como `replied`
- [ ] Export CSV de erros funciona
- [ ] Dashboard atualiza em tempo real via WebSocket
- [ ] Modo TESTE/PRODUÇÃO troca corretamente

### Módulo de Respostas
- [ ] Item "Respostas" aparece no menu com badge de não-lidas
- [ ] Seletor de campanha lista todas com contagens de não-lidas
- [ ] Lista de contatos exibe todos (não só quem respondeu)
- [ ] Busca por nome e número funciona em tempo real
- [ ] Filtros Todos / Não lidos / Lidos funcionam
- [ ] Foto de perfil buscada via Baileys e cacheada (TTL 24h); fallback para iniciais
- [ ] Histórico unificado: automáticas + recebidas + manuais em ordem cronológica
- [ ] Mensagens automáticas têm tag `[automático]`
- [ ] Enviar texto pelo ChatInput funciona
- [ ] Enviar imagem com legenda funciona
- [ ] Ticks de status atualizam em tempo real via WebSocket
- [ ] Abrir conversa zera `unreadCount` e atualiza badge do menu
- [ ] Nova mensagem recebida incrementa badge sem recarregar
- [ ] Scroll automático para mensagem mais recente
- [ ] Paginação infinita (scroll para cima carrega mais antigas)
- [ ] Agrupamento de mensagens por data
- [ ] Rota `/respostas/:campaignId` funciona com deep link direto
- [ ] Socket.IO propaga `chat:unread_updated` para todos os clientes conectados

### Infra
- [ ] `.gitignore` cobre todos os arquivos sensíveis
- [ ] `LICENSE` MIT presente
- [ ] Disclaimer legal no README
