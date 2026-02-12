# 🚀 GUIA DE DEPLOY NO VERCEL

## Passo 1: Preparar o projeto localmente

1. Abra o terminal/prompt de comando
2. Navegue até a pasta onde você quer criar o projeto
3. Copie todos os arquivos que eu criei para uma pasta chamada `dashboard-financeiro`

## Passo 2: Inicializar Git

Abra o terminal na pasta do projeto e execute:

```bash
git init
git add .
git commit -m "Primeiro commit - Dashboard Financeiro"
```

## Passo 3: Criar repositório no GitHub

1. Acesse: https://github.com/new
2. Nome do repositório: `dashboard-financeiro`
3. Deixe como **Público** (ou Privado se preferir)
4. **NÃO** marque "Add a README file"
5. Clique em "Create repository"

## Passo 4: Conectar seu projeto ao GitHub

No terminal, execute os comandos que aparecem na página do GitHub:

```bash
git remote add origin https://github.com/SEU_USUARIO/dashboard-financeiro.git
git branch -M main
git push -u origin main
```

**Substitua** `SEU_USUARIO` pelo seu nome de usuário do GitHub!

## Passo 5: Deploy no Vercel

### Opção A: Pelo site (RECOMENDADO)

1. Acesse: https://vercel.com/signup
2. Faça login com sua conta GitHub
3. Clique em "Add New..." → "Project"
4. Selecione o repositório `dashboard-financeiro`
5. Deixe todas as configurações padrão
6. Clique em "Deploy"
7. Aguarde 1-2 minutos ✅

### Opção B: Pela CLI

```bash
npm install -g vercel
vercel login
vercel
```

## 🎉 Pronto!

Seu dashboard estará online em uma URL como:
`https://dashboard-financeiro-xxx.vercel.app`

## 🔄 Atualizações futuras

Para atualizar o site depois de fazer mudanças:

```bash
git add .
git commit -m "Descrição da mudança"
git push
```

O Vercel fará o deploy automático! 🚀

## ⚠️ Problemas comuns

**Erro de permissão no GitHub:**
- Configure suas credenciais: `git config --global user.email "seu@email.com"`
- Configure seu nome: `git config --global user.name "Seu Nome"`

**Erro no Vercel:**
- Verifique se o arquivo `package.json` está correto
- Certifique-se de que todos os arquivos foram commitados

## 📞 Precisa de ajuda?

Se tiver qualquer problema, me avise!
