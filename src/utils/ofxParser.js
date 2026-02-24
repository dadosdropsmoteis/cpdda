/**
 * ofxParser.js
 * 
 * Parser de arquivos OFX (SGML e XML) + cruzamento com tabela de contas.
 * Para usar no App.jsx, basta importar:
 *   import { parseOFX, parseMultipleOFX, readOFXFile, formatBRL } from './utils/ofxParser';
 */

// ─── Mapeamento BANKID → nome do banco ──────────────────────────
const BANK_NAMES = {
  '0001': 'Banco do Brasil',
  '0033': 'Santander',
  '0041': 'Banrisul',
  '0104': 'Caixa Econômica',
  '0237': 'Bradesco',
  '0341': 'Itaú',
  '0389': 'Mercantil do Brasil',
  '0422': 'Safra',
  '0748': 'Sicredi',
  '0756': 'Sicoob',
};

// ─── Helpers de extração OFX ─────────────────────────────────────

function getTagValue(content, tagName) {
  // XML: <TAG>valor</TAG>
  const xmlRegex = new RegExp(`<${tagName}>([^<]+)</${tagName}>`, 'i');
  const xmlMatch = content.match(xmlRegex);
  if (xmlMatch) return xmlMatch[1].trim();

  // SGML: <TAG>valor (até próxima tag ou newline)
  const sgmlRegex = new RegExp(`<${tagName}>([^<\\n\\r]+)`, 'i');
  const sgmlMatch = content.match(sgmlRegex);
  if (sgmlMatch) return sgmlMatch[1].trim();

  return null;
}

function getTagBlock(content, tagName) {
  const xmlRegex = new RegExp(`<${tagName}>[\\s\\S]*?</${tagName}>`, 'i');
  const xmlMatch = content.match(xmlRegex);
  if (xmlMatch) return xmlMatch[0];

  const sgmlRegex = new RegExp(
    `<${tagName}>([\\s\\S]*?)(?=</${tagName}>|<(?:LEDGERBAL|AVAILBAL|BANKACCTFROM|BANKTRANLIST)>|$)`,
    'i'
  );
  const sgmlMatch = content.match(sgmlRegex);
  if (sgmlMatch) return sgmlMatch[0];

  return null;
}

// ─── Parser de data OFX ──────────────────────────────────────────

function parseOFXDate(dateStr) {
  if (!dateStr) return { date: null, formatted: null };
  const clean = dateStr.replace(/\[.*\]/, '').trim();
  const year = parseInt(clean.substring(0, 4));
  const month = parseInt(clean.substring(4, 6));
  const day = parseInt(clean.substring(6, 8));
  const date = new Date(year, month - 1, day);
  const formatted = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
  return { date, formatted };
}

// ─── Parser de transações ────────────────────────────────────────

function parseTransactions(content) {
  const transactions = [];
  const tranRegex = /<STMTTRN>([\s\S]*?)(?=<STMTTRN>|<\/BANKTRANLIST>|<LEDGERBAL>|$)/gi;

  let match;
  while ((match = tranRegex.exec(content)) !== null) {
    const block = match[1];
    const trnType = getTagValue(block, 'TRNTYPE');
    const dtPosted = getTagValue(block, 'DTPOSTED');
    const trnAmt = getTagValue(block, 'TRNAMT');
    const fitId = getTagValue(block, 'FITID');
    const memo = getTagValue(block, 'MEMO');
    const { date, formatted } = parseOFXDate(dtPosted);
    const amount = trnAmt ? parseFloat(trnAmt) : 0;

    transactions.push({
      type: trnType,
      date,
      dateFormatted: formatted,
      amount,
      fitId,
      memo: memo || '',
      isCredit: amount > 0,
    });
  }

  return transactions;
}

// ─── Parser principal ────────────────────────────────────────────

