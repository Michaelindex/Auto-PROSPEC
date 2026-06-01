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
15. [Módulo de Respostas — Chat Manual por Campanha](#15-módulo-de-respostas--chat-manual-por-campanha)

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
│       │   ├── settings.routes.js
│       │   └── chat.routes.js       # NOVO — módulo de respostas/chat
│       ├── controllers/
│       │   └── chat.controller.js   # NOVO
│       ├── services/
│       │   ├── whatsapp.service.js  # gerencia conexão Baileys
│       │   ├── campaign.service.js  # orquestra disparo
│       │   ├── csv.service.js       # parse + classificação fixo/celular
│       │   ├── scheduler.service.js # agendamentos
│       │   ├── queue.service.js     # fila de campanhas simultâneas
│       │   └── chat.service.js      # NOVO — lógica de chat manual + busca de foto de perfil
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
        │   ├── ModeSwitch.jsx
        │   └── chat/                # NOVO — componentes do módulo de chat
        │       ├── CampaignSelector.jsx   # dropdown/lista para escolher campanha
        │       ├── ContactList.jsx        # painel esquerdo — lista de contatos
        │       ├── ContactListItem.jsx    # linha individual do contato (foto, nome, prévia)
        │       ├── ChatWindow.jsx         # painel direito — área de conversa
        │       ├── ChatMessage.jsx        # bolha individual de mensagem
        │       ├── ChatInput.jsx          # input de texto + upload de mídia
        │       └── ChatSearchBar.jsx      # campo de busca + filtros (Todos/Não lidos/Lidos)
        ├── pages/
        │   ├── Dashboard.jsx        # lista de campanhas + status global
        │   ├── NewCampaign.jsx
        │   ├── CampaignDetail.jsx
        │   ├── Settings.jsx
        │   └── Respostas.jsx        # NOVO — módulo de chat manual por campanha
        ├── store/
        │   ├── useWhatsAppStore.js
        │   ├── useCampaignsStore.js
        │   └── useChatStore.js      # NOVO — estado do chat (contato ativo, mensagens, não lidas)
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
  id                      String   @id @default(cuid())
  phone                   String   @unique                // formato E.164: +5516991831382
  firstName               String                          // primeiro nome extraído
  rawName                 String                          // nome completo original do CSV
  type                    String                          // "mobile" | "landline"
  profilePictureUrl       String?                         // URL da foto de perfil do WhatsApp (cache)
  profilePictureUpdatedAt DateTime?                       // última vez que a foto foi buscada/atualizada
  createdAt               DateTime @default(now())
  
  campaigns       CampaignContact[]
  manualMessages  ManualMessage[]
}

