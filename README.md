# WhatsApp Campaign Sender

Sistema local e open-source para disparar campanhas de WhatsApp de forma controlada, com frontend web para gerenciar contatos, mensagens, agendamentos e relatórios.

> ⚠️ **Aviso legal:** este projeto é uma ferramenta técnica de automação. O uso para envio de mensagens não solicitadas (spam) viola os Termos de Serviço do WhatsApp e pode resultar em banimento da conta. O usuário é o único responsável pelo uso. Recomenda-se enviar apenas para contatos que consentiram em receber mensagens.

---

## O que é

- Conecta ao seu WhatsApp via [Baileys](https://github.com/WhiskeySockets/Baileys) (escaneio de QR code)
- Importa contatos via CSV (detecta e descarta números de fixo automaticamente)
- Cria campanhas com múltiplas mensagens em sequência, cada uma com variações aleatórias
- Delays aleatórios, simulação de digitação, limite diário — tudo configurável
- Dashboard em tempo real via WebSocket
- Modo **Teste** (redireciona tudo para um número de teste) e **Produção**

## Stack

- **Backend:** Node.js 20 + Express + Baileys + Prisma + SQLite + Socket.IO
- **Frontend:** React 18 + Vite + TailwindCSS + Zustand

## Instalação

```bash
# Pré-requisitos: Node.js 20+

# 1. Clonar
git clone <repo-url>
cd whatsapp-campaign-sender

# 2. Configurar .env
cp .env.example backend/.env
# Editar backend/.env: preencher TEST_PHONE_NUMBER

# 3. Instalar dependências
cd backend && npm install
cd ../frontend && npm install
cd ..

# 4. Criar banco de dados
cd backend && npx prisma db push

# 5. Iniciar
# Terminal 1 (backend):
cd backend && npm run dev
# Terminal 2 (frontend):
cd frontend && npm run dev
```

Abrir: `http://localhost:5173`

## Primeiro uso

1. Ao abrir, aparecerá o QR code — escaneie com seu WhatsApp
2. Após conectado, crie uma campanha em **+ Nova Campanha**
3. Faça upload de um CSV (`nome,numero`) com seus contatos
4. Adicione mensagens e variações
5. Escolha disparar agora ou agendar

## Formato do CSV

```csv
nome,numero
"José Silva","(16) 99183-1382"
"Maria Oliveira","+55 16 99999-9999"
```

## Funcionalidades

- ✅ Conexão WhatsApp via QR (reconexão automática)
- ✅ Importação e classificação de CSV (fixo vs celular)
- ✅ Campanhas com múltiplas mensagens e variações
- ✅ Modos: Sequencial, Broadcast, Embaralhado
- ✅ Delays aleatórios entre mensagens
- ✅ Simulação de "digitando..."
- ✅ Modo teste / produção
- ✅ Agendamento de campanhas
- ✅ Pausa e retomada
- ✅ Limite diário de envios
- ✅ Detecção de respostas (apenas registro, sem auto-reply)
- ✅ Dashboard em tempo real
- ✅ Export de logs e erros em CSV

## Licença

MIT — veja [LICENSE](LICENSE)
