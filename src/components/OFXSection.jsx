import React, { useState, useCallback, useMemo } from 'react';
import { parseMultipleOFX, readOFXFile, formatBRL } from '../utils/ofxParser';
import accountsMap from '../data/accountsMap';

export default function OFXSection({ dados = [], datasVisiveis = [] }) {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandida, setExpandida] = useState(true);
  const [detalheAberto, setDetalheAberto] = useState(null);
  const [mostrarSugestoes, setMostrarSugestoes] = useState(true);
  const [ordenacao, setOrdenacao] = useState({ campo: 'saldoFinal', direcao: 'asc' });
  const [transferenciasConfirmadas, setTransferenciasConfirmadas] = useState([]);
  const [modalAdicionarConta, setModalAdicionarConta] = useState(false);
  const [novaContaForm, setNovaContaForm] = useState({ filial: '', banco: '', saldoInicial: '0' });
  const [modalSantanderAPI, setModalSantanderAPI] = useState(false);
  const [santanderConfig, setSantanderConfig] = useState({
    filial: '',
    accountNumber: ''
  });
  const [filiaisDisponiveis, setFiliaisDisponiveis] = useState([]);
  const [loadingSantander, setLoadingSantander] = useState(false);

  // Normalizar nome da filial (remover "Drops " do início)
  const normalizarNomeFilial = (nome) => {
    if (!nome) return nome;
    // Remover "Drops " ou "DROPS " do início (case insensitive)
    return nome.replace(/^drops\\s+/i, '').trim();
  };
  
  // Mapear nomes equivalentes (OFX → Excel)
  const mapearNomeFilial = (nome) => {
    if (!nome) return nome;
    
    // Normalizar primeiro (remover "Drops ")
    let nomeNormalizado = normalizarNomeFilial(nome);
    
    // Mapeamento de nomes especiais
    const mapeamentos = {
      'barretos matriz': 'barretos',
      'barretos express': 'barretos express',
      'drops rio preto': 'rio preto',
      'rio preto': 'rio preto',
      'vale dos sinos': 'vale dos sinos',
      'araraquara': 'araraquara',
      'drops campinas': 'campinas',
      'campinas': 'campinas',
      'drops ribeirao preto': 'ribeirao preto',
      'ribeirao preto': 'ribeirao preto',
      'dps goiânia': 'goiania',
      'dps goiania': 'goiania',
      'goiânia': 'goiania',
      'goiania': 'goiania',
      'grand dubai': 'caxias do sul',
      'caxias do sul': 'caxias do sul',
      'drops brasília': 'brasilia',
      'drops brasilia': 'brasilia',
      'brasília': 'brasilia',
      'brasilia': 'brasilia',
      'xangai (sleo express)': 'xangai',
      'xangai': 'xangai',
      'champagne': 'tubarao',
      'tubarao': 'tubarao',
      'tubarão': 'tubarao',
      'drops palhoça': 'palhoca',
      'drops palhoca': 'palhoca',
      'palhoça': 'palhoca',
      'palhoca': 'palhoca',
      'dps porto alegre': 'porto alegre',
      'porto alegre': 'porto alegre',
      'baviera': 'novo hamburgo',
      'novo hamburgo': 'novo hamburgo',
      'rv bangalo': 'rv bangalo',
      'bangalo': 'bangalo',
      'bangalô': 'bangalo',
      'poa taiko': 'poa zona norte',
      'poa zona norte': 'poa zona norte',
      'camelot (sleo)': 'camelot',
      'camelot': 'camelot'
    };
    
    const nomeMinusculo = nomeNormalizado.toLowerCase();
    return mapeamentos[nomeMinusculo] || nomeNormalizado;
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
  
  // Capitalizar nome da filial (Primeira letra maiúscula, resto minúscula)
  const capitalizarNome = (nome) => {
    if (!nome) return nome;
    return nome
      .toLowerCase()
      .split(' ')
      .map(palavra => {
        // Exceções que devem permanecer em maiúsculas
        if (['rv', 'poa', 'dps'].includes(palavra.toLowerCase())) {
          return palavra.toUpperCase();
        }
        // Primeira letra maiúscula
        return palavra.charAt(0).toUpperCase() + palavra.slice(1);
      })
      .join(' ');
  };

  // Função para normalizar data do Excel para dd/mm/yyyy
  const normalizarData = (data) => {
    if (!data) return null;
    // Se já é string no formato dd/mm/yyyy
    if (typeof data === 'string' && data.includes('/')) return data;
    // Se é objeto Date ou string ISO
    try {
      const d = new Date(data);
      const dia = String(d.getDate()).padStart(2, '0');
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const ano = d.getFullYear();
      return `${dia}/${mes}/${ano}`;
    } catch {
      return null;
    }
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
  const calcularDespesasPorConta = (fantasia, banco) => {
    if (!dados || dados.length === 0) return {};
    const despesasPorData = {};
    
    // Mapear nome da fantasia do OFX
    const fantasiaMapeada = mapearNomeFilial(fantasia);
    
    dados.forEach(item => {
      // Buscar pelos nomes corretos das colunas do Excel
      const filialRaw = buscarCampo(item, 'Minha Empresa (Nome Fantasia)', 'Filial');
      const filialMapeada = mapearNomeFilial(filialRaw);
      const contaCorrente = buscarCampo(item, 'Conta Corrente');
      const dataVencimentoRaw = buscarCampo(item, 'Data de Vencimento', 'Vencimento');
      const dataVencimento = normalizarData(dataVencimentoRaw);
      const valorRaw = buscarCampo(item, 'Valor da Conta', 'Valor');
      const valor = Math.abs(parsearValor(valorRaw)); // Usar valor absoluto
      
      // Verificar se a Filial corresponde (case insensitive e mapeada)
      const filialMatch = filialMapeada && filialMapeada.toLowerCase() === fantasiaMapeada.toLowerCase();
      
      // Verificar Conta Corrente - para Santander pode ter @ ou não
      let contaMatch = false;
      if (banco && banco.toLowerCase().includes('santander')) {
        contaMatch = contaCorrente === `@${banco}` || contaCorrente === banco || contaCorrente === '@Santander';
      } else {
        contaMatch = contaCorrente === banco;
      }
      
      // Ambos devem corresponder + estar nas datas visíveis
      if (filialMatch && contaMatch && dataVencimento && datasVisiveis.includes(dataVencimento)) {
        if (!despesasPorData[dataVencimento]) {
          despesasPorData[dataVencimento] = 0;
        }
        despesasPorData[dataVencimento] += valor;
      }
    });
    return despesasPorData;
  };

  // Função para extrair raiz do CNPJ
  const getRaizCNPJ = (cnpj) => {
    if (!cnpj) return null;
    const limpo = cnpj.replace(/[^\d]/g, '');
    return limpo.substring(0, 8);
  };

  // Buscar saldos via API Santander (através do backend)
  const buscarSaldosSantander = async () => {
    if (!santanderConfig.filial) {
      alert('Por favor, selecione uma filial');
      return;
    }
    
    setLoadingSantander(true);
    
    try {
      console.log(`🏦 Buscando saldos para ${santanderConfig.filial}...`);
      console.log('📍 URL:', window.location.origin + '/api/santander');
      
      // Chamar backend serverless
      const response = await fetch('/api/santander', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filial: santanderConfig.filial,
          accountNumber: santanderConfig.accountNumber || undefined
        })
      });
      
      console.log('📡 Status da resposta:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Erro da API:', errorData);
        
        if (errorData.filiaisDisponiveis) {
          setFiliaisDisponiveis(errorData.filiaisDisponiveis);
          alert(`Filial não encontrada. Filiais disponíveis: ${errorData.filiaisDisponiveis.join(', ')}`);
        } else {
          alert(`Erro: ${errorData.error || 'Erro desconhecido'}\n\nDetalhes: ${errorData.message || ''}`);
        }
        
        setLoadingSantander(false);
        return;
      }
      
      const apiResponse = await response.json();
      console.log('✅ Resposta recebida:', apiResponse);
      
      if (!apiResponse.success) {
        alert('Erro ao buscar saldos');
        setLoadingSantander(false);
        return;
      }
      
      // Processar resultados
      const resultadosAPI = apiResponse.results
        .filter(r => r.success)
        .map(r => ({
          accountNumber: r.accountNumber,
          data: r.data
        }));
      
      if (resultadosAPI.length === 0) {
        alert('Nenhuma conta foi carregada com sucesso. Verifique os logs no Vercel.');
        setLoadingSantander(false);
        return;
      }
      
      // Converter resposta da API para formato compatível com OFX
      const contasSantander = resultadosAPI.map(resultado => {
        const { accountNumber, data } = resultado;
        
        // Buscar informações da conta no accountsMap
        const lookupKey = `0033_${accountNumber}`;
        const contaInfo = accountsMap[lookupKey] || {
          fantasia: santanderConfig.filial,
          cnpj: '00000000000000'
        };
        
        // Extrair saldo da resposta
        const saldo = data.balance?.availableBalance || 0;
        
        return {
          summary: {
            fantasia: capitalizarNome(contaInfo.fantasia || santanderConfig.filial),
            banco: 'Santander',
            conta: accountNumber,
            cnpj: contaInfo.cnpj,
            bankName: 'Santander',
            bankId: '0033'
          },
          saldo: saldo,
          saldoInicial: saldo,
          transactions: [],
          isSantanderAPI: true
        };
      });
      
      // Calcular projeções para as contas
      const contasComProjecao = contasSantander.map(conta => {
        const despesasPorData = calcularDespesasPorConta(conta.summary.fantasia, conta.summary.banco);
        
        const datasOrdenadas = [...datasVisiveis].sort((a, b) => {
          const [diaA, mesA, anoA] = a.split('/');
          const [diaB, mesB, anoB] = b.split('/');
          return new Date(anoA, mesA - 1, diaA) - new Date(anoB, mesB - 1, diaB);
        });
        
        const projecaoDiaria = [];
        let saldoAcumulado = conta.saldoInicial;
        
        datasOrdenadas.forEach(data => {
          const despesaDia = despesasPorData[data] || 0;
          saldoAcumulado -= despesaDia;
          projecaoDiaria.push({
            data,
            despesas: despesaDia,
            saldoAposLancamentos: saldoAcumulado
          });
        });
        
        const totalDespesas = Object.values(despesasPorData).reduce((a, b) => a + b, 0);
        const saldoFinal = conta.saldoInicial - totalDespesas;
        
        return {
          ...conta,
          despesasPrevistas: totalDespesas,
          saldoFinal,
          ficaNegativo: saldoFinal < 0,
          projecaoDiaria
        };
      });
      
      // Adicionar aos resultados existentes (ou criar novos)
      if (results) {
        setResults(prev => ({
          ...prev,
          results: [...prev.results, ...contasComProjecao],
          consolidado: {
            ...prev.consolidado,
            identificados: prev.consolidado.identificados + contasComProjecao.length,
            saldoTotal: prev.consolidado.saldoTotal + contasComProjecao.reduce((sum, c) => sum + c.saldoInicial, 0),
            despesasTotal: prev.consolidado.despesasTotal + contasComProjecao.reduce((sum, c) => sum + (c.despesasPrevistas || 0), 0),
            saldoFinalTotal: prev.consolidado.saldoFinalTotal + contasComProjecao.reduce((sum, c) => sum + c.saldoFinal, 0)
          }
        }));
      } else {
        // Criar estrutura de results se não existir
        const consolidado = {
          identificados: contasComProjecao.length,
          saldoTotal: contasComProjecao.reduce((sum, c) => sum + c.saldoInicial, 0),
          despesasTotal: contasComProjecao.reduce((sum, c) => sum + (c.despesasPrevistas || 0), 0),
          saldoFinalTotal: contasComProjecao.reduce((sum, c) => sum + c.saldoFinal, 0)
        };
        
        setResults({
          results: contasComProjecao,
          consolidado
        });
      }
      
      alert(`✅ ${contasComProjecao.length} conta(s) Santander carregada(s) com sucesso!`);
      setModalSantanderAPI(false);
      setSantanderConfig(prev => ({ ...prev, accountNumber: '' }));
      
    } catch (error) {
      console.error('❌ Erro completo:', error);
      console.error('❌ Stack:', error.stack);
      
      let errorMessage = 'Erro ao conectar com API Santander: ' + error.message;
      
      if (error.message === 'Failed to fetch') {
        errorMessage += '\n\n🔍 Possíveis causas:\n';
        errorMessage += '1. Pasta /api não foi deployada\n';
        errorMessage += '2. Vercel não reconheceu a serverless function\n';
        errorMessage += '3. Problema de rede\n\n';
        errorMessage += '📋 Abra o console (F12) e verifique os logs!';
      }
      
      alert(errorMessage);
    } finally {
      setLoadingSantander(false);
    }
  };


  // Processar CSV de saldos
  const handleCSVUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Validar se há dados do Excel
    if (!dados || dados.length === 0) {
      alert('⚠️ Por favor, faça upload do arquivo Excel de despesas primeiro!');
      event.target.value = '';
      return;
    }
    
    if (!datasVisiveis || datasVisiveis.length === 0) {
      alert('⚠️ Nenhuma data visível encontrada. Verifique o arquivo Excel.');
      event.target.value = '';
      return;
    }
    
    try {
      setLoading(true);
      const text = await file.text();
      const linhas = text.split('\n').filter(l => l.trim());
      
      // Parse CSV (pular cabeçalho)
      const contas = linhas.slice(1).map(linha => {
        const [filial, agencia, conta, saldo] = linha.split(',');
        return {
          filial: filial?.trim(),
          saldo: parseFloat(saldo?.trim() || 0)
        };
      }).filter(c => c.filial && !isNaN(c.saldo));
      
      // Converter para formato OFX
      const contasFormatadas = contas.map(c => ({
        summary: {
          fantasia: capitalizarNome(c.filial),
          banco: 'Santander',
          conta: 'CSV',
          cnpj: '00000000000000',
          bankName: 'Santander',
          bankId: '0033'
        },
        saldo: c.saldo,
        saldoInicial: c.saldo,
        transactions: [],
        isCSVImport: true
      }));
      
      // Calcular projeções
      const contasComProjecao = contasFormatadas.map(conta => {
        const despesasPorData = calcularDespesasPorConta(conta.summary.fantasia, conta.summary.banco);
        const datasOrdenadas = [...datasVisiveis].sort((a, b) => {
          const [diaA, mesA, anoA] = a.split('/');
          const [diaB, mesB, anoB] = b.split('/');
          return new Date(anoA, mesA - 1, diaA) - new Date(anoB, mesB - 1, diaB);
        });
        
        const projecaoDiaria = [];
        let saldoAcumulado = conta.saldoInicial;
        datasOrdenadas.forEach(data => {
          const despesaDia = despesasPorData[data] || 0;
          saldoAcumulado -= despesaDia;
          projecaoDiaria.push({ data, despesas: despesaDia, saldoAposLancamentos: saldoAcumulado });
        });
        
        const totalDespesas = Object.values(despesasPorData).reduce((a, b) => a + b, 0);
        const saldoFinal = conta.saldoInicial - totalDespesas;
        
        return { ...conta, despesasPrevistas: totalDespesas, saldoFinal, ficaNegativo: saldoFinal < 0, projecaoDiaria };
      });
      
      // Adicionar aos resultados
      if (results) {
        setResults(prev => ({
          ...prev,
          results: [...prev.results, ...contasComProjecao],
          consolidado: {
            ...prev.consolidado,
            identificados: prev.consolidado.identificados + contasComProjecao.length,
            saldoTotal: prev.consolidado.saldoTotal + contasComProjecao.reduce((sum, c) => sum + c.saldoInicial, 0),
            despesasTotal: prev.consolidado.despesasTotal + contasComProjecao.reduce((sum, c) => sum + (c.despesasPrevistas || 0), 0),
            saldoFinalTotal: prev.consolidado.saldoFinalTotal + contasComProjecao.reduce((sum, c) => sum + c.saldoFinal, 0)
          }
        }));
      } else {
        const consolidado = {
          identificados: contasComProjecao.length,
          saldoTotal: contasComProjecao.reduce((sum, c) => sum + c.saldoInicial, 0),
          despesasTotal: contasComProjecao.reduce((sum, c) => sum + (c.despesasPrevistas || 0), 0),
          saldoFinalTotal: contasComProjecao.reduce((sum, c) => sum + c.saldoFinal, 0)
        };
        setResults({ results: contasComProjecao, consolidado });
      }
      
      alert(`✅ ${contasComProjecao.length} conta(s) importada(s)!`);
      event.target.value = '';
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao processar CSV: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Adicionar conta manualmente
  const adicionarContaManual = () => {
    if (!novaContaForm.filial || !novaContaForm.banco) {
      alert('Por favor, preencha Filial e Banco');
      return;
    }
    
    const novaConta = {
      summary: {
        fantasia: capitalizarNome(novaContaForm.filial),
        banco: capitalizarNome(novaContaForm.banco),
        conta: 'MANUAL',
        cnpj: '00000000000000', // Será atualizado depois se necessário
        bankName: novaContaForm.banco
      },
      saldoInicial: parseFloat(novaContaForm.saldoInicial) || 0,
      despesasPrevistas: 0,
      saldoFinal: parseFloat(novaContaForm.saldoInicial) || 0,
      ficaNegativo: false,
      projecaoDiaria: [],
      isManual: true
    };
    
    // Calcular despesas
    const despesasPorData = calcularDespesasPorConta(novaContaForm.filial, novaContaForm.banco);
    const datasOrdenadas = [...datasVisiveis].sort((a, b) => {
      const [diaA, mesA, anoA] = a.split('/');
      const [diaB, mesB, anoB] = b.split('/');
      return new Date(anoA, mesA - 1, diaA) - new Date(anoB, mesB - 1, diaB);
    });
    
    const projecaoDiaria = [];
    let saldoAcumulado = novaConta.saldoInicial;
    
    datasOrdenadas.forEach(data => {
      const despesaDia = despesasPorData[data] || 0;
      saldoAcumulado -= despesaDia;
      projecaoDiaria.push({
        data,
        despesas: despesaDia,
        saldoAposLancamentos: saldoAcumulado
      });
    });
    
    const totalDespesas = Object.values(despesasPorData).reduce((a, b) => a + b, 0);
    novaConta.despesasPrevistas = totalDespesas;
    novaConta.saldoFinal = novaConta.saldoInicial - totalDespesas;
    novaConta.ficaNegativo = novaConta.saldoFinal < 0;
    novaConta.projecaoDiaria = projecaoDiaria;
    
    // Adicionar aos resultados
    setResults(prev => ({
      ...prev,
      results: [...prev.results, novaConta]
    }));
    
    // Fechar modal e limpar form
    setModalAdicionarConta(false);
    setNovaContaForm({ filial: '', banco: '', saldoInicial: '0' });
  };

  // Toggle de confirmação de transferência
  const toggleTransferencia = (sugestao, indice) => {
    setTransferenciasConfirmadas(prev => {
      const existe = prev.find(t => t.indice === indice);
      if (existe) {
        // Remover
        return prev.filter(t => t.indice !== indice);
      } else {
        // Adicionar com dados completos
        return [...prev, { ...sugestao, indice, confirmada: true }];
      }
    });
  };

  // Calcular saldos ajustados com transferências confirmadas
  const calcularSaldosComTransferencias = (contas, sugestoes) => {
    const ajustes = {}; // { fantasia_banco: ajuste }
    
    sugestoes.forEach((s, i) => {
      if (transferenciasConfirmadas.some(t => t.indice === i) && s.prioridade !== 3) {
        // Chave origem
        const keyOrigem = `${s.de}_${s.deBanco}`;
        ajustes[keyOrigem] = (ajustes[keyOrigem] || 0) - s.valor;
        
        // Chave destino
        const keyDestino = `${s.para}_${s.paraBanco}`;
        ajustes[keyDestino] = (ajustes[keyDestino] || 0) + s.valor;
      }
    });
    
    return contas.map(c => {
      const key = `${c.summary.fantasia}_${c.summary.banco}`;
      const ajuste = ajustes[key] || 0;
      return {
        ...c,
        saldoFinalAjustado: c.saldoFinal + ajuste,
        temAjuste: ajuste !== 0,
        ajuste
      };
    });
  };

  // Função para calcular TODAS as sugestões dinamicamente baseado nas confirmadas
  const calcularSugestoesDinamicas = (contas, transferenciasConfirmadas) => {
    // 1. Calcular saldos atuais considerando transferências já confirmadas
    const saldosPorConta = {};
    contas.forEach(c => {
      const key = `${c.summary.fantasia}_${c.summary.banco}`;
      saldosPorConta[key] = {
        saldo: c.saldoFinal,
        fantasia: c.summary.fantasia,
        banco: c.summary.banco,
        cnpj: c.summary.cnpj
      };
    });
    
    // Aplicar transferências confirmadas aos saldos
    transferenciasConfirmadas.forEach(transferencia => {
      if (transferencia.prioridade !== 3) { // Ignorar aportes externos
        const keyOrigem = `${transferencia.de}_${transferencia.deBanco}`;
        const keyDestino = `${transferencia.para}_${transferencia.paraBanco}`;
        if (saldosPorConta[keyOrigem]) {
          saldosPorConta[keyOrigem].saldo -= transferencia.valor;
        }
        if (saldosPorConta[keyDestino]) {
          saldosPorConta[keyDestino].saldo += transferencia.valor;
        }
      }
    });
    
    // 2. Identificar contas negativas e positivas COM SALDOS ATUALIZADOS
    const contasNegativas = Object.entries(saldosPorConta)
      .filter(([_, info]) => info.saldo < 0)
      .map(([key, info]) => ({ key, ...info, deficit: Math.abs(info.saldo) }));
    
    const contasPositivas = Object.entries(saldosPorConta)
      .filter(([_, info]) => info.saldo > 0)
      .map(([key, info]) => ({ key, ...info }));
    
    if (contasNegativas.length === 0) return [];
    
    // 3. Gerar novas sugestões baseadas nos saldos atuais
    const novasSugestoes = [];
    
    contasNegativas.forEach(contaNegativa => {
      const raizNegativa = getRaizCNPJ(contaNegativa.cnpj);
      let valorRestante = contaNegativa.deficit;
      
      // Prioridade 1: Mesma Unidade (CNPJ completo igual)
      const contasMesmaUnidade = contasPositivas.filter(
        origem => origem.cnpj === contaNegativa.cnpj && origem.key !== contaNegativa.key
      );
      
      contasMesmaUnidade.forEach(origem => {
        if (valorRestante <= 0 || origem.saldo <= 0) return;
        const valorTransferencia = Math.min(valorRestante, origem.saldo);
        if (valorTransferencia > 0) {
          novasSugestoes.push({
            de: origem.fantasia,
            deBanco: origem.banco,
            para: contaNegativa.fantasia,
            paraBanco: contaNegativa.banco,
            valor: valorTransferencia,
            tipo: 'Mesma Unidade',
            prioridade: 1
          });
          valorRestante -= valorTransferencia;
          origem.saldo = 0; // IMPORTANTE: Zerar saldo pois usou 100%
        }
      });
      
      // Prioridade 2: Entre Unidades (mesma raiz CNPJ)
      if (valorRestante > 0 && raizNegativa) {
        const contasMesmaRaiz = contasPositivas.filter(origem => {
          const raizOrigem = getRaizCNPJ(origem.cnpj);
          return raizOrigem === raizNegativa && origem.cnpj !== contaNegativa.cnpj;
        });
        
        contasMesmaRaiz.forEach(origem => {
          if (valorRestante <= 0 || origem.saldo <= 0) return;
          
          // Transferir até 100% do saldo disponível
          const valorTransferencia = Math.min(valorRestante, origem.saldo);
          
          // Só criar sugestão se for significativo (>= R$ 100)
          if (valorTransferencia >= 100) {
            novasSugestoes.push({
              de: origem.fantasia,
              deBanco: origem.banco,
              para: contaNegativa.fantasia,
              paraBanco: contaNegativa.banco,
              valor: valorTransferencia,
              tipo: 'Entre Unidades (mesma raiz CNPJ)',
              prioridade: 2
            });
            valorRestante -= valorTransferencia;
            origem.saldo = 0; // Zerar saldo pois usou tudo
          }
        });
      }
    });
    
    return novasSugestoes.sort((a, b) => a.prioridade - b.prioridade);
  };
  
  // Calcular aportes necessários APENAS com base nas transferências CONFIRMADAS
  const calcularAportesNecessarios = (contas, transferenciasConfirmadas) => {
    // Calcular saldos após transferências confirmadas
    const saldosPorConta = {};
    contas.forEach(c => {
      const key = `${c.summary.fantasia}_${c.summary.banco}`;
      saldosPorConta[key] = c.saldoFinal;
    });
    
    // Aplicar APENAS transferências confirmadas
    transferenciasConfirmadas.forEach(t => {
      if (t.prioridade !== 3) { // Ignorar aportes
        const keyOrigem = `${t.de}_${t.deBanco}`;
        const keyDestino = `${t.para}_${t.paraBanco}`;
        if (saldosPorConta[keyOrigem] !== undefined) {
          saldosPorConta[keyOrigem] -= t.valor;
        }
        if (saldosPorConta[keyDestino] !== undefined) {
          saldosPorConta[keyDestino] += t.valor;
        }
      }
    });
    
    // Gerar aportes para contas ainda negativas
    const aportes = [];
    Object.entries(saldosPorConta).forEach(([key, saldo]) => {
      if (saldo < 0) {
        const [fantasia, banco] = key.split('_');
        const valorNecessario = Math.abs(saldo);
        if (valorNecessario > 100) {
          aportes.push({
            de: 'APORTE EXTERNO',
            deBanco: '',
            para: fantasia,
            paraBanco: banco,
            valor: valorNecessario,
            tipo: 'Aporte Necessário',
            prioridade: 3
          });
        }
      }
    });
    
    return aportes;
  };

  const handleFiles = useCallback(async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    setLoading(true);
    try {
      const fileContents = await Promise.all(files.map(readOFXFile));
      const data = parseMultipleOFX(fileContents, accountsMap);
      
      // Calcular projeções cruzando com despesas do dashboard
      const resultadosComProjecao = data.results.map(conta => {
        // Capitalizar nome da filial
        const fantasiaCapitalizada = capitalizarNome(conta.summary.fantasia);
        
        const despesasPorData = calcularDespesasPorConta(conta.summary.fantasia, conta.summary.banco);

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
          summary: {
            ...conta.summary,
            fantasia: fantasiaCapitalizada
          },
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
      alert(`Erro ao processar OFX: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [dados, datasVisiveis]);

  const limparDados = () => {
    setResults(null);
    setDetalheAberto(null);
  };

  const fmt = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Gerar sugestões mantendo as confirmadas fixas
  // Calcular sugestões (sem useMemo para garantir atualização)
  const sugestoesTransferencia = (() => {
    if (!results) return [];
    
    // Recalcular não confirmadas com base nas confirmadas
    const novasNaoConfirmadas = calcularSugestoesDinamicas(
      results.results, 
      transferenciasConfirmadas
    );
    
    // Calcular aportes necessários baseado APENAS nas confirmadas
    const aportes = calcularAportesNecessarios(
      results.results,
      transferenciasConfirmadas
    );
    
    // Se não há confirmadas, retornar novas + aportes
    if (transferenciasConfirmadas.length === 0) {
      return [...novasNaoConfirmadas, ...aportes];
    }
    
    // Combinar: confirmadas nas posições originais + novas no final + aportes
    const mapa = new Map();
    
    // Adicionar confirmadas
    transferenciasConfirmadas.forEach(t => {
      mapa.set(t.indice, { ...t, confirmada: true });
    });
    
    // Adicionar novas (em índices que não tem confirmadas)
    let proximoIndice = 0;
    novasNaoConfirmadas.forEach(sug => {
      // Encontrar próximo índice livre
      while (mapa.has(proximoIndice)) {
        proximoIndice++;
      }
      mapa.set(proximoIndice, { ...sug, confirmada: false });
      proximoIndice++;
    });
    
    // Adicionar aportes no final
    aportes.forEach(aporte => {
      while (mapa.has(proximoIndice)) {
        proximoIndice++;
      }
      mapa.set(proximoIndice, { ...aporte, confirmada: false });
      proximoIndice++;
    });
    
    // Converter para array ordenado por índice
    return Array.from(mapa.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([_, sug]) => sug);
  })();
  
  const resultadosComAjustes = results ? calcularSaldosComTransferencias(results.results, sugestoesTransferencia) : [];
  
  const resultadosOrdenados = resultadosComAjustes.length > 0 ? [...resultadosComAjustes].sort((a, b) => {
    const dir = ordenacao.direcao === 'asc' ? 1 : -1;
    switch (ordenacao.campo) {
      case 'fantasia':
        return dir * a.summary.fantasia.localeCompare(b.summary.fantasia);
      case 'banco':
        return dir * (a.summary.banco || '').localeCompare(b.summary.banco || '');
      case 'saldoInicial':
        return dir * ((a.saldo || 0) - (b.saldo || 0));
      case 'despesas':
        return dir * ((a.despesasTotais || 0) - (b.despesasTotais || 0));
      case 'saldoFinal':
        return dir * ((a.saldoFinal || 0) - (b.saldoFinal || 0));
      default:
        return 0;
    }
  }) : [];



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
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div
          className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
          onClick={() => setExpandida(!expandida)}
        >
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <svg className="h-5 w-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            Projeção de Saldos Bancários
            {results && (
              <span className="text-sm font-normal text-gray-500 ml-2">
                — {results.consolidado.identificados} conta(s) carregada(s)
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
              <span className="text-xs text-gray-500">Selecione arquivos .ofx dos extratos bancários</span>
              {results && (
                <button
                  onClick={limparDados}
                  className="ml-auto px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors"
                >
                  Limpar
                </button>
              )}
            </div>

            {/* Botão Importar CSV - Sempre visível */}
            <div className="flex justify-end gap-2 mb-4">
              <label className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 cursor-pointer">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Importar CSV Saldos
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCSVUpload}
                  className="hidden"
                />
              </label>
            </div>

            {loading && (
              <div className="text-center py-8 text-gray-500">
                <svg className="animate-spin h-8 w-8 mx-auto text-indigo-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className="mt-3 text-sm">Processando arquivos OFX...</p>
              </div>
            )}

            {results && results.results.length > 0 && (
              <>
                {/* Botões de Ação */}
                <div className="flex justify-end gap-3 mb-4">
                  <button
                    onClick={() => setModalAdicionarConta(true)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Adicionar Conta Manual
                  </button>
                </div>
                
                {/* Cards de Resumo */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-4 text-white">
                    <p className="text-xs opacity-90">Contas</p>
                    <p className="text-2xl font-bold">{results.consolidado.identificados}</p>
                  </div>
                  <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg p-4 text-white">
                    <p className="text-xs opacity-90">Saldo Inicial Total</p>
                    <p className="text-2xl font-bold">R$ {fmt(results.consolidado.saldoTotal)}</p>
                  </div>
                  <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-4 text-white">
                    <p className="text-xs opacity-90">Despesas Previstas</p>
                    <p className="text-2xl font-bold">
                      R$ {fmt(resultadosOrdenados.reduce((s, r) => s + (r.despesasTotais || 0), 0))}
                    </p>
                  </div>
                  <div className={`rounded-lg p-4 text-white ${resultadosOrdenados.some(r => r.ficaNegativo) ? 'bg-gradient-to-br from-red-500 to-red-600' : 'bg-gradient-to-br from-emerald-500 to-emerald-600'}`}>
                    <p className="text-xs opacity-90">Saldo Final Total</p>
                    <p className="text-2xl font-bold">
                      R$ {fmt(resultadosOrdenados.reduce((s, r) => s + (r.saldoFinal || 0), 0))}
                    </p>
                  </div>
                </div>

                {/* Alerta contas negativas */}
                {resultadosOrdenados.some(r => r.ficaNegativo) && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 font-semibold text-red-800 mb-2">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-1.964-1.333-2.732 0L4.082 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      ⚠️ Atenção: {resultadosOrdenados.filter(r => r.ficaNegativo).length} conta(s) ficarão negativas!
                    </div>
                    <div className="text-sm text-red-700">
                      {resultadosOrdenados.filter(r => r.ficaNegativo).map((r, i) => (
                        <div key={i} className="mb-1">
                          • <strong>{r.summary.fantasia}</strong> ({r.summary.banco}): 
                          Saldo final <span className="font-bold">R$ {fmt(r.saldoFinal)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sugestões de Transferências */}
                {sugestoesTransferencia.length > 0 && mostrarSugestoes && (
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 font-semibold text-blue-800">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                        </svg>
                        💡 Sugestões de Transferências
                      </div>
                      <button
                        onClick={() => setMostrarSugestoes(false)}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Ocultar
                      </button>
                    </div>
                    <div className="space-y-2">
                      {sugestoesTransferencia.map((s, i) => (
                        <div 
                          key={i} 
                          className={`p-3 rounded-lg ${
                            s.prioridade === 1 ? 'bg-emerald-50 border border-emerald-200' :
                            s.prioridade === 2 ? 'bg-amber-50 border border-amber-200' :
                            'bg-red-50 border border-red-200'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            {/* Checkbox para confirmar transferência */}
                            {s.prioridade !== 3 && (
                              <label className="flex items-center cursor-pointer flex-shrink-0">
                                <input
                                  type="checkbox"
                                  checked={transferenciasConfirmadas.some(t => t.indice === i)}
                                  onChange={() => toggleTransferencia(s, i)}
                                  className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                />
                              </label>
                            )}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 text-sm flex-wrap">
                                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                  s.prioridade === 1 ? 'bg-emerald-200 text-emerald-800' :
                                  s.prioridade === 2 ? 'bg-amber-200 text-amber-800' :
                                  'bg-red-200 text-red-800'
                                }`}>
                                  {s.tipo}
                                </span>
                                {s.prioridade !== 3 && (
                                  <>
                                    <span className="font-semibold">{s.de}</span>
                                    <span className="text-gray-500">({s.deBanco})</span>
                                    <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                    </svg>
                                  </>
                                )}
                                <span className="font-semibold">{s.para}</span>
                                <span className="text-gray-500">({s.paraBanco})</span>
                                {transferenciasConfirmadas.some(t => t.indice === i) && (
                                  <span className="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded font-semibold">
                                    ✓ Confirmada
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="text-lg font-bold text-blue-700">
                                R$ {fmt(s.valor)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tabela Principal */}
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-gray-200 text-sm">
                    <thead className="bg-indigo-600 text-white sticky top-0">
                      <tr>
                        <th 
                          className="border border-indigo-500 px-3 py-2 text-left cursor-pointer hover:bg-indigo-700"
                          onClick={() => toggleOrdenacao('fantasia')}
                        >
                          Filial <SortIcon campo="fantasia" />
                        </th>
                        <th 
                          className="border border-indigo-500 px-3 py-2 text-left cursor-pointer hover:bg-indigo-700"
                          onClick={() => toggleOrdenacao('banco')}
                        >
                          Banco <SortIcon campo="banco" />
                        </th>
                        <th className="border border-indigo-500 px-3 py-2 text-left">Conta</th>
                        <th 
                          className="border border-indigo-500 px-3 py-2 text-right cursor-pointer hover:bg-indigo-700"
                          onClick={() => toggleOrdenacao('saldoInicial')}
                        >
                          Saldo Inicial <SortIcon campo="saldoInicial" />
                        </th>
                        <th 
                          className="border border-indigo-500 px-3 py-2 text-right cursor-pointer hover:bg-indigo-700"
                          onClick={() => toggleOrdenacao('despesas')}
                        >
                          Despesas Previstas <SortIcon campo="despesas" />
                        </th>
                        <th 
                          className="border border-indigo-500 px-3 py-2 text-right cursor-pointer hover:bg-indigo-700"
                          onClick={() => toggleOrdenacao('saldoFinal')}
                        >
                          Saldo Final <SortIcon campo="saldoFinal" />
                        </th>
                        <th className="border border-indigo-500 px-3 py-2 text-right">Saldo Ajustado</th>
                        <th className="border border-indigo-500 px-3 py-2 text-center">Status</th>
                        <th className="border border-indigo-500 px-3 py-2 text-center no-print">Projeção</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultadosOrdenados.map((r, i) => (
                        <React.Fragment key={i}>
                        <tr className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="border border-gray-200 px-3 py-2 font-semibold">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: getCorBanco(r.summary.banco) }}
                              />
                              {r.summary.fantasia}
                            </div>
                          </td>
                          <td className="border border-gray-200 px-3 py-2">{r.summary.banco}</td>
                          <td className="border border-gray-200 px-3 py-2 font-mono text-xs">{r.summary.conta}</td>
                          <td className="border border-gray-200 px-3 py-2 text-right font-semibold text-blue-600">
                            {formatBRL(r.saldo)}
                          </td>
                          <td className="border border-gray-200 px-3 py-2 text-right text-orange-600">
                            {formatBRL(r.despesasPrevistas || 0)}
                          </td>
                          <td className={`border border-gray-200 px-3 py-2 text-right font-bold ${r.ficaNegativo ? 'text-red-600' : 'text-emerald-600'}`}>
                            {formatBRL(r.saldoFinal)}
                          </td>
                          <td className="border border-gray-200 px-3 py-2 text-right">
                            {r.temAjuste ? (
                              <div className="flex items-center justify-end gap-1">
                                <span className={`font-bold ${r.saldoFinalAjustado < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                  {formatBRL(r.saldoFinalAjustado)}
                                </span>
                                <span className={`text-xs ${r.ajuste > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                  ({r.ajuste > 0 ? '+' : ''}{formatBRL(r.ajuste)})
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="border border-gray-200 px-3 py-2 text-center">
                            {r.ficaNegativo ? (
                              <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded font-semibold">
                                NEGATIVO
                              </span>
                            ) : (
                              <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs rounded font-semibold">
                                OK
                              </span>
                            )}
                          </td>
                          <td className="border border-gray-200 px-3 py-2 text-center no-print">
                            {r.projecaoDiaria && r.projecaoDiaria.length > 0 && (
                              <button
                                onClick={() => setDetalheAberto(detalheAberto === i ? null : i)}
                                className="px-2 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-xs rounded font-medium"
                              >
                                {detalheAberto === i ? 'Ocultar' : 'Ver'}
                              </button>
                            )}
                          </td>
                        </tr>
                        {detalheAberto === i && r.projecaoDiaria && (
                          <tr>
                            <td colSpan={9} className="border border-gray-200 p-0">
                              <div className="p-4 bg-gray-50">
                                <h4 className="font-semibold text-sm mb-2 text-gray-700">
                                  📅 Projeção Diária - {r.summary.fantasia} ({r.summary.banco})
                                </h4>
                                <div className="overflow-x-auto">
                                  <table className="min-w-full text-xs">
                                    <thead className="bg-gray-200">
                                      <tr>
                                        <th className="border border-gray-300 px-2 py-1 text-left">Data</th>
                                        <th className="border border-gray-300 px-2 py-1 text-right">Despesas do Dia</th>
                                        <th className="border border-gray-300 px-2 py-1 text-right">Saldo após Lançamentos</th>
                                        <th className="border border-gray-300 px-2 py-1 text-center">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {r.projecaoDiaria.map((dia, di) => (
                                        <tr key={di} className={di % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                          <td className="border border-gray-200 px-2 py-1 font-medium">{dia.data}</td>
                                          <td className="border border-gray-200 px-2 py-1 text-right text-orange-600">
                                            {dia.despesas > 0 ? `R$ ${fmt(dia.despesas)}` : '—'}
                                          </td>
                                          <td className={`border border-gray-200 px-2 py-1 text-right font-bold ${
                                            dia.saldoAposLancamentos < 0 ? 'text-red-600' : 'text-emerald-600'
                                          }`}>
                                            R$ {fmt(dia.saldoAposLancamentos)}
                                          </td>
                                          <td className="border border-gray-200 px-2 py-1 text-center text-lg">
                                            {dia.saldoAposLancamentos < 0 ? '🔴' : '🟢'}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
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
                <p className="mt-3 text-sm">Faça upload de arquivos OFX para projetar os saldos</p>
                <p className="text-xs mt-1 text-gray-400">Os saldos serão cruzados com as despesas previstas do dashboard</p>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Modal API Santander */}
      {modalSantanderAPI && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4 text-red-600">🏦 API Santander (OAuth 2.0)</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Selecione a Filial
                </label>
                <select
                  value={santanderConfig.filial}
                  onChange={(e) => setSantanderConfig(prev => ({ ...prev, filial: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                >
                  <option value="">-- Escolha uma filial --</option>
                  <option value="Vale Dos Sinos">Vale Dos Sinos</option>
                  <option value="Araraquara">Araraquara</option>
                  <option value="Barretos">Barretos</option>
                  <option value="Barretos Express">Barretos Express</option>
                  <option value="Drops Rio Preto">Drops Rio Preto</option>
                  <option value="Campinas">Campinas</option>
                  <option value="Ribeirao Preto">Ribeirao Preto</option>
                  <option value="Goiania">Goiânia</option>
                  <option value="Caxias Do Sul">Caxias do Sul</option>
                  <option value="Brasilia">Brasília</option>
                  <option value="Xangai">Xangai</option>
                  <option value="Tubarao">Tubarão</option>
                  <option value="Palhoca">Palhoça</option>
                  <option value="Porto Alegre">Porto Alegre</option>
                  <option value="Novo Hamburgo">Novo Hamburgo</option>
                  <option value="Rv Bangalo">RV Bangalo</option>
                  <option value="Poa Zona Norte">POA Zona Norte</option>
                  <option value="Camelot">Camelot</option>
                  <option value="Bangalo">Bangalo</option>
                  <option value="Villages">Villages</option>
                  <option value="Zeax">Zeax</option>
                  <option value="Poa Zona Sul">POA Zona Sul</option>
                  <option value="Zaya">Zaya</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número da Conta (opcional)
                </label>
                <input
                  type="text"
                  value={santanderConfig.accountNumber}
                  onChange={(e) => setSantanderConfig(prev => ({ ...prev, accountNumber: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  placeholder="Ex: 0953130019502"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Deixe em branco para buscar todas as contas configuradas da filial
                </p>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800">
                  🔐 <strong>Credenciais Seguras:</strong>
                  <br/>1. Obtém Access Token usando Client ID/Secret
                  <br/>2. Usa o token para buscar saldo da conta
                  <br/>3. Integra automaticamente com o dashboard
                </p>
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs text-yellow-800">
                  ⚠️ <strong>Teste:</strong> Esta é uma implementação frontend para testes. 
                  Para produção, recomendamos criar um backend proxy.
                </p>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setModalSantanderAPI(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={loadingSantander}
              >
                Cancelar
              </button>
              <button
                onClick={buscarSaldosSantander}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400"
                disabled={loadingSantander}
              >
                {loadingSantander ? 'Buscando...' : 'Buscar Saldos'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal Adicionar Conta Manual */}
      {modalAdicionarConta && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">Adicionar Conta Manual</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Filial
                </label>
                <input
                  type="text"
                  value={novaContaForm.filial}
                  onChange={(e) => setNovaContaForm(prev => ({ ...prev, filial: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ex: Zeax"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Banco
                </label>
                <input
                  type="text"
                  value={novaContaForm.banco}
                  onChange={(e) => setNovaContaForm(prev => ({ ...prev, banco: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ex: Banco do Brasil"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Saldo Inicial (opcional)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={novaContaForm.saldoInicial}
                  onChange={(e) => setNovaContaForm(prev => ({ ...prev, saldoInicial: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="0.00"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setModalAdicionarConta(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={adicionarContaManual}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
