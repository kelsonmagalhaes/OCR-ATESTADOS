# OCR de Atestados Médicos

Aplicação web para extração automática de dados de atestados médicos usando **Google Cloud Vision API**, com exportação para planilha Excel.

## Funcionalidades

- Upload ilimitado de arquivos (PDF, JPEG, PNG)
- OCR via Google Cloud Vision API (rápido e preciso para documentos escaneados)
- Processamento de páginas em lotes paralelos de 5 (2-3 segundos por página)
- Suporte a PDFs escaneados — converte cada página em imagem via pdf.js
- Tabela editável com os dados extraídos
- Exportação para `.xlsx` com agrupamento por paciente
- Configuração de API Key via interface (armazenada no localStorage)

## Colunas da Planilha

| Coluna | Cabeçalho |
|--------|-----------|
| A | Nome |
| B | Tipo |
| C | Data Atendimento |
| D | Período / Dias |
| E | Horário |
| F | CID |
| G | Local |
| H | Profissional / Responsável |
| I | Observação |
| J | Arquivo |

## Tecnologias

- **Next.js 14** (App Router)
- **Tailwind CSS** para estilização
- **Google Cloud Vision API** para OCR (DOCUMENT_TEXT_DETECTION)
- **pdf.js** para renderização de PDFs (client-side)
- **SheetJS (xlsx)** para exportação Excel

## Instalação e Uso

```bash
# Instalar dependências (copia automaticamente o worker do pdf.js)
pnpm install
# ou: npm install

# Modo desenvolvimento
pnpm dev

# Build de produção
pnpm build
pnpm start
```

## Configuração da Google Cloud Vision API

### Opção 1 — Variável de ambiente (recomendado para Vercel)

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um projeto (ou selecione um existente)
3. Ative a **Cloud Vision API**: APIs & Services → Enable APIs → pesquise "Cloud Vision API"
4. Crie uma chave: APIs & Services → Credentials → Create Credentials → API Key
5. (Opcional mas recomendado) Restrinja a chave à Cloud Vision API
6. No Vercel: Settings → Environment Variables → adicione `GOOGLE_CLOUD_VISION_API_KEY`

### Opção 2 — Interface da aplicação (para uso local / flexível)

1. Obtenha sua API key conforme descrito acima
2. Na aplicação, clique no botão **"Configurar API"** no canto superior direito
3. Cole sua chave e clique em **Salvar**
4. A chave é armazenada no `localStorage` do navegador (não é enviada a nenhum servidor além do proxy `/api/ocr`)

> **Nota de segurança**: Para uso em produção, prefira a variável de ambiente. A variável do servidor tem prioridade sobre a chave fornecida pelo usuário.

## Deploy no Vercel

1. Faça push do repositório para o GitHub
2. Importe o projeto no [Vercel](https://vercel.com)
3. Adicione a variável de ambiente `GOOGLE_CLOUD_VISION_API_KEY`
4. Deploy automático

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

## Arquitetura

```
Browser                          Vercel Edge
──────────────────────           ──────────────────────
pdf.js (render pages)  ──────>  /api/ocr
  ↓ JPEG images (1.5x)            ↓ Google Cloud Vision
  ↓ batches of 5                  ↓ DOCUMENT_TEXT_DETECTION
fieldExtractor.ts ←── text ─────  ↓ returns full text
```

## Observações

- A precisão é significativamente melhor que Tesseract.js para documentos escaneados brasileiros
- Cada página demora ~2-3 segundos (vs 10-15 min com Tesseract.js para 78 páginas)
- Documentos são processados via `/api/ocr` (Vercel Edge Function) — apenas imagens são enviadas temporariamente, sem persistência