export function parseOFX(content, accountsMap = {}) {
  const bankIdRaw = getTagValue(content, 'BANKID');
  const acctId = getTagValue(content, 'ACCTID');
  
  // Normalizar BANKID com zero à esquerda (padrão de 4 dígitos)
  const bankId = bankIdRaw ? bankIdRaw.padStart(4, '0') : null;
  
  const acctType = getTagValue(content, 'ACCTTYPE');
  const curDef = getTagValue(content, 'CURDEF');

  const dtStart = getTagValue(content, 'DTSTART');
  const dtEnd = getTagValue(content, 'DTEND');
  const periodoInicio = parseOFXDate(dtStart);
  const periodoFim = parseOFXDate(dtEnd);

  const ledgerBlock = getTagBlock(content, 'LEDGERBAL');
  const balAmt = ledgerBlock ? getTagValue(ledgerBlock, 'BALAMT') : null;
  const saldo = balAmt ? parseFloat(balAmt) : null;

  const transactions = parseTransactions(content);

  const totalCreditos = transactions.filter(t => t.isCredit).reduce((s, t) => s + t.amount, 0);
  const totalDebitos = transactions.filter(t => !t.isCredit).reduce((s, t) => s + Math.abs(t.amount), 0);

  // Cruzamento com tabela de contas
  const lookupKey = bankId && acctId ? `${bankId}_${acctId}` : null;
  
  // DEBUG: Log para identificar contas não mapeadas
  if (lookupKey && !accountsMap[lookupKey]) {
    console.log('⚠️ Conta não encontrada no mapa:');
    console.log('  Lookup Key:', lookupKey);
    console.log('  BANKID:', bankId);
    console.log('  ACCTID:', acctId);
  }
  
  const accountInfo = lookupKey ? accountsMap[lookupKey] || null : null;
  const bankName = bankId ? (BANK_NAMES[bankId] || `Banco ${bankId}`) : null;

  return {
    bankId,
    bankName,
    acctId,
    acctType,
    currency: curDef,
    periodoInicio: periodoInicio.formatted,
    periodoFim: periodoFim.formatted,
    saldo,
    transactions,
    totalTransactions: transactions.length,
    totalCreditos,
    totalDebitos,
    accountInfo,
    matched: accountInfo !== null,
    summary: {
      fantasia: accountInfo?.fantasia || 'NÃO IDENTIFICADO',
      descricao: accountInfo?.descricao || '',
      cidade: accountInfo?.cidade || '',
      cnpj: accountInfo?.cnpj || '',
      banco: bankName,
      conta: acctId,
      periodo: `${periodoInicio.formatted} a ${periodoFim.formatted}`,
      saldo,
      totalCreditos,
      totalDebitos,
      qtdTransacoes: transactions.length,
    },
  };
}

// ─── Parser múltiplo ─────────────────────────────────────────────

export function parseMultipleOFX(files, accountsMap = {}) {
  const results = files.map(file => ({
    fileName: file.name,
    ...parseOFX(file.content, accountsMap),
  }));

  const matched = results.filter(r => r.matched);
  const unmatched = results.filter(r => !r.matched);

  const consolidado = {
    totalArquivos: results.length,
    identificados: matched.length,
    naoIdentificados: unmatched.length,
    saldoTotal: results.reduce((s, r) => s + (r.saldo || 0), 0),
    totalCreditos: results.reduce((s, r) => s + r.totalCreditos, 0),
    totalDebitos: results.reduce((s, r) => s + r.totalDebitos, 0),
    totalTransacoes: results.reduce((s, r) => s + r.totalTransactions, 0),
  };

  // Agrupar por banco
  const porBanco = {};
  results.forEach(r => {
    const banco = r.bankName || 'Desconhecido';
    if (!porBanco[banco]) porBanco[banco] = { contas: 0, saldoTotal: 0, arquivos: [] };
    porBanco[banco].contas++;
    porBanco[banco].saldoTotal += r.saldo || 0;
    porBanco[banco].arquivos.push(r.summary);
  });

  return { results, matched, unmatched, consolidado, porBanco };
}

// ─── Ler File como texto (com fallback encoding) ────────────────

export function readOFXFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      let content = e.target.result;
      if (content.includes('�')) {
        const reader2 = new FileReader();
        reader2.onload = (e2) => resolve({ name: file.name, content: e2.target.result });
        reader2.onerror = reject;
        reader2.readAsText(file, 'windows-1252');
      } else {
        resolve({ name: file.name, content });
      }
    };
    reader.onerror = reject;
    reader.readAsText(file, 'utf-8');
  });
}

// ─── Formatação BRL ──────────────────────────────────────────────

export function formatBRL(value) {
  if (value == null || isNaN(value)) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
