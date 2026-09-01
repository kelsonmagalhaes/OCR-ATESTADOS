# OCR de Atestados Médicos

Aplicação web para extração automática de dados de atestados médicos usando OCR, com exportação para planilha Excel.

## Funcionalidades

- Upload ilimitado de arquivos (PDF, JPEG, PNG)
- OCR 100% client-side (sem API key necessária)
- Suporte a PDFs nativos, PDFs escaneados e documentos manuscritos
- Tabela editável com os dados extraídos
- Exportação para `.xlsx` com agrupamento por paciente

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
- **Tesseract.js** para OCR (português + inglês)
- **pdf.js** para renderização de PDFs
- **SheetJS (xlsx)** para exportação Excel

## Instalação e Uso

```bash
# Instalar dependências (copia automaticamente o worker do pdf.js)
npm install

# Modo desenvolvimento
npm run dev

# Build de produção
npm run build
npm start
```

## Deploy no Vercel

1. Faça push do repositório para o GitHub
2. Importe o projeto no [Vercel](https://vercel.com)
3. Deploy automático — nenhuma variável de ambiente necessária

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

## Observações

- A precisão do OCR depende da qualidade do scan (recomendado mínimo 150 DPI)
- Documentos manuscritos têm precisão menor que documentos digitados
- Processamento ocorre inteiramente no navegador — nenhum dado é enviado a servidores externos