model CampaignContact {
  id              String   @id @default(cuid())
  campaignId      String
  contactId       String
  
  status          String   @default("pending") // pending | in_progress | completed | failed | replied | skipped
  currentMsgOrder Int      @default(0)         // quantas mensagens já recebeu
  lastSentAt      DateTime?
  repliedAt       DateTime?                    // se respondeu, hora da resposta
  unreadCount     Int      @default(0)         // mensagens recebidas não lidas pelo operador no módulo de Respostas
  lastReadAt      DateTime?                    // última vez que o operador abriu a conversa
  
  campaign        Campaign       @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  contact         Contact        @relation(fields: [contactId], references: [id])
  manualMessages  ManualMessage[]
  
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

// Mensagens enviadas manualmente pelo operador via módulo de Respostas
model ManualMessage {
  id                  String   @id @default(cuid())
  campaignContactId   String                          // liga a CampaignContact (campanha + contato)
  contactId           String                          // liga a Contact (para busca direta)
  direction           String                          // "out" (operador → contato) | "in" (contato → operador)
  content             String?                         // conteúdo de texto
  mediaPath           String?                         // caminho local da mídia enviada/recebida
  mediaType           String?                         // "image" | "document" | "audio" | "video"
  mediaCaption        String?                         // legenda da mídia (se image/video)
  whatsappMessageId   String?                         // ID da mensagem no Baileys — usado para rastrear ticks
  status              String   @default("sent")       // "sent" | "delivered" | "read" | "failed"
  sentAt              DateTime @default(now())
  deliveredAt         DateTime?
  readAt              DateTime?                        // quando o destinatário leu (tick azul)
  
  campaignContact     CampaignContact @relation(fields: [campaignContactId], references: [id], onDelete: Cascade)
  contact             Contact         @relation(fields: [contactId], references: [id])
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

### 5.16 Módulo de Respostas — Chat Manual por Campanha

#### Visão geral

O módulo de Respostas é uma interface estilo WhatsApp Web integrada ao sistema, que permite ao operador visualizar e responder manualmente às mensagens recebidas de contatos de cada campanha. Funciona como um canal de atendimento humano pós-disparo, completamente separado da automação.

#### Acesso e navegação

- Item **"Respostas"** no menu lateral esquerdo, com badge numérico indicando o total de mensagens não lidas em todas as campanhas.
- Ao clicar, o usuário acessa um seletor de campanha (dropdown no topo ou lista lateral recolhível). Cada campanha exibe sua contagem de não-lidas ao lado do nome.
- Após selecionar uma campanha, a interface de chat é carregada. A rota é `/respostas/:campaignId`.

#### Layout — Split 25% / 75%

```
┌─────────────────────┬──────────────────────────────────────────────────┐
│   PAINEL ESQUERDO   │              PAINEL DIREITO                       │
│      (~25%)         │                 (~75%)                            │
│                     │                                                   │
│  [Campanha: Nome ▼] │  ┌ José Andrade Ferreira ─ +5516991831382 ──── ┐ │
│  [🔍 Buscar...]     │  │                                               │ │
│  [Todos][Não lidos] │  │   (histórico completo da conversa)            │ │
│  [Lidos]            │  │                                               │ │
│                     │  │  [msg automática campanha]  14:20 ✓✓         │ │
│ ┌─────────────────┐ │  │  [resposta do contato]          14:35        │ │
│ │ 📷 José Andrade │ │  │  [msg manual operador]      14:40 ✓✓🔵      │ │
│ │ Última msg...   │ │  │                                               │ │
│ │ 14:40  🔵✓✓  2 │ │  └───────────────────────────────────────────── ┘ │
│ ├─────────────────┤ │                                                   │
│ │ 📷 Maria Lima   │ │  ┌─────────────────────────────────────────────┐  │
│ │ Oi, me chama   │ │  │  📎  │  Digite uma mensagem...    │  [Enviar]│  │
│ │ 10:15       3  │ │  └─────────────────────────────────────────────┘  │
│ └─────────────────┘ │                                                   │
└─────────────────────┴──────────────────────────────────────────────────┘
```

#### Painel Esquerdo — Lista de Contatos

- **Todos os contatos** da campanha selecionada aparecem (não apenas quem respondeu).
- Cada item exibe:
  - **Foto de perfil** do WhatsApp do contato (buscada via Baileys e cacheada no banco; fallback: avatar com iniciais do `rawName`).
  - **Nome completo** (`rawName` do CSV).
  - **Prévia da última mensagem** (seja automática, recebida ou manual) — truncada em ~40 chars.
  - **Timestamp** da última mensagem.
  - **Indicador de leitura** (ticks duplos cinza = entregue, ticks duplos azuis = lido pelo contato — apenas para mensagens enviadas pelo operador).
  - **Badge numérico** com a quantidade de mensagens recebidas do contato que o operador ainda não leu no app.
- **Ordenação:** contatos com mensagens não lidas primeiro, depois por timestamp da última mensagem (mais recente no topo).
- **Campo de busca:** filtra por nome (`rawName`) ou número de telefone em tempo real.
- **Filtros rápidos (botões/abas):**
  - **Todos** — exibe todos os contatos da campanha.
  - **Não lidos** — exibe apenas contatos com `unreadCount > 0`.
  - **Lidos** — exibe contatos sem mensagens não lidas.

#### Painel Direito — Janela de Chat

- Exibe o **histórico unificado e cronológico** de todas as mensagens relacionadas ao contato naquela campanha:
  1. Mensagens automáticas disparadas pela campanha (fonte: `SendLog` + variação usada).
  2. Respostas recebidas do contato (fonte: `IncomingMessage`).
  3. Mensagens manuais enviadas pelo operador via esta interface (fonte: `ManualMessage`).
- **Bolhas de mensagem:**
  - Mensagens **enviadas** (automáticas + manuais): alinhadas à direita, fundo verde/azul.
  - Mensagens **recebidas**: alinhadas à esquerda, fundo cinza/branco.
  - Mensagens automáticas recebem uma tag discreta `[automático]` abaixo do conteúdo.
  - Cada bolha exibe: conteúdo, timestamp, e para enviadas: ícone de status (✓ enviado, ✓✓ entregue, ✓✓🔵 lido).
- **Scroll automático** para a mensagem mais recente ao abrir a conversa ou receber nova mensagem.
- **Cabeçalho do chat:** foto de perfil, nome completo, número de telefone, e link rápido para o `CampaignDetail` da campanha.

#### Input de Mensagem

- **Texto:** campo multi-linha; `Enter` envia, `Shift+Enter` quebra linha.
- **Mídia:** botão de clipe (📎) abre picker para selecionar:
  - Imagem (PNG, JPG, WEBP — máx 10MB).
  - Documento (PDF, DOCX, XLSX — máx 16MB).
  - Áudio (MP3, OGG, MP4 audio — máx 16MB).
  - Vídeo (MP4 — máx 16MB).
- Ao selecionar mídia, exibe pré-visualização acima do input com botão de cancelar.
- Campo de **legenda** opcional aparece quando mídia é selecionada (somente para imagem/vídeo).
- Botão **Enviar** fica desabilitado se o input estiver vazio e nenhuma mídia selecionada.

#### Foto de Perfil — Estratégia de Cache

1. Ao abrir a conversa de um contato pela primeira vez (ou se `profilePictureUpdatedAt` for `null` ou tiver mais de 24h), o backend chama `sock.profilePictureUrl(jid, 'image')` do Baileys.
2. Salva a URL retornada em `Contact.profilePictureUrl` e atualiza `Contact.profilePictureUpdatedAt`.
3. O frontend usa a URL cacheada diretamente (o WhatsApp serve as fotos via CDN público enquanto a sessão estiver ativa).
4. Se a chamada falhar ou retornar `undefined` (contato sem foto ou privacidade ativa), o frontend exibe avatar gerado com as iniciais do `rawName`.
5. A atualização é assíncrona e não bloqueia a abertura do chat.

#### Leitura e Contagem de Não-Lidos

- Quando o operador **abre a conversa** de um contato, o sistema zera `CampaignContact.unreadCount` e atualiza `CampaignContact.lastReadAt = now()`.
- As mensagens recebidas via Baileys (`messages.upsert`) que chegam enquanto o operador **não** está com aquela conversa aberta incrementam `CampaignContact.unreadCount += 1`.
- O badge no menu "Respostas" é a soma de todos os `unreadCount` de todos os `CampaignContact` do sistema.
- Ao marcar como lida, emite evento WebSocket `chat:unread_updated` para todos os clientes sincronizarem o badge.

#### Status dos Ticks (Read Receipts)

- O Baileys emite o evento `message-receipt.update` com o campo `receipt.type`:
  - `delivery_ack` → status `delivered` (ticks duplos cinzas ✓✓).
  - `read` ou `played` → status `read` (ticks duplos azuis ✓✓🔵).
- O backend atualiza `ManualMessage.status`, `ManualMessage.deliveredAt` e `ManualMessage.readAt` conforme o evento chega, usando `whatsappMessageId` como chave de correlação.
- O frontend recebe a atualização via WebSocket (`chat:message_status`) e re-renderiza o ícone de tick em tempo real.

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

### Chat / Respostas

- `GET /chat/summary` — retorna total de não-lidas por campanha + grand total para o badge do menu
  - Resposta: `{ totalUnread, campaigns: [{ campaignId, name, unreadCount }] }`
- `GET /chat/:campaignId/contacts` — lista todos os contatos da campanha com dados do chat
  - Query params: `search` (busca por nome ou telefone), `filter` (`all` | `unread` | `read`), `page`, `limit`
  - Resposta inclui por contato: `{ contactId, rawName, phone, profilePictureUrl, lastMessage, lastMessageAt, unreadCount, lastMessageStatus, lastMessageDirection }`
- `GET /chat/:campaignId/contacts/:contactId/messages` — histórico unificado e cronológico de mensagens
  - Mescla `SendLog` (automáticas saídas), `IncomingMessage` (recebidas) e `ManualMessage` (manuais saídas/recebidas) num único array ordenado por `sentAt`/`receivedAt`.
  - Query params: `page`, `limit` (paginação reversa — mais antigas no topo).
  - Cada item retorna: `{ id, type: "automated"|"incoming"|"manual", direction: "in"|"out", content, mediaPath?, mediaType?, mediaCaption?, status, sentAt, readAt?, isAutomated }`
- `POST /chat/:campaignId/contacts/:contactId/messages` — envia mensagem manual
  - Multipart form-data: `content` (texto opcional), `media` (arquivo opcional), `mediaCaption` (texto opcional).
  - Validações: `content` ou `media` deve estar presente; tamanho máximo por tipo de mídia.
  - Backend envia via Baileys, salva `ManualMessage` com `direction: "out"` e `whatsappMessageId`.
  - Resposta: `{ message: ManualMessage }`.
- `POST /chat/:campaignId/contacts/:contactId/read` — marca conversa como lida (zera `unreadCount`, atualiza `lastReadAt`).
- `GET /contacts/:id/profile-picture/refresh` — força re-fetch da foto de perfil via Baileys e atualiza cache.

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
- `chat:new_message` — nova mensagem chegou (recebida do contato): `{ campaignId, contactId, message: { id, direction, content, mediaPath?, mediaType?, sentAt }, unreadCount }`
- `chat:message_status` — atualização de tick de leitura: `{ messageId, campaignContactId, status: "delivered"|"read", deliveredAt?, readAt? }`
- `chat:unread_updated` — contagem de não-lidas mudou: `{ campaignId, contactId, unreadCount, totalUnread }` — usado para atualizar badge do menu e lista de contatos em tempo real

**Cliente → Servidor:** nenhum (todas as ações vão por HTTP REST).

---

## 9. Frontend — Telas e Componentes

### 9.1 Layout geral

- **Sidebar esquerda fixa** (collapse opcional):
  - Logo + nome do projeto
  - Dashboard (ícone home)
  - Campanhas (lista)
  - Contatos (base global)
  - **Respostas** (ícone de balão de chat) — com badge numérico de não-lidas total
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

### 9.8 Tela: Respostas (`/respostas` e `/respostas/:campaignId`)

**Rota `/respostas`:** exibe somente o seletor de campanha centralizado caso nenhuma esteja selecionada.

**Rota `/respostas/:campaignId`:** layout split 25%/75%.

**Painel Esquerdo — `ContactList.jsx`:**
- No topo: `CampaignSelector.jsx` (dropdown com nome das campanhas + badge de não-lidas cada).
- `ChatSearchBar.jsx`: input de busca + três botões de filtro (Todos / Não lidos / Lidos).
- Lista de `ContactListItem.jsx`, virtualizada se > 100 itens.
- `ContactListItem.jsx` exibe: avatar (`<img>` da `profilePictureUrl` ou fallback com iniciais coloridas), `rawName`, prévia da última mensagem, timestamp formatado, badge de `unreadCount` (oculto se zero), ícone de tick duplo colorido.
- Contato ativo tem fundo destacado.

**Painel Direito — `ChatWindow.jsx`:**
- Cabeçalho fixo: avatar + `rawName` + telefone + link para `CampaignDetail`.
- Área de scroll com lista de `ChatMessage.jsx`:
  - Bolha direita (enviadas): fundo verde escuro (dark) / verde claro (light).
  - Bolha esquerda (recebidas): fundo cinza escuro (dark) / branco (light).
  - Tag `[automático]` em fonte menor abaixo do conteúdo das mensagens de campanha.
  - Ticks de status: `✓` (enviado), `✓✓` cinza (entregue), `✓✓` azul (lido).
  - Suporte a renderização de mídia: thumbnail clicável para imagem, ícone + nome do arquivo para documentos, player nativo para áudio.
  - Agrupamento por data (separadores "Hoje", "Ontem", "DD/MM/YYYY").
- `ChatInput.jsx` fixo no rodapé:
  - Campo de texto expansível.
  - Botão 📎 abre menu de tipo de mídia (Imagem / Documento / Áudio / Vídeo).
  - Pré-visualização da mídia selecionada com botão ✕ para cancelar.
  - Campo de legenda (opcional, apenas para imagem/vídeo).
  - Botão Enviar (ícone de avião de papel).

**Estado — `useChatStore.js`:**
- `selectedCampaignId`, `selectedContactId`.
- `contacts`: mapa por `contactId` com dados do painel esquerdo.
- `messages`: mapa por `contactId` com array de mensagens carregadas (paginação infinita ao rolar para cima).
- `totalUnread`: grand total para o badge do menu.
- Ações: `selectCampaign`, `selectContact`, `markAsRead`, `appendMessage`, `updateMessageStatus`.

### 9.9 Tema

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
- [ ] **Módulo de Respostas:**
  - [ ] Item "Respostas" aparece no menu lateral com badge de não-lidas.
  - [ ] Seletor de campanha lista todas as campanhas com suas contagens de não-lidas.
  - [ ] Lista de contatos exibe todos os contatos da campanha (não só quem respondeu).
  - [ ] Busca por nome e número funciona em tempo real.
  - [ ] Filtros Todos / Não lidos / Lidos funcionam corretamente.
  - [ ] Foto de perfil é buscada via Baileys e cacheada; fallback para iniciais funciona.
  - [ ] Histórico unificado exibe mensagens automáticas, recebidas e manuais em ordem cronológica.
  - [ ] Mensagens automáticas têm tag `[automático]` visível.
  - [ ] Operador consegue enviar texto via `ChatInput`.
  - [ ] Operador consegue enviar imagem com legenda opcional.
  - [ ] Operador consegue enviar documento, áudio e vídeo.
  - [ ] Ticks de status (enviado / entregue / lido) atualizam em tempo real via WebSocket.
  - [ ] Abrir conversa zera `unreadCount` e atualiza badge do menu.
  - [ ] Nova mensagem recebida incrementa badge sem precisar recarregar a página.
  - [ ] Scroll automático para mensagem mais recente ao abrir conversa e ao receber nova.
  - [ ] Paginação de mensagens (scroll infinito para cima carrega mais antigas).
  - [ ] Agrupamento de mensagens por data (separadores Hoje / Ontem / data).
  - [ ] Rota `/respostas/:campaignId` funciona com deep link direto.

---

## 📦 Entregáveis finais

1. Código completo do monorepo.
2. `README.md` resumido para o GitHub (este documento atual fica como `DOCS.md` ou similar).
3. `.env.example` preenchido com placeholders.
4. Migrations do Prisma versionadas.
5. Documentação inline (JSDoc nos services principais).

---

**Fim da documentação.** Qualquer ambiguidade encontrada durante a implementação deve ser resolvida em favor de: simplicidade > funcionalidade > robustez anti-ban > performance.

---

## 15. Módulo de Respostas — Chat Manual por Campanha

Esta seção consolida tudo relacionado ao módulo de chat em um único local de referência para a implementação.

### 15.1 Objetivo

Permitir que o operador do sistema converse manualmente com qualquer contato de qualquer campanha diretamente pela interface web, com uma experiência idêntica ao WhatsApp Web — sem precisar sair do sistema ou pegar o celular para responder.

### 15.2 Premissas de Negócio

- Todos os contatos de uma campanha aparecem, independente de ter respondido ou não.
- A conversa exibe **todo o histórico** da relação com aquele contato naquela campanha: mensagens automáticas disparadas, respostas recebidas e mensagens manuais enviadas pelo operador.
- O operador pode enviar **texto e mídia** (imagem, documento, áudio, vídeo).
- Os **ticks de leitura** refletem o estado real do WhatsApp (entregue = duplo cinza, lido = duplo azul).
- O badge de não-lidas no menu conta apenas mensagens **recebidas** do contato que o operador ainda não visualizou no app.
- **Isolamento por campanha**: o mesmo contato que aparece em duas campanhas terá conversas separadas em cada uma — o histórico de cada conversa é o da campanha específica.

### 15.3 Modelo de Dados (resumo das adições)

| Model | Campo adicionado | Propósito |
|---|---|---|
| `Contact` | `profilePictureUrl String?` | Cache da URL da foto de perfil do WhatsApp |
| `Contact` | `profilePictureUpdatedAt DateTime?` | Controle de expiração do cache (TTL 24h) |
| `CampaignContact` | `unreadCount Int @default(0)` | Mensagens recebidas não visualizadas pelo operador |
| `CampaignContact` | `lastReadAt DateTime?` | Última vez que o operador abriu essa conversa |
| `ManualMessage` | *(model novo)* | Mensagens manuais enviadas/recebidas neste módulo |

**`ManualMessage` — campos chave:**

| Campo | Tipo | Descrição |
|---|---|---|
| `campaignContactId` | String | Liga ao `CampaignContact` (campanha + contato) |
| `contactId` | String | Liga ao `Contact` |
| `direction` | String | `"out"` (operador→contato) \| `"in"` (contato→operador) |
| `content` | String? | Conteúdo de texto |
| `mediaPath` | String? | Caminho local da mídia |
| `mediaType` | String? | `"image"` \| `"document"` \| `"audio"` \| `"video"` |
| `mediaCaption` | String? | Legenda (imagem/vídeo) |
| `whatsappMessageId` | String? | ID do Baileys para correlacionar recibos de leitura |
| `status` | String | `"sent"` \| `"delivered"` \| `"read"` \| `"failed"` |
| `sentAt` | DateTime | Timestamp de envio |
| `deliveredAt` | DateTime? | Quando foi entregue |
| `readAt` | DateTime? | Quando o destinatário leu |

### 15.4 Fluxo de Dados — Mensagem Manual Enviada pelo Operador

```
Operador digita e clica Enviar
    ↓
POST /chat/:campaignId/contacts/:contactId/messages
    ↓
chat.service.js valida payload (texto ou mídia presentes)
    ↓
Se mídia: salva arquivo em backend/uploads/chat/
    ↓
Baileys: sock.sendMessage(jid, { text } | { image, caption } | { document } | ...)
    ↓
Baileys retorna { key: { id: whatsappMessageId } }
    ↓
Salva ManualMessage { direction: "out", status: "sent", whatsappMessageId }
    ↓
Socket.IO emite chat:new_message para frontend
    ↓
Frontend appenda bolha de mensagem + tick único ✓
    ↓
(Mais tarde) Baileys emite message-receipt.update
    ↓
Atualiza ManualMessage.status → "delivered" ou "read"
    ↓
Socket.IO emite chat:message_status
    ↓
Frontend atualiza tick: ✓✓ cinza ou ✓✓ azul
```

### 15.5 Fluxo de Dados — Mensagem Recebida do Contato

```
Contato responde no WhatsApp
    ↓
Baileys emite messages.upsert (já existente no whatsapp.service.js)
    ↓
Sistema verifica se remetente está em algum CampaignContact ativo
    ↓
Salva IncomingMessage (comportamento existente)
    ↓
NOVO: Incrementa CampaignContact.unreadCount += 1
    ↓
NOVO: Salva ManualMessage { direction: "in", whatsappMessageId, ... }
    ↓
Socket.IO emite chat:new_message + chat:unread_updated
    ↓
Frontend: se conversa do contato está aberta → appenda bolha + chama POST .../read
           se conversa está fechada → incrementa badge no ContactListItem e no menu
```

### 15.6 Foto de Perfil — Detalhes de Implementação

```javascript
// chat.service.js (pseudocódigo)
async function getProfilePicture(contact) {
  const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas
  const needsRefresh =
    !contact.profilePictureUrl ||
    !contact.profilePictureUpdatedAt ||
    Date.now() - contact.profilePictureUpdatedAt.getTime() > CACHE_TTL_MS;

  if (!needsRefresh) return contact.profilePictureUrl;

  try {
    const jid = contact.phone.replace('+', '') + '@s.whatsapp.net';
    const url = await sock.profilePictureUrl(jid, 'image');
    await prisma.contact.update({
      where: { id: contact.id },
      data: { profilePictureUrl: url, profilePictureUpdatedAt: new Date() }
    });
    return url;
  } catch {
    // contato sem foto ou privacidade ativa — retorna null, frontend usa iniciais
    await prisma.contact.update({
      where: { id: contact.id },
      data: { profilePictureUrl: null, profilePictureUpdatedAt: new Date() }
    });
    return null;
  }
}
```

### 15.7 Histórico Unificado — Query de Mensagens

O endpoint `GET /chat/:campaignId/contacts/:contactId/messages` executa três queries e mescla:

```javascript
// 1. Mensagens automáticas disparadas (SendLog) → direction: "out", isAutomated: true
const automated = await prisma.sendLog.findMany({
  where: { campaignId, contactId, status: 'sent' },
  select: { id, variationUsed, sentAt, messageOrder }
});

// 2. Mensagens recebidas do contato (IncomingMessage) → direction: "in"
const incoming = await prisma.incomingMessage.findMany({
  where: { campaignId, fromPhone: contact.phone },
  select: { id, content, receivedAt }
});

// 3. Mensagens manuais (ManualMessage) → direction in/out, isAutomated: false
const manual = await prisma.manualMessage.findMany({
  where: { campaignContactId },
  select: { id, direction, content, mediaPath, mediaType, status, sentAt, readAt }
});

// Mescla e ordena por timestamp
const unified = [
  ...automated.map(m => ({ ...m, type: 'automated', direction: 'out', sentAt: m.sentAt })),
  ...incoming.map(m => ({ ...m, type: 'incoming', direction: 'in', sentAt: m.receivedAt })),
  ...manual.map(m => ({ ...m, type: 'manual' })),
].sort((a, b) => a.sentAt - b.sentAt);
```

### 15.8 Limitações Conhecidas / Decisões de Design

- **Sem áudio gravado em tempo real:** o input permite enviar arquivos de áudio pré-gravados, mas não tem gravação pelo microfone do browser (complexidade alta, baixo valor).
- **Foto de perfil expira em 24h:** o cache pode ficar defasado temporariamente. O operador pode forçar atualização via `GET /contacts/:id/profile-picture/refresh`.
- **Mensagens muito antigas:** o histórico paginado carrega as 50 mais recentes primeiro; o scroll para cima carrega mais (infinite scroll reverso). Não há limite de total de mensagens armazenadas.
- **Isolamento por campanha:** o mesmo contato em duas campanhas tem conversas separadas. Isso é intencional — o contexto da campanha é relevante para o atendimento.
- **Sem suporte a stickers, reações ou polls** nesta versão.
