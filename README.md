# 📊 Dashboard Financeiro - Análise por Filiais

Dashboard interativo para análise de dados financeiros por filiais, com visualização de gráficos e tabelas dinâmicas.

## ✨ Funcionalidades

- 📤 Upload de arquivos Excel (.xlsx, .xls)
- 📊 Gráficos combinados (barras + linha)
- 🔍 Filtros por filial e data
- 📋 Tabela pivô com detalhamento
- 💾 Exportação para PDF
- 📱 Design responsivo

## 🚀 Como usar

### Localmente

1. Clone o repositório:
```bash
git clone https://github.com/SEU_USUARIO/dashboard-financeiro.git
cd dashboard-financeiro
```

2. Instale as dependências:
```bash
npm install
```

3. Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

4. Abra o navegador em `http://localhost:5173`

### Deploy no Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/SEU_USUARIO/dashboard-financeiro)

Ou manualmente:

1. Faça login no [Vercel](https://vercel.com)
2. Clique em "Add New Project"
3. Importe seu repositório do GitHub
4. Clique em "Deploy"

## 📝 Formato do arquivo Excel

O arquivo Excel deve conter uma aba chamada **"Já Existentes"** com as seguintes colunas:

- **Filial**: Nome da filial
- **Vencimento**: Data de vencimento (formato dd/mm/yyyy)
- **Valor**: Valor financeiro (aceita formatos BR: 1.234,56 ou EN: 1,234.56)

## 🛠️ Tecnologias

- React 18
- Vite
- Tailwind CSS
- Recharts
- XLSX (SheetJS)

## 📄 Licença

MIT

## 👤 Autor

Seu Nome
