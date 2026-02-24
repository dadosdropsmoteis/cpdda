/**
 * OFXSection.jsx
 * 
 * Seção de Extratos OFX para o dashboard financeiro.
 * Segue o mesmo padrão visual do App.jsx (Tailwind, cores indigo, tabelas).
 * 
 * Para integrar no App.jsx:
 * 
 *   1. Importar no topo:
 *      import OFXSection from './components/OFXSection';
 * 
 *   2. Adicionar no JSX (ex: antes do fechamento do container principal):
 *      <OFXSection />
 * 
 *   Pronto! A seção tem upload próprio e funciona de forma independente.
 */

import React, { useState, useCallback } from 'react';
import { parseMultipleOFX, readOFXFile, formatBRL } from '../utils/ofxParser';
import accountsMap from '../data/accountsMap';

export default function OFXSection({ dados = [], datasVisiveis = [] }) {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandida, setExpandida] = useState(true);
  const [tabelaTransposta, setTabelaTransposta] = useState(false);
  const [detalheAberto, setDetalheAberto] = useState(null); // índice do arquivo com transações abertas
  const [mostrarSugestoes, setMostrarSugestoes] = useState(true);
  const [ordenacao, setOrdenacao] = useState({ campo: 'fantasia', direcao: 'asc' });

  const handleFiles = useCallback(async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    setLoading(true);
    try {
      console.log('📁 Arquivos OFX carregados:', files.map(f => f.name));
      console.log('🗺️ AccountsMap tem', Object.keys(accountsMap).length, 'entradas');
      console.log('🔑 Chaves do map:', Object.keys(accountsMap).slice(0, 5), '...');
      
      const fileContents = await Promise.all(files.map(readOFXFile));
      const data = parseMultipleOFX(fileContents, accountsMap);
      
      console.log('✅ Parsing completo. Resultados:', data);
      
      // Calcular projeções cruzando com despesas
      const resultadosComProjecao = data.results.map(conta => {
        const despesasPorData = calcularDespesasPorConta(
          conta.summary.fantasia,
          conta.summary.cnpj
        );

        // Ordenar datas
        const datasOrdenadas = [...datasVisiveis].sort((a, b) => {
          const [diaA, mesA, anoA] = a.split('/');
          const [diaB, mesB, anoB] = b.split('/');
          return new Date(anoA, mesA - 1, diaA) - new Date(anoB, mesB - 1, diaB);
        });

        // Calcular saldo por dia
        const projecaoDiaria = [];
        let saldoAcumulado = conta.saldo || 0;

        datasOrdenadas.forEach(data => {
          const despesaDia = despesasPorData[data] || 0;
          saldoAcumulado -= despesaDia;
          projecaoDiaria.push({
            data,
            despesas: despesaDia,
            saldoAposLancamentos: saldoAcumulado
          });
        });

        const saldoFinal = projecaoDiaria.length > 0 
          ? projecaoDiaria[projecaoDiaria.length - 1].saldoAposLancamentos 
          : conta.saldo;

        return {
          ...conta,
          despesasTotais: Object.values(despesasPorData).reduce((a, b) => a + b, 0),
          projecaoDiaria,
          saldoFinal,
          ficaNegativo: saldoFinal < 0
        };
      });

      setResults({
        ...data,
        results: resultadosComProjecao
      });
      setDetalheAberto(null);
    } catch (err) {
      console.error('❌ Erro no parsing:', err);
      alert(`Erro ao processar OFX: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const limparDados = () => {
    setResults(null);
    setDetalheAberto(null);
  };

  // Função para extrair raiz do CNPJ (primeiros 8 dígitos)
  const getRaizCNPJ = (cnpj) => {
    if (!cnpj) return null;
    const limpo = cnpj.replace(/[^\d]/g, '');
    return limpo.substring(0, 8);
  };

  // Função para sugerir transferências inteligentes
  const sugerirTransferencias = (contas) => {
    const contasNegativas = contas.filter(c => c.ficaNegativo);
    const contasPositivas = contas.filter(c => !c.ficaNegativo && c.saldoFinal > 0);
    if (contasNegativas.length === 0) return [];
    const sugestoes = [];
    contasNegativas.forEach(contaNegativa => {
      const raizNegativa = getRaizCNPJ(contaNegativa.summary.cnpj);
      const deficit = Math.abs(contaNegativa.saldoFinal);
      let valorRestante = deficit;
      const contasMesmaUnidade = contasPositivas.filter(
        c => c.summary.cnpj === contaNegativa.summary.cnpj && c !== contaNegativa
      );
      contasMesmaUnidade.forEach(origem => {
        if (valorRestante <= 0) return;
        const valorTransferencia = Math.min(valorRestante, origem.saldoFinal);
        if (valorTransferencia > 0) {
          sugestoes.push({
            de: origem.summary.fantasia, deBanco: origem.summary.banco,
            para: contaNegativa.summary.fantasia, paraBanco: contaNegativa.summary.banco,
            valor: valorTransferencia, tipo: 'Mesma Unidade', prioridade: 1
          });
          valorRestante -= valorTransferencia;
        }
      });
      if (valorRestante > 0 && raizNegativa) {
        const contasMesmaRaiz = contasPositivas.filter(c => {
          const raizOrigem = getRaizCNPJ(c.summary.cnpj);
          return raizOrigem === raizNegativa && c.summary.cnpj !== contaNegativa.summary.cnpj;
        });
        contasMesmaRaiz.forEach(origem => {
          if (valorRestante <= 0) return;
          const valorTransferencia = Math.min(valorRestante, origem.saldoFinal * 0.8);
          if (valorTransferencia >= 100) {
            sugestoes.push({
              de: origem.summary.fantasia, deBanco: origem.summary.banco,
              para: contaNegativa.summary.fantasia, paraBanco: contaNegativa.summary.banco,
              valor: valorTransferencia, tipo: 'Entre Unidades (mesma raiz CNPJ)', prioridade: 2
            });
            valorRestante -= valorTransferencia;
          }
        });
      }
      if (valorRestante > 100) {
        sugestoes.push({
          de: 'APORTE EXTERNO', deBanco: '',
          para: contaNegativa.summary.fantasia, paraBanco: contaNegativa.summary.banco,
          valor: valorRestante, tipo: 'Aporte Necessário', prioridade: 3
        });
      }
    });
    return sugestoes.sort((a, b) => a.prioridade - b.prioridade);
  };

  // Função auxiliar para buscar campo
  const buscarCampo = (item, ...nomes) => {
    for (const nome of nomes) {
      if (item[nome] !== undefined && item[nome] !== null && item[nome] !== '') return item[nome];
    }
    const chaves = Object.keys(item);
    for (const nome of nomes) {
      const chave = chaves.find(k => k.trim().toLowerCase() === nome.trim().toLowerCase());
      if (chave && item[chave] !== undefined && item[chave] !== null && item[chave] !== '') return item[chave];
    }
    return undefined;
  };

  // Função para parsear valor
  const parsearValor = (valorStr) => {
    if (!valorStr) return 0;
    const str = String(valorStr).replace(/[^\d,.-]/g, '');
    if (!str) return 0;
    const temVirgula = str.includes(',');
    const temPonto = str.includes('.');
    if (temVirgula && temPonto) {
      const posVirgula = str.lastIndexOf(',');
      const posPonto = str.lastIndexOf('.');
      if (posVirgula > posPonto) {
        return parseFloat(str.replace(/\./g, '').replace(',', '.'));
      } else {
        return parseFloat(str.replace(/,/g, ''));
      }
    } else if (temVirgula) {
      return parseFloat(str.replace(',', '.'));
    } else {
      return parseFloat(str);
    }
  };

  // Calcular despesas por conta e data
  const calcularDespesasPorConta = (fantasia, cnpj) => {
    if (!dados || dados.length === 0) return {};
    const despesasPorData = {};
    dados.forEach(item => {
      const filial = buscarCampo(item, 'Filial');
      const dataVencimento = buscarCampo(item, 'Vencimento');
      const valorRaw = buscarCampo(item, 'Valor');
      const valor = parsearValor(valorRaw);
      if (filial === fantasia && datasVisiveis.includes(dataVencimento)) {
        if (!despesasPorData[dataVencimento]) {
          despesasPorData[dataVencimento] = 0;
        }
        despesasPorData[dataVencimento] += valor;
      }
    });
    return despesasPorData;
  };

  const fmt = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Ordenar resultados
  const resultadosOrdenados = results ? [...results.results].sort((a, b) => {
    const dir = ordenacao.direcao === 'asc' ? 1 : -1;
    switch (ordenacao.campo) {
      case 'fantasia':
        return dir * a.summary.fantasia.localeCompare(b.summary.fantasia);
      case 'banco':
        return dir * (a.summary.banco || '').localeCompare(b.summary.banco || '');
      case 'saldo':
        return dir * ((a.saldo || 0) - (b.saldo || 0));
      case 'creditos':
        return dir * (a.totalCreditos - b.totalCreditos);
      case 'debitos':
        return dir * (a.totalDebitos - b.totalDebitos);
      default:
        return 0;
    }
  }) : [];

  const sugestoesTransferencia = results ? sugerirTransferencias(resultadosOrdenados) : [];

  const toggleOrdenacao = (campo) => {
    setOrdenacao(prev => ({
      campo,
      direcao: prev.campo === campo && prev.direcao === 'asc' ? 'desc' : 'asc',
    }));
  };

  const SortIcon = ({ campo }) => {
    if (ordenacao.campo !== campo) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="text-indigo-600 ml-1">{ordenacao.direcao === 'asc' ? '↑' : '↓'}</span>;
  };

  // Cor do banco (mesma lógica do getCorPorConta no App.jsx)
  const getCorBanco = (nomeBanco) => {
    if (!nomeBanco) return '#757575';
    const n = nomeBanco.toLowerCase();
    if (n.includes('itaú') || n.includes('itau')) return '#FF6600';
    if (n.includes('sicredi')) return '#00A859';
    if (n.includes('santander')) return '#EC0000';
    if (n.includes('bradesco')) return '#CC092F';
    if (n.includes('banco do brasil')) return '#FFCC00';
    if (n.includes('caixa')) return '#0066B3';
    return '#6366f1';
  };

  return (
    <div className="mt-6 print-area">
      {/* Cabeçalho da seção */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div
          className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
          onClick={() => setExpandida(!expandida)}
        >
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <svg className="h-5 w-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            Extratos Bancários (OFX)
            {results && (
              <span className="text-sm font-normal text-gray-500 ml-2">
                — {results.consolidado.totalArquivos} arquivo(s) carregado(s)
              </span>
            )}
          </h2>
          <svg
            className={`h-5 w-5 text-gray-400 transition-transform ${expandida ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {expandida && (
          <div className="px-4 pb-4">
            {/* Upload */}
            <div className="flex items-center gap-3 mb-4 no-print">
              <label className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg cursor-pointer transition-colors">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Upload OFX
                <input
                  type="file"
                  accept=".ofx"
                  multiple
                  onChange={handleFiles}
                  className="hidden"
                />
              </label>
              <span className="text-xs text-gray-500">Selecione um ou mais arquivos .ofx</span>
              {results && (
                <button
                  onClick={limparDados}
                  className="ml-auto px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors"
                >
                  Limpar
                </button>
              )}
            </div>

            {loading && (
              <div className="text-center py-8 text-gray-500">
                <svg className="animate-spin h-8 w-8 mx-auto text-indigo-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="mt-2 text-sm">Processando extratos...</p>
              </div>
            )}

            {results && !loading && (
              <>
                {/* Cards resumo */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
                  <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg p-3 border border-indigo-200">
                    <div className="text-xs text-indigo-600 font-medium">Arquivos</div>
                    <div className="text-xl font-bold text-indigo-800">{results.consolidado.totalArquivos}</div>
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 border border-green-200">
                    <div className="text-xs text-green-600 font-medium">Identificados</div>
                    <div className="text-xl font-bold text-green-800">{results.consolidado.identificados}</div>
                  </div>
                  {results.consolidado.naoIdentificados > 0 && (
                    <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-3 border border-amber-200">
                      <div className="text-xs text-amber-600 font-medium">Não Identificados</div>
                      <div className="text-xl font-bold text-amber-800">{results.consolidado.naoIdentificados}</div>
                    </div>
                  )}
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200">
                    <div className="text-xs text-blue-600 font-medium">Saldo Total</div>
                    <div className="text-lg font-bold text-blue-800">{formatBRL(results.consolidado.saldoTotal)}</div>
                  </div>
                  <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-3 border border-emerald-200">
                    <div className="text-xs text-emerald-600 font-medium">Total Créditos</div>
                    <div className="text-lg font-bold text-emerald-800">{formatBRL(results.consolidado.totalCreditos)}</div>
                  </div>
                  <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-3 border border-red-200">
                    <div className="text-xs text-red-600 font-medium">Total Débitos</div>
                    <div className="text-lg font-bold text-red-800">{formatBRL(results.consolidado.totalDebitos)}</div>
                  </div>
                </div>

                {/* Resumo por banco */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {Object.entries(results.porBanco).map(([banco, info]) => (
                    <div
                      key={banco}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full border border-gray-200 text-xs"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: getCorBanco(banco) }}
                      />
                      <span className="font-medium text-gray-700">{banco}</span>
                      <span className="text-gray-400">|</span>
                      <span className="text-gray-600">{info.contas} conta(s)</span>
                      <span className="text-gray-400">|</span>
                      <span className="font-medium text-gray-800">{formatBRL(info.saldoTotal)}</span>
                    </div>
                  ))}
                </div>

                {/* Botão transpor */}
                <div className="flex items-center gap-2 mb-2 no-print">
                  <button
                    onClick={() => setTabelaTransposta(!tabelaTransposta)}
                    className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                    {tabelaTransposta ? 'Visão Normal' : 'Transpor Tabela'}
                  </button>
                </div>

                {/* Tabela principal */}
                <div className="table-container overflow-x-auto max-h-[600px] overflow-y-auto">
                  {!tabelaTransposta ? (
                    /* Visão normal: linhas = contas */
                    <table className="min-w-full border border-gray-200 text-xs">
                      <thead className="bg-indigo-600 text-white sticky top-0 z-10">
                        <tr>
                          <th className="border border-indigo-500 px-3 py-2 text-left cursor-pointer hover:bg-indigo-700" onClick={() => toggleOrdenacao('fantasia')}>
                            Fantasia <SortIcon campo="fantasia" />
                          </th>
                          <th className="border border-indigo-500 px-3 py-2 text-left cursor-pointer hover:bg-indigo-700" onClick={() => toggleOrdenacao('banco')}>
                            Banco <SortIcon campo="banco" />
                          </th>
                          <th className="border border-indigo-500 px-3 py-2 text-left">Conta</th>
                          <th className="border border-indigo-500 px-3 py-2 text-left">Cidade</th>
                          <th className="border border-indigo-500 px-3 py-2 text-center">Período</th>
                          <th className="border border-indigo-500 px-3 py-2 text-right cursor-pointer hover:bg-indigo-700" onClick={() => toggleOrdenacao('saldo')}>
                            Saldo <SortIcon campo="saldo" />
                          </th>
                          <th className="border border-indigo-500 px-3 py-2 text-right cursor-pointer hover:bg-indigo-700" onClick={() => toggleOrdenacao('creditos')}>
                            Créditos <SortIcon campo="creditos" />
                          </th>
                          <th className="border border-indigo-500 px-3 py-2 text-right cursor-pointer hover:bg-indigo-700" onClick={() => toggleOrdenacao('debitos')}>
                            Débitos <SortIcon campo="debitos" />
                          </th>
                          <th className="border border-indigo-500 px-3 py-2 text-center">Transações</th>
                          <th className="border border-indigo-500 px-3 py-2 text-center no-print">Detalhe</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultadosOrdenados.map((r, i) => (
                          <React.Fragment key={i}>
                            <tr className={`${!r.matched ? 'bg-amber-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-indigo-50`}>
                              <td className="border border-gray-200 px-3 py-2 font-semibold text-gray-800 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className="w-2 h-2 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: getCorBanco(r.summary.banco) }}
                                  />
                                  {r.summary.fantasia}
                                </div>
                              </td>
                              <td className="border border-gray-200 px-3 py-2 text-gray-600 whitespace-nowrap">{r.summary.banco}</td>
                              <td className="border border-gray-200 px-3 py-2 text-gray-600 font-mono text-xs">{r.summary.conta}</td>
                              <td className="border border-gray-200 px-3 py-2 text-gray-600 whitespace-nowrap">{r.summary.cidade}</td>
                              <td className="border border-gray-200 px-3 py-2 text-center text-gray-600 whitespace-nowrap">{r.summary.periodo}</td>
                              <td className={`border border-gray-200 px-3 py-2 text-right font-semibold whitespace-nowrap ${r.saldo >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                                {r.saldo != null ? formatBRL(r.saldo) : '—'}
                              </td>
                              <td className="border border-gray-200 px-3 py-2 text-right text-emerald-600 whitespace-nowrap">
                                {r.totalCreditos > 0 ? formatBRL(r.totalCreditos) : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="border border-gray-200 px-3 py-2 text-right text-red-500 whitespace-nowrap">
                                {r.totalDebitos > 0 ? formatBRL(r.totalDebitos) : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="border border-gray-200 px-3 py-2 text-center text-gray-700">{r.totalTransactions}</td>
                              <td className="border border-gray-200 px-3 py-2 text-center no-print">
                                <button
                                  onClick={() => setDetalheAberto(detalheAberto === i ? null : i)}
                                  className="text-indigo-600 hover:text-indigo-800 text-xs font-medium"
                                >
                                  {detalheAberto === i ? 'Fechar' : 'Ver'}
                                </button>
                              </td>
                            </tr>

                            {/* Detalhe de transações */}
                            {detalheAberto === i && (
                              <tr>
                                <td colSpan={10} className="border border-gray-200 p-0">
                                  <div className="bg-gray-50 p-3 max-h-64 overflow-y-auto">
                                    <div className="text-xs font-semibold text-gray-600 mb-2">
                                      Transações — {r.summary.fantasia} ({r.summary.banco})
                                    </div>
                                    <table className="min-w-full border border-gray-200 text-xs">
                                      <thead className="bg-gray-200">
                                        <tr>
                                          <th className="border border-gray-300 px-2 py-1 text-left">Data</th>
                                          <th className="border border-gray-300 px-2 py-1 text-left">Tipo</th>
                                          <th className="border border-gray-300 px-2 py-1 text-left">Descrição</th>
                                          <th className="border border-gray-300 px-2 py-1 text-right">Valor</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {r.transactions.map((t, ti) => (
                                          <tr key={ti} className={ti % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                            <td className="border border-gray-200 px-2 py-1 whitespace-nowrap">{t.dateFormatted}</td>
                                            <td className="border border-gray-200 px-2 py-1">
                                              <span className={`px-1.5 py-0.5 rounded text-xs ${t.isCredit ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                {t.isCredit ? 'C' : 'D'}
                                              </span>
                                            </td>
                                            <td className="border border-gray-200 px-2 py-1 max-w-xs truncate">{t.memo}</td>
                                            <td className={`border border-gray-200 px-2 py-1 text-right font-mono whitespace-nowrap ${t.isCredit ? 'text-emerald-600' : 'text-red-500'}`}>
                                              {formatBRL(t.amount)}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}

                        {/* Linha Total */}
                        <tr className="bg-indigo-50 font-bold">
                          <td className="border border-gray-200 px-3 py-2 text-gray-800" colSpan={5}>
                            TOTAL ({results.consolidado.totalArquivos} contas)
                          </td>
                          <td className={`border border-gray-200 px-3 py-2 text-right whitespace-nowrap ${results.consolidado.saldoTotal >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                            {formatBRL(results.consolidado.saldoTotal)}
                          </td>
                          <td className="border border-gray-200 px-3 py-2 text-right text-emerald-600 whitespace-nowrap">
                            {formatBRL(results.consolidado.totalCreditos)}
                          </td>
                          <td className="border border-gray-200 px-3 py-2 text-right text-red-500 whitespace-nowrap">
                            {formatBRL(results.consolidado.totalDebitos)}
                          </td>
                          <td className="border border-gray-200 px-3 py-2 text-center text-gray-700">
                            {results.consolidado.totalTransacoes}
                          </td>
                          <td className="border border-gray-200 px-3 py-2 no-print"></td>
                        </tr>
                      </tbody>
                    </table>
                  ) : (
                    /* Visão transposta: colunas = contas */
                    <table className="min-w-full border border-gray-200 text-xs">
                      <thead className="bg-indigo-600 text-white sticky top-0 z-10">
                        <tr>
                          <th className="border border-indigo-500 px-3 py-2 text-left">Campo</th>
                          {resultadosOrdenados.map((r, i) => (
                            <th key={i} className="border border-indigo-500 px-3 py-2 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1">
                                <span
                                  className="w-2 h-2 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: getCorBanco(r.summary.banco) }}
                                />
                                {r.summary.fantasia}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { label: 'Banco', key: 'banco' },
                          { label: 'Conta', key: 'conta' },
                          { label: 'Cidade', key: 'cidade' },
                          { label: 'Período', key: 'periodo' },
                          { label: 'Saldo', key: 'saldo', format: 'brl', color: true },
                          { label: 'Créditos', key: 'totalCreditos', format: 'brl', colorClass: 'text-emerald-600' },
                          { label: 'Débitos', key: 'totalDebitos', format: 'brl', colorClass: 'text-red-500' },
                          { label: 'Transações', key: 'qtdTransacoes', align: 'center' },
                        ].map((row, ri) => (
                          <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="border border-gray-200 px-3 py-2 font-semibold text-gray-700 whitespace-nowrap bg-gray-100">
                              {row.label}
                            </td>
                            {resultadosOrdenados.map((r, ci) => {
                              let value;
                              if (row.key === 'saldo') value = r.saldo;
                              else if (row.key === 'totalCreditos') value = r.totalCreditos;
                              else if (row.key === 'totalDebitos') value = r.totalDebitos;
                              else if (row.key === 'qtdTransacoes') value = r.totalTransactions;
                              else value = r.summary[row.key];

                              let display = value;
                              let className = 'border border-gray-200 px-3 py-2 whitespace-nowrap';

                              if (row.format === 'brl') {
                                display = value != null ? formatBRL(value) : '—';
                                className += ' text-right';
                                if (row.color) {
                                  className += value >= 0 ? ' text-emerald-700 font-semibold' : ' text-red-600 font-semibold';
                                }
                                if (row.colorClass) className += ` ${row.colorClass}`;
                              } else if (row.align === 'center') {
                                className += ' text-center';
                              }

                              return <td key={ci} className={className}>{display}</td>;
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Alertas contas não identificadas */}
                {results.unmatched.length > 0 && (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs">
                    <div className="flex items-center gap-2 font-semibold text-amber-800 mb-1">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      Contas não encontradas na tabela de motéis:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {results.unmatched.map((r, i) => (
                        <span key={i} className="px-2 py-1 bg-amber-100 rounded text-amber-700">
                          {r.fileName} → Banco {r.bankId} / Conta {r.acctId}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Estado vazio */}
            {!results && !loading && (
              <div className="text-center py-8 text-gray-500">
                <svg className="mx-auto h-10 w-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                <p className="mt-3 text-sm">Faça upload de arquivos OFX para visualizar os extratos bancários</p>
                <p className="text-xs mt-1 text-gray-400">Os arquivos serão cruzados automaticamente com a tabela de contas</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
