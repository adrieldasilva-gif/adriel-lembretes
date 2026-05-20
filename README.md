# Agenda Adriel — PWA de Lembretes

Aplicativo mobile-first de lembretes pessoais e profissionais para Adriel Figueiredo da Silva.

## Funcionalidades

- **Relógio em tempo real** — data e hora atualizados a cada segundo
- **Lembretes do dia** — filtra automaticamente as atividades do dia atual
- **Entrada por voz** — segure o botão e fale para adicionar novas atividades (pt-BR)
- **CRUD completo** — adicionar, editar, excluir e pausar atividades
- **Busca e filtro** — por texto e categoria
- **PWA** — instala no celular como aplicativo nativo (ícone na tela inicial)
- **Persistência local** — dados salvos no dispositivo via localStorage

---

## Deploy no GitHub + Netlify

### 1. Crie o repositório no GitHub

```bash
# No seu computador, dentro da pasta do projeto:
git init
git add .
git commit -m "feat: initial commit - Agenda Adriel"

# Crie um repositório no github.com (ex: adriel-agenda)
git remote add origin https://github.com/SEU_USUARIO/adriel-agenda.git
git branch -M main
git push -u origin main
```

### 2. Deploy no Netlify

1. Acesse [netlify.com](https://netlify.com) e faça login
2. Clique em **"Add new site" → "Import an existing project"**
3. Escolha **GitHub** e selecione o repositório `adriel-agenda`
4. Configure:
   - **Branch:** `main`
   - **Build command:** `npm run build`
   - **Publish directory:** `build`
5. Clique em **"Deploy site"**

O Netlify detecta automaticamente o `netlify.toml` já configurado no projeto.

### 3. Instalar no celular (Android)

1. Abra o site no Chrome
2. Toque nos 3 pontinhos → **"Adicionar à tela inicial"**
3. O app abre em tela cheia sem barra do navegador

### 4. Instalar no celular (iPhone)

1. Abra o site no Safari
2. Toque no ícone de compartilhar (quadrado com seta)
3. Toque em **"Adicionar à Tela de Início"**

---

## Desenvolvimento local

```bash
# Instalar dependências
npm install

# Rodar localmente
npm start
# Abre em http://localhost:3000

# Gerar build de produção
npm run build
```

---

## Estrutura do projeto

```
adriel-agenda/
├── public/
│   ├── index.html        # HTML base com meta tags PWA
│   └── manifest.json     # Configuração PWA (ícone, nome, tema)
├── src/
│   ├── index.js          # Ponto de entrada React
│   └── App.js            # Aplicativo completo (componentes + estilos)
├── netlify.toml          # Config de deploy e redirect SPA
└── package.json
```

---

## Estrutura de dados de uma atividade

```json
{
  "id": "unique_id",
  "atividade": "Pagamento Sandro",
  "descricao": "Pagamento mensal do personal trainer",
  "categoria": "pagamentos",
  "frequencia": "mensal",
  "diaMes": 10,
  "diaSemana": "",
  "dataEspecifica": "",
  "destinatario": "Adriel mesmo",
  "contato": "WhatsApp",
  "observacao": "Confirmar valor com Sandro antes",
  "ativo": true
}
```

### Frequências disponíveis
| Valor | Comportamento |
|---|---|
| `mensal` | Aparece todo mês no `diaMes` |
| `semanal` | Aparece toda semana no `diaSemana` |
| `quinzenal` | Aparece nos dias 1 e 16 |
| `anual` | Aparece na `dataEspecifica` (formato MM/DD) |
| `unico` | Aparece uma vez na `dataEspecifica` |

---

## Categorias

| ID | Label | Ícone |
|---|---|---|
| `pagamentos` | Pagamentos | 💰 |
| `relatorios` | Relatórios | 📋 |
| `cobrancas` | Cobranças | 📞 |
| `rh` | RH / Colaboradores | 👥 |
| `pessoal` | Pessoal | 🏃 |
| `processos` | Processos | 📁 |
| `reunioes` | Reuniões | 📅 |
| `urgente` | Urgente | ⚠️ |

---

## Prompt do Agente (para uso com Claude API)

Cole este prompt como **system prompt** em qualquer integração com IA:

```
Você é o agente de agenda pessoal e profissional do Sr. Adriel Figueiredo da Silva.

Sua função é gerenciar lembretes e atividades. Você tem acesso às seguintes operações:

1. LISTAR LEMBRETES DO DIA
   - Consulte a lista de atividades
   - Filtre por data/frequência conforme hoje
   - Agrupe por categoria
   - Mostre destinatário de cada atividade

2. ADICIONAR ATIVIDADE (por voz ou texto)
   - Extraia: atividade, descrição, categoria, frequência, dia/data, destinatário, observação
   - Confirme antes de gravar
   - Use linguagem natural: "Adicionar: pagar academia todo dia 5 para Adriel"

3. EDITAR ATIVIDADE
   - Identifique pelo nome ou ID
   - Confirme as mudanças

4. EXCLUIR ATIVIDADE
   - Sempre confirme antes de excluir

CATEGORIAS: pagamentos, relatórios, cobranças, rh, pessoal, processos, reuniões, urgente
FREQUÊNCIAS: mensal (dia X), semanal (dia da semana), quinzenal (dias 1 e 16), anual (data fixa), único

FORMATO DA RESPOSTA DIÁRIA:
Bom dia, Adriel! — [DIA DA SEMANA], [DATA]

[CATEGORIA + ÍCONE]
• [Atividade] → [Destinatário]
  [Descrição] | [Observação]

Total: [N] atividades hoje.

Se não houver: "Nenhuma atividade para hoje. Bom descanso!"

REGRAS:
- Nunca inventar atividades
- Sempre mostrar o destinatário
- Urgente aparece sempre primeiro
- Tom: profissional, direto, cordial
```

---

## Próximos passos opcionais

- [ ] Integração com Google Sheets (via Google Apps Script + fetch)
- [ ] Notificações push às 07h00 (via service worker + Push API)
- [ ] Envio automático de WhatsApp (via Evolution API + webhook)
- [ ] Autenticação simples com PIN

---

*Versão 1.0 — Maio 2025*
