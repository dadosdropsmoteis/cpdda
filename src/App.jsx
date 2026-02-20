import React, { useState } from 'react';
import { ComposedChart, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line } from 'recharts';
import * as XLSX from 'xlsx';

export default function App() {
  const [dados, setDados] = useState([]);
  const [filialSelecionada, setFilialSelecionada] = useState('todas');
  const [filiaisSelecionadas, setFiliaisSelecionadas] = useState([]);
  const [datasSelecionadas, setDatasSelecionadas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tabelaTransposta, setTabelaTransposta] = useState(false);
  const [tipoArquivo, setTipoArquivo] = useState('csv'); // 'excel' ou 'csv'
  const [tipoGrafico, setTipoGrafico] = useState('data'); // 'data' ou 'filial'
  const [tabela2Transposta, setTabela2Transposta] = useState(false);
  const [tabela3Transposta, setTabela3Transposta] = useState(false);
  const [tabela4Transposta, setTabela4Transposta] = useState(false);
  const [tabela5Transposta, setTabela5Transposta] = useState(false);
  const [tabela1Expandida, setTabela1Expandida] = useState(true);
  const [tabela2Expandida, setTabela2Expandida] = useState(true);
  const [tabela3Expandida, setTabela3Expandida] = useState(true);
  const [tabela4Expandida, setTabela4Expandida] = useState(true);
  const [tabela5Expandida, setTabela5Expandida] = useState(true);
  const [filtroFilialAberto, setFiltroFilialAberto] = useState(false);
  const [filtroDataAberto, setFiltroDataAberto] = useState(false);

  // Ordem customizada das filiais
  const ordemFiliais = {
    'Goiania': 1,
    'Villages': 2,
    'Brasilia': 3,
    'Campinas': 4,
    'Vale dos Sinos': 5,
    'Porto Alegre': 6,
    'POA Zona Norte': 7,
    'Barretos': 8,
    'Barretos Express': 9,
    'Rio Preto': 10,
    'Poa Zona Sul': 11,
    'Palhoca': 12,
    'Tubarao': 13,
    'Araraquara': 14,
    'Bangalo': 15,
    'Zeax': 16,
    'RV Bangalo': 17,
    'Camelot': 18,
    'Xangai': 19,
    'Novo Hamburgo': 20,
    'Ribeirao Preto': 21,
    'Caxias do Sul': 22,
    'Zaya': 23
  };

  const processarArquivo = (e) => {
    const arquivo = e.target.files[0];
    if (!arquivo) return;

    setLoading(true);
    const reader = new FileReader();

    reader.onload = (evento) => {
      try {
        if (tipoArquivo === 'csv') {
          // Processar CSV
          const texto = evento.target.result;
          const linhas = texto.split('\n').filter(l => l.trim());
          
          if (linhas.length < 2) {
            alert('Arquivo CSV vazio ou inválido.');
            setLoading(false);
            return;
          }

          // Pular linha 1 (cabeçalho) e processar dados
          const dadosProcessados = linhas.slice(1).map((linha, idx) => {
            // Dividir por ponto-e-vírgula de forma mais simples
            const colunas = [];
            let colunaAtual = '';
            let dentroAspas = false;
            
            for (let i = 0; i < linha.length; i++) {
              const char = linha[i];
              
              if (char === '"') {
                dentroAspas = !dentroAspas;
              } else if (char === ';' && !dentroAspas) {
                colunas.push(colunaAtual);
                colunaAtual = '';
              } else {
                colunaAtual += char;
              }
            }
            colunas.push(colunaAtual); // última coluna
            
            const limpar = (str) => str ? str.replace(/^"|"$/g, '').trim() : '';
            
            // Converter data de YYYY-MM-DD para DD/MM/YYYY
            const dataRaw = limpar(colunas[17]);
            let dataFormatada = dataRaw;
            if (dataRaw && dataRaw.includes('-')) {
              const partes = dataRaw.split('-');
              if (partes.length === 3) {
                dataFormatada = `${partes[2]}/${partes[1]}/${partes[0]}`;
              }
            }
            
            // Converter valor: remover últimos 4 dígitos, depois inserir ponto antes dos últimos 2
            const valorRaw = limpar(colunas[29]);
            let valorConvertido = '';
            if (valorRaw && valorRaw !== '') {
              // Remover tudo exceto dígitos e o sinal negativo
              let valorLimpo = valorRaw.replace(/[^\d-]/g, '');
              
              // Verificar se é negativo
              const isNegativo = valorLimpo.startsWith('-');
              if (isNegativo) valorLimpo = valorLimpo.substring(1);
              
              // Remover os 4 últimos dígitos
              if (valorLimpo.length >= 4) {
                valorLimpo = valorLimpo.slice(0, -4);
              }
              
              // Inserir ponto decimal antes dos últimos 2 dígitos (centavos)
              if (valorLimpo.length > 2) {
                valorLimpo = valorLimpo.slice(0, -2) + '.' + valorLimpo.slice(-2);
              } else if (valorLimpo.length === 2) {
                valorLimpo = '0.' + valorLimpo;
              } else if (valorLimpo.length === 1) {
                valorLimpo = '0.0' + valorLimpo;
              }
              
              const valorNum = parseFloat(valorLimpo);
              
              if (!isNaN(valorNum)) {
                const valorFinal = Math.abs(valorNum);
                valorConvertido = valorFinal.toFixed(2).replace('.', ',');
              }
            }
            
            return {
              'Filial': limpar(colunas[3]),
              'Categoria': limpar(colunas[6]),
              'Vencimento': dataFormatada,
              'Valor': valorConvertido,
              'Conta Corrente': limpar(colunas[54]),
              'Forma de Pagamento': limpar(colunas[81]),
              'Documento': limpar(colunas[75])  // Tipo do Documento
            };
          }).filter(item => item.Filial && item.Vencimento && item.Valor && item.Valor !== '0,00');

          if (dadosProcessados.length === 0) {
            alert('Nenhum dado válido encontrado no CSV.');
            setLoading(false);
            return;
          }

          setDados(dadosProcessados);
          setDatasSelecionadas([]);
          setLoading(false);
          
        } else {
          // Processar Excel (mesmos campos do CSV)
          const workbook = XLSX.read(evento.target.result, { type: 'binary' });
          const primeiraAba = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[primeiraAba];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          if (jsonData.length < 2) {
            alert('Arquivo Excel vazio ou inválido.');
            setLoading(false);
            return;
          }

          // Processar linhas (pular cabeçalho)
          const dadosProcessados = jsonData.slice(1).map(colunas => {
            if (!colunas || colunas.length < 82) return null;

            const limpar = (valor) => {
              if (valor === null || valor === undefined) return '';
              return String(valor).replace(/^["']|["']$/g, '').trim();
            };

            // Processar data (coluna 18)
            const dataRaw = colunas[17]; // índice 17 = coluna 18
            let dataFormatada = '';
            if (dataRaw) {
              if (typeof dataRaw === 'number') {
                // Data em formato Excel serial
                const d = XLSX.SSF.parse_date_code(dataRaw);
                dataFormatada = `${String(d.d).padStart(2, '0')}/${String(d.m).padStart(2, '0')}/${d.y}`;
              } else {
                dataFormatada = String(dataRaw);
              }
            }

            // Processar valor (coluna 30) - apenas remover sinal negativo
            const valorRaw = colunas[29]; // índice 29 = coluna 30
            let valorConvertido = '';
            if (valorRaw !== null && valorRaw !== undefined && valorRaw !== '') {
              let valorStr = String(valorRaw);
              // Remover sinal negativo
              valorStr = valorStr.replace('-', '');
              // Se já está em formato brasileiro (com vírgula), manter
              if (valorStr.includes(',')) {
                valorConvertido = valorStr;
              } else {
                // Se é número, converter para formato brasileiro
                const valorNum = parseFloat(valorStr);
                if (!isNaN(valorNum)) {
                  valorConvertido = valorNum.toFixed(2).replace('.', ',');
                }
              }
            }

            return {
              'Filial': limpar(colunas[3]),
              'Categoria': limpar(colunas[6]),
              'Vencimento': dataFormatada,
              'Valor': valorConvertido,
              'Conta Corrente': limpar(colunas[54]),
              'Forma de Pagamento': limpar(colunas[81]),
              'Documento': limpar(colunas[75])  // Tipo do Documento
            };
          }).filter(item => item && item.Filial && item.Vencimento && item.Valor && item.Valor !== '0,00');

          if (dadosProcessados.length === 0) {
            alert('Nenhum dado válido encontrado no Excel.');
            setLoading(false);
            return;
          }

          setDados(dadosProcessados);
          setDatasSelecionadas([]);
          setLoading(false);
        }
      } catch (erro) {
        console.error('Erro ao processar arquivo:', erro);
        alert('Erro ao processar o arquivo. Verifique o formato.');
        setLoading(false);
      }
    };

    if (tipoArquivo === 'csv') {
      reader.readAsText(arquivo, 'UTF-8');
    } else {
      reader.readAsBinaryString(arquivo);
    }
  };

  const obterFiliais = () => {
    const filiais = [...new Set(dados.map(item => buscarCampo(item, 'Filial', 'filial', 'FILIAL')))].filter(Boolean);
    return filiais.sort((a, b) => {
      const ordemA = ordemFiliais[a] || 999;
      const ordemB = ordemFiliais[b] || 999;
      return ordemA - ordemB;
    });
  };

  // Busca campo de forma case-insensitive e ignorando espaços extras nos nomes
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

  // Converte valor para número aceitando formatos BR (1.234,56) e EN (1,234.56)
  const parsearValor = (valorRaw) => {
    if (valorRaw === undefined || valorRaw === null) return 0;
    if (typeof valorRaw === 'number') return valorRaw;
    const str = String(valorRaw).trim();
    const temVirgula = str.includes(',');
    const temPonto = str.includes('.');
    let normalizado;
    if (temVirgula && temPonto) {
      normalizado = str.lastIndexOf(',') > str.lastIndexOf('.')
        ? str.replace(/\./g, '').replace(',', '.')   // BR: 1.234,56
        : str.replace(/,/g, '');                      // EN: 1,234.56
    } else if (temVirgula) {
      normalizado = str.replace(',', '.');             // 1234,56
    } else {
      normalizado = str;                               // 1234.56 ou 1234
    }
    return parseFloat(normalizado.replace(/[^\d.-]/g, '')) || 0;
  };

  const agruparPorDiaEFilial = () => {
    const grupos = {};

    dados.forEach(item => {
      const filial = buscarCampo(item, 'Filial', 'filial', 'FILIAL') || 'Sem Filial';
      const dataVencimento = buscarCampo(item, 'Vencimento', 'vencimento', 'VENCIMENTO', 'Data', 'data', 'DATA', 'data_vencimento', 'DATA_VENCIMENTO', 'DataVencimento');
      const valorRaw = buscarCampo(item, 'Valor', 'valor', 'VALOR');
      const valor = parsearValor(valorRaw);

      if (!dataVencimento) return;

      let dataFormatada;
      if (typeof dataVencimento === 'number') {
        const d = XLSX.SSF.parse_date_code(dataVencimento);
        dataFormatada = `${String(d.d).padStart(2, '0')}/${String(d.m).padStart(2, '0')}/${d.y}`;
      } else {
        dataFormatada = String(dataVencimento);
      }

      const chave = `${filial}_${dataFormatada}`;
      if (!grupos[chave]) {
        grupos[chave] = { data: dataFormatada, filial, quantidade: 0, valorTotal: 0 };
      }
      grupos[chave].quantidade += 1;
      grupos[chave].valorTotal += valor;
    });

    return Object.values(grupos).sort((a, b) => {
      const ordemA = ordemFiliais[a.filial] || 999;
      const ordemB = ordemFiliais[b.filial] || 999;
      if (ordemA !== ordemB) return ordemA - ordemB;
      const [diaA, mesA, anoA] = a.data.split('/');
      const [diaB, mesB, anoB] = b.data.split('/');
      return new Date(anoA, mesA - 1, diaA) - new Date(anoB, mesB - 1, diaB);
    });
  };

  // Função específica para Remessa Bancária (Forma de Pagamento não vazia)
  const agruparRemessaBancaria = () => {
    const grupos = {};

    dados.forEach(item => {
      // Filtrar apenas itens com Forma de Pagamento preenchida
      const formaPagamento = buscarCampo(item, 'Forma de Pagamento', 'forma de pagamento', 'FORMA DE PAGAMENTO');
      if (!formaPagamento || formaPagamento.trim() === '' || formaPagamento === 'N/D') return;

      const filial = buscarCampo(item, 'Filial', 'filial', 'FILIAL') || 'Sem Filial';
      const dataVencimento = buscarCampo(item, 'Vencimento', 'vencimento', 'VENCIMENTO', 'Data', 'data', 'DATA', 'data_vencimento', 'DATA_VENCIMENTO', 'DataVencimento');
      const valorRaw = buscarCampo(item, 'Valor', 'valor', 'VALOR');
      const valor = parsearValor(valorRaw);

      if (!dataVencimento) return;

      let dataFormatada;
      if (typeof dataVencimento === 'number') {
        const d = XLSX.SSF.parse_date_code(dataVencimento);
        dataFormatada = `${String(d.d).padStart(2, '0')}/${String(d.m).padStart(2, '0')}/${d.y}`;
      } else {
        dataFormatada = String(dataVencimento);
      }

      const chave = `${filial}_${dataFormatada}`;
      if (!grupos[chave]) {
        grupos[chave] = { data: dataFormatada, filial, quantidade: 0, valorTotal: 0 };
      }
      grupos[chave].quantidade += 1;
      grupos[chave].valorTotal += valor;
    });

    return Object.values(grupos).sort((a, b) => {
      const ordemA = ordemFiliais[a.filial] || 999;
      const ordemB = ordemFiliais[b.filial] || 999;
      if (ordemA !== ordemB) return ordemA - ordemB;
      const [diaA, mesA, anoA] = a.data.split('/');
      const [diaB, mesB, anoB] = b.data.split('/');
      return new Date(anoA, mesA - 1, diaA) - new Date(anoB, mesB - 1, diaB);
    });
  };

  // Função para Despesas com Pessoal (Forma de Pagamento vazia + Categorias específicas)
  const agruparDespesasPessoal = () => {
    const grupos = {};
    const categoriasPermitidas = ['Adiantamento', 'Férias', 'Indenizações e Aviso Prévio', 'Rescisões', 'Salários', 'Seguros de Vida'];

    dados.forEach(item => {
      const formaPagamento = buscarCampo(item, 'Forma de Pagamento', 'forma de pagamento', 'FORMA DE PAGAMENTO');
      const categoria = buscarCampo(item, 'Categoria', 'categoria', 'CATEGORIA');
      
      if (formaPagamento && formaPagamento.trim() !== '' && formaPagamento !== 'N/D') return;
      if (!categoria || !categoriasPermitidas.includes(categoria.trim())) return;

      const filial = buscarCampo(item, 'Filial', 'filial', 'FILIAL') || 'Sem Filial';
      const dataVencimento = buscarCampo(item, 'Vencimento', 'vencimento', 'VENCIMENTO', 'Data', 'data', 'DATA');
      const valorRaw = buscarCampo(item, 'Valor', 'valor', 'VALOR');
      const valor = parsearValor(valorRaw);

      if (!dataVencimento) return;

      let dataFormatada = typeof dataVencimento === 'number'
        ? (() => { const d = XLSX.SSF.parse_date_code(dataVencimento); return `${String(d.d).padStart(2, '0')}/${String(d.m).padStart(2, '0')}/${d.y}`; })()
        : String(dataVencimento);

      const chave = `${filial}_${dataFormatada}`;
      if (!grupos[chave]) grupos[chave] = { data: dataFormatada, filial, quantidade: 0, valorTotal: 0 };
      grupos[chave].quantidade += 1;
      grupos[chave].valorTotal += valor;
    });

    return Object.values(grupos).sort((a, b) => {
      const ordemA = ordemFiliais[a.filial] || 999;
      const ordemB = ordemFiliais[b.filial] || 999;
      if (ordemA !== ordemB) return ordemA - ordemB;
      const [diaA, mesA, anoA] = a.data.split('/');
      const [diaB, mesB, anoB] = b.data.split('/');
      return new Date(anoA, mesA - 1, diaA) - new Date(anoB, mesB - 1, diaB);
    });
  };

  // Função para Despesas Financeiras/Impostos (Forma de Pagamento vazia + Categorias específicas)
  const agruparDespesasFinanceiras = () => {
    const grupos = {};
    const categoriasPermitidas = ['Energia Eletrica e Gas', 'ICMS', 'Impostos e Taxas Diversas', 'ISS', 'Pagamento de Empréstimos', 'Seguros'];

    dados.forEach(item => {
      const formaPagamento = buscarCampo(item, 'Forma de Pagamento', 'forma de pagamento', 'FORMA DE PAGAMENTO');
      const categoria = buscarCampo(item, 'Categoria', 'categoria', 'CATEGORIA');
      
      if (formaPagamento && formaPagamento.trim() !== '' && formaPagamento !== 'N/D') return;
      if (!categoria || !categoriasPermitidas.includes(categoria.trim())) return;

      const filial = buscarCampo(item, 'Filial', 'filial', 'FILIAL') || 'Sem Filial';
      const dataVencimento = buscarCampo(item, 'Vencimento', 'vencimento', 'VENCIMENTO', 'Data', 'data', 'DATA');
      const valorRaw = buscarCampo(item, 'Valor', 'valor', 'VALOR');
      const valor = parsearValor(valorRaw);

      if (!dataVencimento) return;

      let dataFormatada = typeof dataVencimento === 'number'
        ? (() => { const d = XLSX.SSF.parse_date_code(dataVencimento); return `${String(d.d).padStart(2, '0')}/${String(d.m).padStart(2, '0')}/${d.y}`; })()
        : String(dataVencimento);

      const chave = `${filial}_${dataFormatada}`;
      if (!grupos[chave]) grupos[chave] = { data: dataFormatada, filial, quantidade: 0, valorTotal: 0 };
      grupos[chave].quantidade += 1;
      grupos[chave].valorTotal += valor;
    });

    return Object.values(grupos).sort((a, b) => {
      const ordemA = ordemFiliais[a.filial] || 999;
      const ordemB = ordemFiliais[b.filial] || 999;
      if (ordemA !== ordemB) return ordemA - ordemB;
      const [diaA, mesA, anoA] = a.data.split('/');
      const [diaB, mesB, anoB] = b.data.split('/');
      return new Date(anoA, mesA - 1, diaA) - new Date(anoB, mesB - 1, diaB);
    });
  };

  // Função para Despesas com Cartão de Crédito (Conta Corrente contém "Master" ou "Visa")
  const agruparDespesasCartao = () => {
    const grupos = {};

    dados.forEach(item => {
      const contaCorrente = buscarCampo(item, 'Conta Corrente', 'conta corrente', 'CONTA CORRENTE') || '';
      
      if (!contaCorrente.toLowerCase().includes('master') && !contaCorrente.toLowerCase().includes('visa')) return;

      const filial = buscarCampo(item, 'Filial', 'filial', 'FILIAL') || 'Sem Filial';
      const dataVencimento = buscarCampo(item, 'Vencimento', 'vencimento', 'VENCIMENTO', 'Data', 'data', 'DATA');
      const valorRaw = buscarCampo(item, 'Valor', 'valor', 'VALOR');
      const valor = parsearValor(valorRaw);

      if (!dataVencimento) return;

      let dataFormatada = typeof dataVencimento === 'number'
        ? (() => { const d = XLSX.SSF.parse_date_code(dataVencimento); return `${String(d.d).padStart(2, '0')}/${String(d.m).padStart(2, '0')}/${d.y}`; })()
        : String(dataVencimento);

      const chave = `${filial}_${dataFormatada}`;
      if (!grupos[chave]) grupos[chave] = { data: dataFormatada, filial, quantidade: 0, valorTotal: 0 };
      grupos[chave].quantidade += 1;
      grupos[chave].valorTotal += valor;
    });

    return Object.values(grupos).sort((a, b) => {
      const ordemA = ordemFiliais[a.filial] || 999;
      const ordemB = ordemFiliais[b.filial] || 999;
      if (ordemA !== ordemB) return ordemA - ordemB;
      const [diaA, mesA, anoA] = a.data.split('/');
      const [diaB, mesB, anoB] = b.data.split('/');
      return new Date(anoA, mesA - 1, diaA) - new Date(anoB, mesB - 1, diaB);
    });
  };

  const dadosAgrupados = agruparPorDiaEFilial();
  const dadosRemessaBancaria = agruparRemessaBancaria();
  const dadosPessoal = agruparDespesasPessoal();
  const dadosFinanceiras = agruparDespesasFinanceiras();
  const dadosCartao = agruparDespesasCartao();

  const dadosFiltrados = filiaisSelecionadas.length > 0
    ? dadosAgrupados.filter(d => filiaisSelecionadas.includes(d.filial))
    : dadosAgrupados;

  const dadosRemessaFiltrados = filiaisSelecionadas.length > 0
    ? dadosRemessaBancaria.filter(d => filiaisSelecionadas.includes(d.filial))
    : dadosRemessaBancaria;

  const datasUnicas = [...new Set(dadosAgrupados.map(d => d.data))].sort((a, b) => {
    const [diaA, mesA, anoA] = a.split('/');
    const [diaB, mesB, anoB] = b.split('/');
    return new Date(anoA, mesA - 1, diaA) - new Date(anoB, mesB - 1, diaB);
  });

  const datasRemessaUnicas = [...new Set(dadosRemessaBancaria.map(d => d.data))].sort((a, b) => {
    const [diaA, mesA, anoA] = a.split('/');
    const [diaB, mesB, anoB] = b.split('/');
    return new Date(anoA, mesA - 1, diaA) - new Date(anoB, mesB - 1, diaB);
  });

  const datasCartaoUnicas = [...new Set(dadosCartao.map(d => d.data))].sort((a, b) => {
    const [diaA, mesA, anoA] = a.split('/');
    const [diaB, mesB, anoB] = b.split('/');
    return new Date(anoA, mesA - 1, diaA) - new Date(anoB, mesB - 1, diaB);
  });

  const datasVisiveis = datasSelecionadas.length > 0
    ? datasUnicas.filter(d => datasSelecionadas.includes(d))
    : datasUnicas;

  const datasRemessaVisiveis = datasSelecionadas.length > 0
    ? datasRemessaUnicas.filter(d => datasSelecionadas.includes(d))
    : datasRemessaUnicas;

  const datasCartaoVisiveis = datasSelecionadas.length > 0
    ? datasCartaoUnicas.filter(d => datasSelecionadas.includes(d))
    : datasCartaoUnicas;

  const toggleData = (data) => {
    setDatasSelecionadas(prev =>
      prev.includes(data) ? prev.filter(d => d !== data) : [...prev, data]
    );
  };

  const toggleFilial = (filial) => {
    setFiliaisSelecionadas(prev =>
      prev.includes(filial) ? prev.filter(f => f !== filial) : [...prev, filial]
    );
  };

  const filiaisVisiveis = filiaisSelecionadas.length > 0 ? filiaisSelecionadas : obterFiliais();

  const lookup = {};
  dadosAgrupados.forEach(item => {
    lookup[`${item.filial}_${item.data}`] = item;
  });

  const lookupRemessa = {};
  dadosRemessaBancaria.forEach(item => {
    lookupRemessa[`${item.filial}_${item.data}`] = item;
  });

  const lookupPessoal = {};
  dadosPessoal.forEach(item => {
    lookupPessoal[`${item.filial}_${item.data}`] = item;
  });

  const lookupFinanceiras = {};
  dadosFinanceiras.forEach(item => {
    lookupFinanceiras[`${item.filial}_${item.data}`] = item;
  });

  const lookupCartao = {};
  dadosCartao.forEach(item => {
    lookupCartao[`${item.filial}_${item.data}`] = item;
  });

  // Dados para gráfico empilhado (4 categorias + total)
  const dadosParaGrafico = datasVisiveis.map(data => {
    let remessa = 0, pessoal = 0, financeiras = 0, cartao = 0;
    let qtdRemessa = 0, qtdPessoal = 0, qtdFinanceiras = 0, qtdCartao = 0;
    
    filiaisVisiveis.forEach(filial => {
      const entryRemessa = lookupRemessa[`${filial}_${data}`];
      const entryPessoal = lookupPessoal[`${filial}_${data}`];
      const entryFinanceiras = lookupFinanceiras[`${filial}_${data}`];
      const entryCartao = lookupCartao[`${filial}_${data}`];
      
      if (entryRemessa) {
        remessa += entryRemessa.valorTotal;
        qtdRemessa += entryRemessa.quantidade;
      }
      if (entryPessoal) {
        pessoal += entryPessoal.valorTotal;
        qtdPessoal += entryPessoal.quantidade;
      }
      if (entryFinanceiras) {
        financeiras += entryFinanceiras.valorTotal;
        qtdFinanceiras += entryFinanceiras.quantidade;
      }
      if (entryCartao) {
        cartao += entryCartao.valorTotal;
        qtdCartao += entryCartao.quantidade;
      }
    });
    
    const totalValor = remessa + pessoal + financeiras + cartao;
    const totalQuantidade = qtdRemessa + qtdPessoal + qtdFinanceiras + qtdCartao;
    
    return { data, remessa, pessoal, financeiras, cartao, totalValor, totalQuantidade };
  });

  // Dados para gráfico por filial (sem data)
  const dadosParaGraficoPorFilial = filiaisVisiveis.map(filial => {
    let remessa = 0, pessoal = 0, financeiras = 0, cartao = 0;
    let qtdRemessa = 0, qtdPessoal = 0, qtdFinanceiras = 0, qtdCartao = 0;
    
    datasVisiveis.forEach(data => {
      const entryRemessa = lookupRemessa[`${filial}_${data}`];
      const entryPessoal = lookupPessoal[`${filial}_${data}`];
      const entryFinanceiras = lookupFinanceiras[`${filial}_${data}`];
      const entryCartao = lookupCartao[`${filial}_${data}`];
      
      if (entryRemessa) {
        remessa += entryRemessa.valorTotal;
        qtdRemessa += entryRemessa.quantidade;
      }
      if (entryPessoal) {
        pessoal += entryPessoal.valorTotal;
        qtdPessoal += entryPessoal.quantidade;
      }
      if (entryFinanceiras) {
        financeiras += entryFinanceiras.valorTotal;
        qtdFinanceiras += entryFinanceiras.quantidade;
      }
      if (entryCartao) {
        cartao += entryCartao.valorTotal;
        qtdCartao += entryCartao.quantidade;
      }
    });
    
    const totalValor = remessa + pessoal + financeiras + cartao;
    const totalQuantidade = qtdRemessa + qtdPessoal + qtdFinanceiras + qtdCartao;
    
    return { filial, remessa, pessoal, financeiras, cartao, totalValor, totalQuantidade };
  });

  const totais = dadosFiltrados.reduce((acc, item) => {
    if (datasVisiveis.includes(item.data)) {
      acc.quantidade += item.quantidade;
      acc.valor += item.valorTotal;
    }
    return acc;
  }, { quantidade: 0, valor: 0 });

  const totaisRemessa = dadosRemessaFiltrados.reduce((acc, item) => {
    if (datasRemessaVisiveis.includes(item.data)) {
      acc.quantidade += item.quantidade;
      acc.valor += item.valorTotal;
    }
    return acc;
  }, { quantidade: 0, valor: 0 });

  const exportarPDF = () => {
    // Pequeno delay para garantir que o browser processe os estilos antes de imprimir
    setTimeout(() => window.print(), 100);
  };

  const fmt = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <>
      <style>{`
        @media print {
          @page { 
            size: A4 landscape; 
            margin: 6mm; 
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print { display: none !important; }
          .print-area { 
            box-shadow: none !important; 
            border-radius: 0 !important; 
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          body { 
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          h1 {
            font-size: 14px !important;
            margin-bottom: 4px !important;
          }
          h2 {
            font-size: 10px !important;
            margin-top: 4px !important;
            margin-bottom: 3px !important;
          }
          /* Reduzir tamanho do gráfico no PDF */
          .grafico-print {
            height: 140px !important;
            margin-bottom: 3px !important;
            margin-top: 3px !important;
          }
          .recharts-wrapper {
            height: 140px !important;
          }
          .recharts-surface {
            height: 140px !important;
          }
          /* Esconder legenda do gráfico no PDF */
          .recharts-legend-wrapper {
            display: none !important;
          }
          .table-container {
            max-height: none !important;
            overflow: visible !important;
            page-break-inside: avoid;
            margin-bottom: 8px !important;
            max-width: 600px !important;
          }
          table { 
            font-size: 6px !important;
            width: auto !important;
            max-width: 600px !important;
            table-layout: auto !important;
            border-collapse: collapse !important;
            margin-bottom: 0 !important;
          }
          th, td { 
            padding: 0.5px 4px !important;
            font-size: 6px !important;
            line-height: 1 !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }
          th {
            background-color: #4f46e5 !important;
            color: white !important;
            padding: 1px 4px !important;
          }
          /* Ajustar larguras específicas para colunas */
          .min-w-32 {
            min-width: 50px !important;
            width: auto !important;
            max-width: 70px !important;
          }
          .min-w-40 {
            min-width: 60px !important;
            width: auto !important;
            max-width: 90px !important;
          }
          .sticky-col { 
            position: static !important; 
          }
          .sticky-col-header {
            position: static !important;
          }
          .sticky-header th,
          .sticky-header-second th {
            position: static !important;
          }
          h2 {
            font-size: 9px !important;
            margin: 4px 0 2px 0 !important;
            padding: 0 !important;
          }
          /* Reduzir espaçamento entre seções */
          .mt-8 {
            margin-top: 6px !important;
          }
          /* Reduzir espaçamento nos cards de resumo */
          .grid {
            gap: 4px !important;
            margin-bottom: 6px !important;
          }
        }
        .table-container {
          max-height: 500px;
          overflow: auto;
          position: relative;
        }
        .sticky-header th {
          position: sticky;
          top: 0;
          z-index: 3;
        }
        .sticky-header-second th {
          position: sticky;
          top: 41px;
          z-index: 3;
        }
        .sticky-col {
          position: sticky;
          left: 0;
          z-index: 2;
          background: inherit;
        }
        .sticky-col-header {
          position: sticky;
          left: 0;
          z-index: 4 !important;
        }
        .sticky-col-2 {
          position: sticky;
          left: 128px;
          z-index: 2;
          background: inherit;
        }
        .sticky-col-2-header {
          position: sticky;
          left: 128px;
          z-index: 4 !important;
        }
      `}</style>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
        <div className="max-w-full mx-auto">
          <div className="bg-white rounded-lg shadow-xl p-8 mb-6 print-area">

            {/* Cabeçalho */}
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-3xl font-bold text-gray-800">📊 Dashboard de Análise - Filiais</h1>
              {dados.length > 0 && (
                <button
                  onClick={exportarPDF}
                  className="no-print flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Exportar PDF
                </button>
              )}
            </div>

            {/* Upload */}
            <div className="mb-6 no-print">
              <div className="flex items-center gap-4 mb-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="tipoArquivo"
                    value="excel"
                    checked={tipoArquivo === 'excel'}
                    onChange={(e) => setTipoArquivo(e.target.value)}
                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Excel (.xlsx, .xls)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="tipoArquivo"
                    value="csv"
                    checked={tipoArquivo === 'csv'}
                    onChange={(e) => setTipoArquivo(e.target.value)}
                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-gray-700">CSV (.csv)</span>
                </label>
              </div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Carregar arquivo {tipoArquivo === 'excel' ? 'Excel' : 'CSV'}
              </label>
              <input
                type="file"
                accept={tipoArquivo === 'excel' ? '.xlsx,.xls' : '.csv'}
                onChange={processarArquivo}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
              />
              <p className="text-xs text-gray-500 mt-2">
                📋 {tipoArquivo === 'excel' ? 'Excel' : 'CSV'} deve ter as colunas: Nome Fantasia (Filial), Data de Previsão, Valor da Conta, Categoria, Forma de Pagamento, Conta Corrente
              </p>
            </div>

            {loading && (
              <div className="text-center py-4">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <p className="mt-2 text-gray-600">Processando arquivo...</p>
              </div>
            )}

            {dados.length > 0 && (
              <>
                {/* Filtros */}
                <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4 no-print">
                  {/* Filtro Filial */}
                  <div className="relative">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">Filtrar por filial</label>
                      {filiaisSelecionadas.length > 0 && (
                        <button onClick={() => setFiliaisSelecionadas([])} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                          Limpar ({filiaisSelecionadas.length})
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => setFiltroFilialAberto(!filtroFilialAberto)}
                      className="w-full flex items-center justify-between px-4 py-2 border border-gray-300 rounded-md bg-white text-sm text-left hover:bg-gray-50"
                    >
                      <span className="text-gray-700">
                        {filiaisSelecionadas.length === 0 
                          ? 'Todas as filiais' 
                          : `${filiaisSelecionadas.length} filial${filiaisSelecionadas.length > 1 ? 's' : ''} selecionada${filiaisSelecionadas.length > 1 ? 's' : ''}`
                        }
                      </span>
                      <svg className={`w-5 h-5 transition-transform ${filtroFilialAberto ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {filtroFilialAberto && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {obterFiliais().map(filial => (
                          <label key={filial} className="flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={filiaisSelecionadas.includes(filial)}
                              onChange={() => toggleFilial(filial)}
                              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                            />
                            <span className="ml-3 text-sm text-gray-700">{filial}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {filiaisSelecionadas.length === 0 ? 'Todas as filiais exibidas' : `${filiaisSelecionadas.length} de ${obterFiliais().length} filiais`}
                    </p>
                  </div>

                  {/* Filtro Data */}
                  <div className="relative">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">Filtrar por data</label>
                      {datasSelecionadas.length > 0 && (
                        <button onClick={() => setDatasSelecionadas([])} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                          Limpar ({datasSelecionadas.length})
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => setFiltroDataAberto(!filtroDataAberto)}
                      className="w-full flex items-center justify-between px-4 py-2 border border-gray-300 rounded-md bg-white text-sm text-left hover:bg-gray-50"
                    >
                      <span className="text-gray-700">
                        {datasSelecionadas.length === 0 
                          ? 'Todas as datas' 
                          : `${datasSelecionadas.length} data${datasSelecionadas.length > 1 ? 's' : ''} selecionada${datasSelecionadas.length > 1 ? 's' : ''}`
                        }
                      </span>
                      <svg className={`w-5 h-5 transition-transform ${filtroDataAberto ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {filtroDataAberto && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {datasUnicas.map(data => (
                          <label key={data} className="flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={datasSelecionadas.includes(data)}
                              onChange={() => toggleData(data)}
                              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                            />
                            <span className="ml-3 text-sm text-gray-700">{data}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {datasSelecionadas.length === 0 ? 'Todas as datas exibidas' : `${datasSelecionadas.length} de ${datasUnicas.length} datas`}
                    </p>
                  </div>
                </div>

                {/* Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 no-print">
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white">
                    <p className="text-sm opacity-90">Total de Registros</p>
                    <p className="text-3xl font-bold mt-2">{totais.quantidade}</p>
                  </div>
                  <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-6 text-white">
                    <p className="text-sm opacity-90">Valor Total</p>
                    <p className="text-3xl font-bold mt-2">R$ {fmt(totais.valor)}</p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-6 text-white">
                    <p className="text-sm opacity-90">Filiais</p>
                    <p className="text-3xl font-bold mt-2">{obterFiliais().length}</p>
                  </div>
                </div>

                {/* Gráfico Geral - Empilhado por Categoria */}
                <div className="mb-8 grafico-print">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-800">Visão Geral - Despesas por Tipo de Lançamento</h2>
                    <div className="flex gap-2 no-print">
                      <button
                        onClick={() => setTipoGrafico('data')}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                          tipoGrafico === 'data'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        Por Data
                      </button>
                      <button
                        onClick={() => setTipoGrafico('filial')}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                          tipoGrafico === 'filial'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        Por Filial
                      </button>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={320}>
                    <ComposedChart 
                      data={tipoGrafico === 'data' ? dadosParaGrafico : dadosParaGraficoPorFilial} 
                      margin={{ top: 10, right: 40, left: 10, bottom: 60 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey={tipoGrafico === 'data' ? 'data' : 'filial'} 
                        angle={-45} 
                        textAnchor="end" 
                        height={80} 
                      />
                      <YAxis
                        yAxisId="left"
                        orientation="left"
                        tickFormatter={(v) => `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`}
                        label={{ value: 'Valor (R$)', angle: -90, position: 'insideLeft', offset: 10 }}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        label={{ value: 'Quantidade Total', angle: 90, position: 'insideRight', offset: 10 }}
                      />
                      <Tooltip
                        formatter={(value, name) => 
                          name === 'Quantidade Total' 
                            ? [value, name]
                            : [`R$ ${fmt(value)}`, name]
                        }
                        labelStyle={{ fontWeight: 'bold' }}
                      />
                      <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 10 }} />
                      <Bar yAxisId="left" dataKey="remessa" stackId="a" fill="#3b82f6" name="Remessa Bancária" />
                      <Bar yAxisId="left" dataKey="pessoal" stackId="a" fill="#10b981" name="Despesas Pessoal" />
                      <Bar yAxisId="left" dataKey="financeiras" stackId="a" fill="#f59e0b" name="Financ./Impostos" />
                      <Bar yAxisId="left" dataKey="cartao" stackId="a" fill="#8b5cf6" name="Cartão Crédito" />
                      <Line yAxisId="right" type="monotone" dataKey="totalQuantidade" stroke="#ef4444" strokeWidth={3} name="Quantidade Total" dot={{ r: 5 }} activeDot={{ r: 7 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* Tabela 1: Remessa Bancária */}
                <div className={tabela1Expandida ? '' : 'no-print'}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-800">
                      <span className="text-indigo-600 mr-2">&gt;</span>
                      Remessa Bancária por Filial e Data
                    </h2>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setTabela1Expandida(!tabela1Expandida)}
                        className="no-print flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tabela1Expandida ? "M19 9l-7 7-7-7" : "M9 5l7 7-7 7"} />
                        </svg>
                        {tabela1Expandida ? 'Recolher' : 'Expandir'}
                      </button>
                      {tabela1Expandida && (
                        <button
                          onClick={() => setTabelaTransposta(!tabelaTransposta)}
                          className="no-print flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                          </svg>
                          {tabelaTransposta ? 'Visualização Normal' : 'Inverter Eixos'}
                        </button>
                      )}
                    </div>
                  </div>
                  {tabela1Expandida && (
                  <div className="table-container">{!tabelaTransposta ? (
                    // Tabela normal: Datas nas linhas, Filiais nas colunas
                    <table className="min-w-full border border-gray-200 text-sm">
                      <thead>
                        <tr className="sticky-header">
                          <th rowSpan={2} className="sticky-col-header border border-gray-300 bg-indigo-600 text-white px-4 py-3 text-left font-semibold min-w-32">
                            Data
                          </th>
                          {filiaisVisiveis.map(filial => (
                            <th key={filial} colSpan={2} className="border border-gray-300 bg-indigo-500 text-white px-4 py-2 text-center font-semibold whitespace-nowrap">
                              {filial}
                            </th>
                          ))}
                          <th colSpan={2} className="border border-gray-300 bg-indigo-800 text-white px-4 py-2 text-center font-semibold whitespace-nowrap">
                            Total Geral
                          </th>
                        </tr>
                        <tr className="sticky-header-second">
                          {filiaisVisiveis.map(filial => (
                            <React.Fragment key={filial}>
                              <th className="border border-gray-300 bg-indigo-100 text-indigo-800 px-3 py-2 text-center font-medium whitespace-nowrap">Qtd</th>
                              <th className="border border-gray-300 bg-indigo-100 text-indigo-800 px-3 py-2 text-center font-medium whitespace-nowrap">Valor Total</th>
                            </React.Fragment>
                          ))}
                          <th className="border border-gray-300 bg-indigo-100 text-indigo-800 px-3 py-2 text-center font-medium whitespace-nowrap">Qtd</th>
                          <th className="border border-gray-300 bg-indigo-100 text-indigo-800 px-3 py-2 text-center font-medium whitespace-nowrap">Valor Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {datasRemessaVisiveis.map((data, idx) => {
                          const totalQtd = filiaisVisiveis.reduce((s, f) => s + (lookupRemessa[`${f}_${data}`]?.quantidade || 0), 0);
                          const totalVal = filiaisVisiveis.reduce((s, f) => s + (lookupRemessa[`${f}_${data}`]?.valorTotal || 0), 0);
                          return (
                            <tr key={data} className={idx % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-gray-50 hover:bg-blue-50'}>
                              <td className="sticky-col border border-gray-200 px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{data}</td>
                              {filiaisVisiveis.map(filial => {
                                const entry = lookupRemessa[`${filial}_${data}`];
                                return (
                                  <React.Fragment key={filial}>
                                    <td className="border border-gray-200 px-3 py-3 text-center text-gray-700">
                                      {entry ? entry.quantidade : <span className="text-gray-300">—</span>}
                                    </td>
                                    <td className="border border-gray-200 px-3 py-3 text-center text-gray-700 whitespace-nowrap">
                                      {entry ? `R$ ${fmt(entry.valorTotal)}` : <span className="text-gray-300">—</span>}
                                    </td>
                                  </React.Fragment>
                                );
                              })}
                              <td className="border border-gray-200 px-3 py-3 text-center font-semibold text-indigo-800 bg-indigo-50">
                                {totalQtd || <span className="text-gray-300">—</span>}
                              </td>
                              <td className="border border-gray-200 px-3 py-3 text-center font-semibold text-indigo-800 bg-indigo-50 whitespace-nowrap">
                                {totalVal > 0 ? `R$ ${fmt(totalVal)}` : <span className="text-gray-300">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                        {/* Linha de totais */}
                        <tr className="bg-indigo-50 font-semibold border-t-2 border-indigo-300">
                          <td className="sticky-col border border-gray-300 px-4 py-3 text-indigo-800 bg-indigo-50">Total</td>
                          {filiaisVisiveis.map(filial => {
                            const qtd = datasRemessaVisiveis.reduce((s, d) => s + (lookupRemessa[`${filial}_${d}`]?.quantidade || 0), 0);
                            const val = datasRemessaVisiveis.reduce((s, d) => s + (lookupRemessa[`${filial}_${d}`]?.valorTotal || 0), 0);
                            return (
                              <React.Fragment key={filial}>
                                <td className="border border-gray-300 px-3 py-3 text-center text-indigo-800">{qtd || <span className="text-gray-300">—</span>}</td>
                                <td className="border border-gray-300 px-3 py-3 text-center text-indigo-800 whitespace-nowrap">
                                  {val > 0 ? `R$ ${fmt(val)}` : <span className="text-gray-300">—</span>}
                                </td>
                              </React.Fragment>
                            );
                          })}
                          <td className="border border-gray-300 px-3 py-3 text-center text-white bg-indigo-700 font-bold">
                            {filiaisVisiveis.reduce((s, f) => s + datasRemessaVisiveis.reduce((ss, d) => ss + (lookupRemessa[`${f}_${d}`]?.quantidade || 0), 0), 0)}
                          </td>
                          <td className="border border-gray-300 px-3 py-3 text-center text-white bg-indigo-700 font-bold whitespace-nowrap">
                            R$ {fmt(filiaisVisiveis.reduce((s, f) => s + datasRemessaVisiveis.reduce((ss, d) => ss + (lookupRemessa[`${f}_${d}`]?.valorTotal || 0), 0), 0))}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  ) : (
                    // Tabela transposta: Filiais nas linhas, Datas nas colunas
                    <table className="min-w-full border border-gray-200 text-sm">
                      <thead>
                        <tr className="sticky-header">
                          <th rowSpan={2} className="sticky-col-header border border-gray-300 bg-indigo-600 text-white px-4 py-3 text-left font-semibold min-w-32">
                            Filial
                          </th>
                          {datasRemessaVisiveis.map(data => (
                            <th key={data} colSpan={2} className="border border-gray-300 bg-indigo-500 text-white px-4 py-2 text-center font-semibold whitespace-nowrap">
                              {data}
                            </th>
                          ))}
                          <th colSpan={2} className="border border-gray-300 bg-indigo-800 text-white px-4 py-2 text-center font-semibold whitespace-nowrap">
                            Total Geral
                          </th>
                        </tr>
                        <tr className="sticky-header-second">
                          {datasRemessaVisiveis.map(data => (
                            <React.Fragment key={data}>
                              <th className="border border-gray-300 bg-indigo-100 text-indigo-800 px-3 py-2 text-center font-medium whitespace-nowrap">Qtd</th>
                              <th className="border border-gray-300 bg-indigo-100 text-indigo-800 px-3 py-2 text-center font-medium whitespace-nowrap">Valor Total</th>
                            </React.Fragment>
                          ))}
                          <th className="border border-gray-300 bg-indigo-100 text-indigo-800 px-3 py-2 text-center font-medium whitespace-nowrap">Qtd</th>
                          <th className="border border-gray-300 bg-indigo-100 text-indigo-800 px-3 py-2 text-center font-medium whitespace-nowrap">Valor Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filiaisVisiveis.map((filial, idx) => {
                          const totalQtd = datasRemessaVisiveis.reduce((s, d) => s + (lookupRemessa[`${filial}_${d}`]?.quantidade || 0), 0);
                          const totalVal = datasRemessaVisiveis.reduce((s, d) => s + (lookupRemessa[`${filial}_${d}`]?.valorTotal || 0), 0);
                          return (
                            <tr key={filial} className={idx % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-gray-50 hover:bg-blue-50'}>
                              <td className="sticky-col border border-gray-200 px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{filial}</td>
                              {datasRemessaVisiveis.map(data => {
                                const entry = lookupRemessa[`${filial}_${data}`];
                                return (
                                  <React.Fragment key={data}>
                                    <td className="border border-gray-200 px-3 py-3 text-center text-gray-700">
                                      {entry ? entry.quantidade : <span className="text-gray-300">—</span>}
                                    </td>
                                    <td className="border border-gray-200 px-3 py-3 text-center text-gray-700 whitespace-nowrap">
                                      {entry ? `R$ ${fmt(entry.valorTotal)}` : <span className="text-gray-300">—</span>}
                                    </td>
                                  </React.Fragment>
                                );
                              })}
                              <td className="border border-gray-200 px-3 py-3 text-center font-semibold text-indigo-800 bg-indigo-50">
                                {totalQtd || <span className="text-gray-300">—</span>}
                              </td>
                              <td className="border border-gray-200 px-3 py-3 text-center font-semibold text-indigo-800 bg-indigo-50 whitespace-nowrap">
                                {totalVal > 0 ? `R$ ${fmt(totalVal)}` : <span className="text-gray-300">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                        {/* Linha de totais */}
                        <tr className="bg-indigo-50 font-semibold border-t-2 border-indigo-300">
                          <td className="sticky-col border border-gray-300 px-4 py-3 text-indigo-800 bg-indigo-50">Total</td>
                          {datasRemessaVisiveis.map(data => {
                            const qtd = filiaisVisiveis.reduce((s, f) => s + (lookupRemessa[`${f}_${data}`]?.quantidade || 0), 0);
                            const val = filiaisVisiveis.reduce((s, f) => s + (lookupRemessa[`${f}_${data}`]?.valorTotal || 0), 0);
                            return (
                              <React.Fragment key={data}>
                                <td className="border border-gray-300 px-3 py-3 text-center text-indigo-800">{qtd || <span className="text-gray-300">—</span>}</td>
                                <td className="border border-gray-300 px-3 py-3 text-center text-indigo-800 whitespace-nowrap">
                                  {val > 0 ? `R$ ${fmt(val)}` : <span className="text-gray-300">—</span>}
                                </td>
                              </React.Fragment>
                            );
                          })}
                          <td className="border border-gray-300 px-3 py-3 text-center text-white bg-indigo-700 font-bold">
                            {filiaisVisiveis.reduce((s, f) => s + datasRemessaVisiveis.reduce((ss, d) => ss + (lookupRemessa[`${f}_${d}`]?.quantidade || 0), 0), 0)}
                          </td>
                          <td className="border border-gray-300 px-3 py-3 text-center text-white bg-indigo-700 font-bold whitespace-nowrap">
                            R$ {fmt(filiaisVisiveis.reduce((s, f) => s + datasRemessaVisiveis.reduce((ss, d) => ss + (lookupRemessa[`${f}_${d}`]?.valorTotal || 0), 0), 0))}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  )}
                  </div>
                  )}
                  {tabela1Expandida && (
                  <div className="mt-4 no-print">
                    <ResponsiveContainer width="100%" height={150}>
                      <BarChart data={dadosParaGrafico} margin={{ top: 5, right: 20, left: 10, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="data" angle={-45} textAnchor="end" height={60} tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(value) => [`R$ ${fmt(value)}`, 'Remessa Bancária']} />
                        <Bar dataKey="remessa" fill="#3b82f6" name="Remessa Bancária" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  )}
                </div>

                {/* Grid para Tabelas 2 e 3 lado a lado */}
                <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Tabela 2: Despesas com Pessoal */}
                <div className={tabela2Expandida ? '' : 'no-print'}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-800">
                      <span className="text-green-600 mr-2">&gt;</span>
                      Despesas com Pessoal
                    </h2>
                    <button
                      onClick={() => setTabela2Expandida(!tabela2Expandida)}
                      className="no-print flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tabela2Expandida ? "M19 9l-7 7-7-7" : "M9 5l7 7-7 7"} />
                      </svg>
                      {tabela2Expandida ? 'Recolher' : 'Expandir'}
                    </button>
                  </div>
                  {tabela2Expandida && (
                  <div className="table-container">
                    <table className="min-w-full border border-gray-200 text-sm">
                      <thead className="sticky-header bg-green-600 text-white">
                        <tr>
                          <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Filial</th>
                          <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Data</th>
                          <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Categoria</th>
                          <th className="border border-gray-300 px-4 py-3 text-right font-semibold">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filiaisVisiveis.map(filial => {
                          const registrosFilial = dados.filter(item => {
                            const formaPagamento = buscarCampo(item, 'Forma de Pagamento');
                            const categoria = buscarCampo(item, 'Categoria');
                            const filialItem = buscarCampo(item, 'Filial');
                            const catPermitidas = ['Adiantamento', 'Férias', 'Indenizações e Aviso Prévio', 'Rescisões', 'Salários', 'Seguros de Vida'];
                            return (!formaPagamento || formaPagamento === 'N/D' || formaPagamento.trim() === '') 
                              && categoria && catPermitidas.includes(categoria.trim())
                              && filialItem === filial;
                          });
                          
                          if (registrosFilial.length === 0) return null;
                          
                          const totalFilial = registrosFilial.reduce((sum, item) => {
                            const valorRaw = buscarCampo(item, 'Valor');
                            return sum + parsearValor(valorRaw);
                          }, 0);
                          
                          return (
                            <React.Fragment key={filial}>
                              {registrosFilial.map((item, idx) => {
                                const data = buscarCampo(item, 'Vencimento');
                                const categoria = buscarCampo(item, 'Categoria');
                                const valorRaw = buscarCampo(item, 'Valor');
                                const valor = parsearValor(valorRaw);
                                return (
                                  <tr key={`${filial}-${idx}`} className="bg-white hover:bg-green-50">
                                    {idx === 0 && <td rowSpan={registrosFilial.length + 1} className="border border-gray-200 px-4 py-2 font-semibold bg-green-50">{filial}</td>}
                                    <td className="border border-gray-200 px-4 py-2">{data}</td>
                                    <td className="border border-gray-200 px-4 py-2">{categoria}</td>
                                    <td className="border border-gray-200 px-4 py-2 text-right">R$ {fmt(valor)}</td>
                                  </tr>
                                );
                              })}
                              <tr className="bg-green-100 font-semibold">
                                <td colSpan={2} className="border border-gray-200 px-4 py-2 text-right">Total {filial}:</td>
                                <td className="border border-gray-200 px-4 py-2 text-right">
                                  {registrosFilial.length} registro{registrosFilial.length > 1 ? 's' : ''} | R$ {fmt(totalFilial)}
                                </td>
                              </tr>
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  )}
                  {tabela2Expandida && (
                  <div className="mt-4 no-print">
                    <ResponsiveContainer width="100%" height={150}>
                      <BarChart data={dadosParaGrafico} margin={{ top: 5, right: 20, left: 10, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="data" angle={-45} textAnchor="end" height={60} tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(value) => [`R$ ${fmt(value)}`, 'Despesas Pessoal']} />
                        <Bar dataKey="pessoal" fill="#10b981" name="Despesas Pessoal" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  )}
                </div>

                {/* Tabela 3: Despesas Financeiras/Impostos */}
                <div className={tabela3Expandida ? '' : 'no-print'}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-800">
                      <span className="text-orange-600 mr-2">&gt;</span>
                      Despesas Financeiras/Impostos
                    </h2>
                    <button
                      onClick={() => setTabela3Expandida(!tabela3Expandida)}
                      className="no-print flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tabela3Expandida ? "M19 9l-7 7-7-7" : "M9 5l7 7-7 7"} />
                      </svg>
                      {tabela3Expandida ? 'Recolher' : 'Expandir'}
                    </button>
                  </div>
                  {tabela3Expandida && (
                  <div className="table-container">
                    <table className="min-w-full border border-gray-200 text-sm">
                      <thead className="sticky-header bg-orange-600 text-white">
                        <tr>
                          <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Filial</th>
                          <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Data</th>
                          <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Categoria</th>
                          <th className="border border-gray-300 px-4 py-3 text-right font-semibold">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filiaisVisiveis.map(filial => {
                          const registrosFilial = dados.filter(item => {
                            const formaPagamento = buscarCampo(item, 'Forma de Pagamento');
                            const categoria = buscarCampo(item, 'Categoria');
                            const filialItem = buscarCampo(item, 'Filial');
                            const documento = buscarCampo(item, 'Documento');
                            const catPermitidas = ['Energia Eletrica e Gas', 'ICMS', 'Impostos e Taxas Diversas', 'ISS', 'Pagamento de Empréstimos', 'Seguros'];
                            
                            // Verifica se é Débito Automático
                            const isDebitoAutomatico = documento && documento.toLowerCase().includes('débito automático');
                            
                            // Normalizar categoria para comparação (remover maiúsculas/minúsculas)
                            const catNormalizada = categoria ? categoria.trim().toUpperCase() : '';
                            const catEncontrada = catPermitidas.some(cat => cat.toUpperCase() === catNormalizada);
                            
                            // Inclui se: filial correta E (categoria permitida OU débito automático)
                            return filialItem === filial && (catEncontrada || isDebitoAutomatico);
                          });
                          
                          if (registrosFilial.length === 0) return null;
                          
                          const totalFilial = registrosFilial.reduce((sum, item) => {
                            const valorRaw = buscarCampo(item, 'Valor');
                            return sum + parsearValor(valorRaw);
                          }, 0);
                          
                          return (
                            <React.Fragment key={filial}>
                              {registrosFilial.map((item, idx) => {
                                const data = buscarCampo(item, 'Vencimento');
                                const categoria = buscarCampo(item, 'Categoria');
                                const valorRaw = buscarCampo(item, 'Valor');
                                const valor = parsearValor(valorRaw);
                                return (
                                  <tr key={`${filial}-${idx}`} className="bg-white hover:bg-orange-50">
                                    {idx === 0 && <td rowSpan={registrosFilial.length + 1} className="border border-gray-200 px-4 py-2 font-semibold bg-orange-50">{filial}</td>}
                                    <td className="border border-gray-200 px-4 py-2">{data}</td>
                                    <td className="border border-gray-200 px-4 py-2">{categoria}</td>
                                    <td className="border border-gray-200 px-4 py-2 text-right">R$ {fmt(valor)}</td>
                                  </tr>
                                );
                              })}
                              <tr className="bg-orange-100 font-semibold">
                                <td colSpan={2} className="border border-gray-200 px-4 py-2 text-right">Total {filial}:</td>
                                <td className="border border-gray-200 px-4 py-2 text-right">
                                  {registrosFilial.length} registro{registrosFilial.length > 1 ? 's' : ''} | R$ {fmt(totalFilial)}
                                </td>
                              </tr>
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  )}
                  {tabela3Expandida && (
                  <div className="mt-4 no-print">
                    <ResponsiveContainer width="100%" height={150}>
                      <BarChart data={dadosParaGrafico} margin={{ top: 5, right: 20, left: 10, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="data" angle={-45} textAnchor="end" height={60} tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(value) => [`R$ ${fmt(value)}`, 'Financ./Impostos']} />
                        <Bar dataKey="financeiras" fill="#f59e0b" name="Financ./Impostos" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  )}
                </div>
                </div>
                {/* Fim do Grid Tabelas 2 e 3 */}

                {/* Tabela 4: Despesas com Cartão de Crédito - Formato Pivô */}
                <div className={`mt-8 ${tabela4Expandida ? '' : 'no-print'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-800">
                      <span className="text-purple-600 mr-2">&gt;</span>
                      Despesas com Cartão de Crédito por Filial e Data
                    </h2>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setTabela4Expandida(!tabela4Expandida)}
                        className="no-print flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tabela4Expandida ? "M19 9l-7 7-7-7" : "M9 5l7 7-7 7"} />
                        </svg>
                        {tabela4Expandida ? 'Recolher' : 'Expandir'}
                      </button>
                      {tabela4Expandida && (
                      <button
                        onClick={() => setTabela4Transposta(!tabela4Transposta)}
                        className="no-print flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                        </svg>
                        {tabela4Transposta ? 'Visualização Normal' : 'Inverter Eixos'}
                      </button>
                      )}
                    </div>
                  </div>
                  {tabela4Expandida && (
                  <div className="table-container">{!tabela4Transposta ? (
                    <table className="min-w-full border border-gray-200 text-sm">
                      <thead>
                        <tr className="sticky-header">
                          <th rowSpan={2} className="sticky-col-header border border-gray-300 bg-purple-600 text-white px-4 py-3 text-left font-semibold min-w-32">Data</th>
                          {filiaisVisiveis.map(filial => (
                            <th key={filial} colSpan={2} className="border border-gray-300 bg-purple-500 text-white px-4 py-2 text-center font-semibold whitespace-nowrap">{filial}</th>
                          ))}
                          <th colSpan={2} className="border border-gray-300 bg-purple-800 text-white px-4 py-2 text-center font-semibold whitespace-nowrap">Total Geral</th>
                        </tr>
                        <tr className="sticky-header-second">
                          {filiaisVisiveis.map(filial => (
                            <React.Fragment key={filial}>
                              <th className="border border-gray-300 bg-purple-100 text-purple-800 px-3 py-2 text-center font-medium whitespace-nowrap">Qtd</th>
                              <th className="border border-gray-300 bg-purple-100 text-purple-800 px-3 py-2 text-center font-medium whitespace-nowrap">Valor Total</th>
                            </React.Fragment>
                          ))}
                          <th className="border border-gray-300 bg-purple-100 text-purple-800 px-3 py-2 text-center font-medium whitespace-nowrap">Qtd</th>
                          <th className="border border-gray-300 bg-purple-100 text-purple-800 px-3 py-2 text-center font-medium whitespace-nowrap">Valor Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {datasCartaoVisiveis.map((data, idx) => {
                          const totalQtd = filiaisVisiveis.reduce((s, f) => s + (lookupCartao[`${f}_${data}`]?.quantidade || 0), 0);
                          const totalVal = filiaisVisiveis.reduce((s, f) => s + (lookupCartao[`${f}_${data}`]?.valorTotal || 0), 0);
                          return (
                            <tr key={data} className={idx % 2 === 0 ? 'bg-white hover:bg-purple-50' : 'bg-gray-50 hover:bg-purple-50'}>
                              <td className="sticky-col border border-gray-200 px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{data}</td>
                              {filiaisVisiveis.map(filial => {
                                const entry = lookupCartao[`${filial}_${data}`];
                                return (
                                  <React.Fragment key={filial}>
                                    <td className="border border-gray-200 px-3 py-3 text-center text-gray-700">
                                      {entry ? entry.quantidade : <span className="text-gray-300">—</span>}
                                    </td>
                                    <td className="border border-gray-200 px-3 py-3 text-center text-gray-700 whitespace-nowrap">
                                      {entry ? `R$ ${fmt(entry.valorTotal)}` : <span className="text-gray-300">—</span>}
                                    </td>
                                  </React.Fragment>
                                );
                              })}
                              <td className="border border-gray-200 px-3 py-3 text-center font-semibold text-purple-800 bg-purple-50">
                                {totalQtd || <span className="text-gray-300">—</span>}
                              </td>
                              <td className="border border-gray-200 px-3 py-3 text-center font-semibold text-purple-800 bg-purple-50 whitespace-nowrap">
                                {totalVal > 0 ? `R$ ${fmt(totalVal)}` : <span className="text-gray-300">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                        <tr className="bg-purple-50 font-semibold border-t-2 border-purple-300">
                          <td className="sticky-col border border-gray-300 px-4 py-3 text-purple-800 bg-purple-50">Total</td>
                          {filiaisVisiveis.map(filial => {
                            const qtd = datasCartaoVisiveis.reduce((s, d) => s + (lookupCartao[`${filial}_${d}`]?.quantidade || 0), 0);
                            const val = datasCartaoVisiveis.reduce((s, d) => s + (lookupCartao[`${filial}_${d}`]?.valorTotal || 0), 0);
                            return (
                              <React.Fragment key={filial}>
                                <td className="border border-gray-300 px-3 py-3 text-center text-purple-800">{qtd || <span className="text-gray-300">—</span>}</td>
                                <td className="border border-gray-300 px-3 py-3 text-center text-purple-800 whitespace-nowrap">
                                  {val > 0 ? `R$ ${fmt(val)}` : <span className="text-gray-300">—</span>}
                                </td>
                              </React.Fragment>
                            );
                          })}
                          <td className="border border-gray-300 px-3 py-3 text-center text-white bg-purple-700 font-bold">
                            {filiaisVisiveis.reduce((s, f) => s + datasCartaoVisiveis.reduce((ss, d) => ss + (lookupCartao[`${f}_${d}`]?.quantidade || 0), 0), 0)}
                          </td>
                          <td className="border border-gray-300 px-3 py-3 text-center text-white bg-purple-700 font-bold whitespace-nowrap">
                            R$ {fmt(filiaisVisiveis.reduce((s, f) => s + datasCartaoVisiveis.reduce((ss, d) => ss + (lookupCartao[`${f}_${d}`]?.valorTotal || 0), 0), 0))}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  ) : (
                    <table className="min-w-full border border-gray-200 text-sm">
                      <thead>
                        <tr className="sticky-header">
                          <th rowSpan={2} className="sticky-col-header border border-gray-300 bg-purple-600 text-white px-4 py-3 text-left font-semibold min-w-32">Filial</th>
                          {datasCartaoVisiveis.map(data => (
                            <th key={data} colSpan={2} className="border border-gray-300 bg-purple-500 text-white px-4 py-2 text-center font-semibold whitespace-nowrap">{data}</th>
                          ))}
                          <th colSpan={2} className="border border-gray-300 bg-purple-800 text-white px-4 py-2 text-center font-semibold whitespace-nowrap">Total Geral</th>
                        </tr>
                        <tr className="sticky-header-second">
                          {datasCartaoVisiveis.map(data => (
                            <React.Fragment key={data}>
                              <th className="border border-gray-300 bg-purple-100 text-purple-800 px-3 py-2 text-center font-medium whitespace-nowrap">Qtd</th>
                              <th className="border border-gray-300 bg-purple-100 text-purple-800 px-3 py-2 text-center font-medium whitespace-nowrap">Valor Total</th>
                            </React.Fragment>
                          ))}
                          <th className="border border-gray-300 bg-purple-100 text-purple-800 px-3 py-2 text-center font-medium whitespace-nowrap">Qtd</th>
                          <th className="border border-gray-300 bg-purple-100 text-purple-800 px-3 py-2 text-center font-medium whitespace-nowrap">Valor Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filiaisVisiveis.map((filial, idx) => {
                          const totalQtd = datasCartaoVisiveis.reduce((s, d) => s + (lookupCartao[`${filial}_${d}`]?.quantidade || 0), 0);
                          const totalVal = datasCartaoVisiveis.reduce((s, d) => s + (lookupCartao[`${filial}_${d}`]?.valorTotal || 0), 0);
                          return (
                            <tr key={filial} className={idx % 2 === 0 ? 'bg-white hover:bg-purple-50' : 'bg-gray-50 hover:bg-purple-50'}>
                              <td className="sticky-col border border-gray-200 px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{filial}</td>
                              {datasCartaoVisiveis.map(data => {
                                const entry = lookupCartao[`${filial}_${data}`];
                                return (
                                  <React.Fragment key={data}>
                                    <td className="border border-gray-200 px-3 py-3 text-center text-gray-700">
                                      {entry ? entry.quantidade : <span className="text-gray-300">—</span>}
                                    </td>
                                    <td className="border border-gray-200 px-3 py-3 text-center text-gray-700 whitespace-nowrap">
                                      {entry ? `R$ ${fmt(entry.valorTotal)}` : <span className="text-gray-300">—</span>}
                                    </td>
                                  </React.Fragment>
                                );
                              })}
                              <td className="border border-gray-200 px-3 py-3 text-center font-semibold text-purple-800 bg-purple-50">
                                {totalQtd || <span className="text-gray-300">—</span>}
                              </td>
                              <td className="border border-gray-200 px-3 py-3 text-center font-semibold text-purple-800 bg-purple-50 whitespace-nowrap">
                                {totalVal > 0 ? `R$ ${fmt(totalVal)}` : <span className="text-gray-300">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                        <tr className="bg-purple-50 font-semibold border-t-2 border-purple-300">
                          <td className="sticky-col border border-gray-300 px-4 py-3 text-purple-800 bg-purple-50">Total</td>
                          {datasCartaoVisiveis.map(data => {
                            const qtd = filiaisVisiveis.reduce((s, f) => s + (lookupCartao[`${f}_${data}`]?.quantidade || 0), 0);
                            const val = filiaisVisiveis.reduce((s, f) => s + (lookupCartao[`${f}_${data}`]?.valorTotal || 0), 0);
                            return (
                              <React.Fragment key={data}>
                                <td className="border border-gray-300 px-3 py-3 text-center text-purple-800">{qtd || <span className="text-gray-300">—</span>}</td>
                                <td className="border border-gray-300 px-3 py-3 text-center text-purple-800 whitespace-nowrap">
                                  {val > 0 ? `R$ ${fmt(val)}` : <span className="text-gray-300">—</span>}
                                </td>
                              </React.Fragment>
                            );
                          })}
                          <td className="border border-gray-300 px-3 py-3 text-center text-white bg-purple-700 font-bold">
                            {filiaisVisiveis.reduce((s, f) => s + datasCartaoVisiveis.reduce((ss, d) => ss + (lookupCartao[`${f}_${d}`]?.quantidade || 0), 0), 0)}
                          </td>
                          <td className="border border-gray-300 px-3 py-3 text-center text-white bg-purple-700 font-bold whitespace-nowrap">
                            R$ {fmt(filiaisVisiveis.reduce((s, f) => s + datasCartaoVisiveis.reduce((ss, d) => ss + (lookupCartao[`${f}_${d}`]?.valorTotal || 0), 0), 0))}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  )}
                  </div>
                  )}
                  {tabela4Expandida && (
                  <div className="mt-4 no-print">
                    <ResponsiveContainer width="100%" height={150}>
                      <BarChart data={dadosParaGrafico} margin={{ top: 5, right: 20, left: 10, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="data" angle={-45} textAnchor="end" height={60} tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(value) => [`R$ ${fmt(value)}`, 'Cartão Crédito']} />
                        <Bar dataKey="cartao" fill="#8b5cf6" name="Cartão Crédito" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  )}
                </div>

                {/* Tabela 5: Totalizador por Tipo de Lançamento */}
                <div className={`mt-8 ${tabela5Expandida ? '' : 'no-print'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-800">
                      <span className="text-gray-600 mr-2">&gt;</span>
                      Totalizador por Tipo de Lançamento e Data
                    </h2>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setTabela5Expandida(!tabela5Expandida)}
                        className="no-print flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tabela5Expandida ? "M19 9l-7 7-7-7" : "M9 5l7 7-7 7"} />
                        </svg>
                        {tabela5Expandida ? 'Recolher' : 'Expandir'}
                      </button>
                      {tabela5Expandida && (
                      <button
                        onClick={() => setTabela5Transposta(!tabela5Transposta)}
                        className="no-print flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                        </svg>
                        {tabela5Transposta ? 'Visualização Normal' : 'Inverter Eixos'}
                      </button>
                      )}
                    </div>
                  </div>
                  {tabela5Expandida && (
                  <div className="table-container">{!tabela5Transposta ? (
                    <table className="min-w-full border border-gray-200 text-sm">
                      <thead>
                        <tr className="sticky-header">
                          <th rowSpan={2} className="sticky-col-header border border-gray-300 bg-gray-700 text-white px-4 py-3 text-left font-semibold min-w-32">Data</th>
                          <th rowSpan={2} className="sticky-col-2-header border border-gray-300 bg-gray-700 text-white px-4 py-3 text-left font-semibold min-w-40">Tipo de Lançamento</th>
                          {filiaisVisiveis.map(filial => (
                            <th key={filial} colSpan={2} className="border border-gray-300 bg-gray-600 text-white px-4 py-2 text-center font-semibold whitespace-nowrap">{filial}</th>
                          ))}
                          <th colSpan={2} className="border border-gray-300 bg-gray-800 text-white px-4 py-2 text-center font-semibold whitespace-nowrap">Total Geral</th>
                        </tr>
                        <tr className="sticky-header-second">
                          {filiaisVisiveis.map(filial => (
                            <React.Fragment key={filial}>
                              <th className="border border-gray-300 bg-gray-100 text-gray-800 px-3 py-2 text-center font-medium whitespace-nowrap">Qtd</th>
                              <th className="border border-gray-300 bg-gray-100 text-gray-800 px-3 py-2 text-center font-medium whitespace-nowrap">Valor Total</th>
                            </React.Fragment>
                          ))}
                          <th className="border border-gray-300 bg-gray-100 text-gray-800 px-3 py-2 text-center font-medium whitespace-nowrap">Qtd</th>
                          <th className="border border-gray-300 bg-gray-100 text-gray-800 px-3 py-2 text-center font-medium whitespace-nowrap">Valor Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {datasVisiveis.map((data, dataIdx) => {
                          const tipos = [
                            { nome: 'Remessa Bancária', lookup: lookupRemessa, cor: 'bg-blue-50' },
                            { nome: 'Despesas Pessoal', lookup: lookupPessoal, cor: 'bg-green-50' },
                            { nome: 'Financ./Impostos', lookup: lookupFinanceiras, cor: 'bg-orange-50' },
                            { nome: 'Cartão de Crédito', lookup: lookupCartao, cor: 'bg-purple-50' }
                          ];

                          const linhasTipos = tipos.map((tipo, tipoIdx) => {
                            const qtdPorFilial = {};
                            const valPorFilial = {};
                            let qtdTotal = 0;
                            let valTotal = 0;

                            filiaisVisiveis.forEach(filial => {
                              const entry = tipo.lookup[`${filial}_${data}`];
                              qtdPorFilial[filial] = entry?.quantidade || 0;
                              valPorFilial[filial] = entry?.valorTotal || 0;
                              qtdTotal += qtdPorFilial[filial];
                              valTotal += valPorFilial[filial];
                            });

                            return (
                              <tr key={`${data}-${tipoIdx}`} className={`${tipo.cor} hover:bg-gray-100`}>
                                {tipoIdx === 0 && <td rowSpan={5} className="sticky-col border border-gray-200 px-4 py-3 font-semibold text-gray-800 bg-gray-50">{data}</td>}
                                <td className="sticky-col-2 border border-gray-200 px-4 py-2 text-gray-700">{tipo.nome}</td>
                                {filiaisVisiveis.map(filial => (
                                  <React.Fragment key={filial}>
                                    <td className="border border-gray-200 px-3 py-2 text-center text-gray-700">
                                      {qtdPorFilial[filial] || <span className="text-gray-300">—</span>}
                                    </td>
                                    <td className="border border-gray-200 px-3 py-2 text-center text-gray-700 whitespace-nowrap">
                                      {valPorFilial[filial] > 0 ? `R$ ${fmt(valPorFilial[filial])}` : <span className="text-gray-300">—</span>}
                                    </td>
                                  </React.Fragment>
                                ))}
                                <td className="border border-gray-200 px-3 py-2 text-center font-semibold text-gray-800">
                                  {qtdTotal || <span className="text-gray-300">—</span>}
                                </td>
                                <td className="border border-gray-200 px-3 py-2 text-center font-semibold text-gray-800 whitespace-nowrap">
                                  {valTotal > 0 ? `R$ ${fmt(valTotal)}` : <span className="text-gray-300">—</span>}
                                </td>
                              </tr>
                            );
                          });

                          // Linha de Total da Data
                          let qtdTotalData = {};
                          let valTotalData = {};
                          let qtdGeralData = 0;
                          let valGeralData = 0;

                          filiaisVisiveis.forEach(filial => {
                            qtdTotalData[filial] = 0;
                            valTotalData[filial] = 0;

                            tipos.forEach(tipo => {
                              const entry = tipo.lookup[`${filial}_${data}`];
                              qtdTotalData[filial] += entry?.quantidade || 0;
                              valTotalData[filial] += entry?.valorTotal || 0;
                            });

                            qtdGeralData += qtdTotalData[filial];
                            valGeralData += valTotalData[filial];
                          });

                          const linhaTotalData = (
                            <tr key={`${data}-total`} className="bg-gray-200 font-semibold">
                              <td className="sticky-col-2 border border-gray-200 px-4 py-2 text-right text-gray-800">Total {data}:</td>
                              {filiaisVisiveis.map(filial => (
                                <React.Fragment key={filial}>
                                  <td className="border border-gray-200 px-3 py-2 text-center text-gray-800">
                                    {qtdTotalData[filial] || <span className="text-gray-300">—</span>}
                                  </td>
                                  <td className="border border-gray-200 px-3 py-2 text-center text-gray-800 whitespace-nowrap">
                                    {valTotalData[filial] > 0 ? `R$ ${fmt(valTotalData[filial])}` : <span className="text-gray-300">—</span>}
                                  </td>
                                </React.Fragment>
                              ))}
                              <td className="border border-gray-200 px-3 py-2 text-center font-bold text-white bg-gray-700">
                                {qtdGeralData}
                              </td>
                              <td className="border border-gray-200 px-3 py-2 text-center font-bold text-white bg-gray-700 whitespace-nowrap">
                                R$ {fmt(valGeralData)}
                              </td>
                            </tr>
                          );

                          return [...linhasTipos, linhaTotalData];
                        })}
                      </tbody>
                    </table>
                  ) : (
                    // Tabela Transposta: Filiais nas linhas, Datas nas colunas
                    <table className="min-w-full border border-gray-200 text-sm">
                      <thead>
                        <tr className="sticky-header">
                          <th rowSpan={2} className="sticky-col-header border border-gray-300 bg-gray-700 text-white px-4 py-3 text-left font-semibold min-w-32">Filial</th>
                          <th rowSpan={2} className="border border-gray-300 bg-gray-700 text-white px-4 py-3 text-left font-semibold min-w-40">Tipo de Lançamento</th>
                          {datasVisiveis.map(data => (
                            <th key={data} colSpan={2} className="border border-gray-300 bg-gray-600 text-white px-4 py-2 text-center font-semibold whitespace-nowrap">{data}</th>
                          ))}
                          <th colSpan={2} className="border border-gray-300 bg-gray-800 text-white px-4 py-2 text-center font-semibold whitespace-nowrap">Total Geral</th>
                        </tr>
                        <tr className="sticky-header-second">
                          {datasVisiveis.map(data => (
                            <React.Fragment key={data}>
                              <th className="border border-gray-300 bg-gray-100 text-gray-800 px-3 py-2 text-center font-medium whitespace-nowrap">Qtd</th>
                              <th className="border border-gray-300 bg-gray-100 text-gray-800 px-3 py-2 text-center font-medium whitespace-nowrap">Valor Total</th>
                            </React.Fragment>
                          ))}
                          <th className="border border-gray-300 bg-gray-100 text-gray-800 px-3 py-2 text-center font-medium whitespace-nowrap">Qtd</th>
                          <th className="border border-gray-300 bg-gray-100 text-gray-800 px-3 py-2 text-center font-medium whitespace-nowrap">Valor Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filiaisVisiveis.map((filial, filialIdx) => {
                          const tipos = [
                            { nome: 'Remessa Bancária', lookup: lookupRemessa, cor: 'bg-blue-50' },
                            { nome: 'Despesas Pessoal', lookup: lookupPessoal, cor: 'bg-green-50' },
                            { nome: 'Financ./Impostos', lookup: lookupFinanceiras, cor: 'bg-orange-50' },
                            { nome: 'Cartão de Crédito', lookup: lookupCartao, cor: 'bg-purple-50' }
                          ];

                          const linhasTipos = tipos.map((tipo, tipoIdx) => {
                            const qtdPorData = {};
                            const valPorData = {};
                            let qtdTotal = 0;
                            let valTotal = 0;

                            datasVisiveis.forEach(data => {
                              const entry = tipo.lookup[`${filial}_${data}`];
                              qtdPorData[data] = entry?.quantidade || 0;
                              valPorData[data] = entry?.valorTotal || 0;
                              qtdTotal += qtdPorData[data];
                              valTotal += valPorData[data];
                            });

                            return (
                              <tr key={`${filial}-${tipoIdx}`} className={`${tipo.cor} hover:bg-gray-100`}>
                                {tipoIdx === 0 && <td rowSpan={5} className="sticky-col border border-gray-200 px-4 py-3 font-semibold text-gray-800 bg-gray-50">{filial}</td>}
                                <td className="border border-gray-200 px-4 py-2 text-gray-700">{tipo.nome}</td>
                                {datasVisiveis.map(data => (
                                  <React.Fragment key={data}>
                                    <td className="border border-gray-200 px-3 py-2 text-center text-gray-700">
                                      {qtdPorData[data] || <span className="text-gray-300">—</span>}
                                    </td>
                                    <td className="border border-gray-200 px-3 py-2 text-center text-gray-700 whitespace-nowrap">
                                      {valPorData[data] > 0 ? `R$ ${fmt(valPorData[data])}` : <span className="text-gray-300">—</span>}
                                    </td>
                                  </React.Fragment>
                                ))}
                                <td className="border border-gray-200 px-3 py-2 text-center font-semibold text-gray-800">
                                  {qtdTotal || <span className="text-gray-300">—</span>}
                                </td>
                                <td className="border border-gray-200 px-3 py-2 text-center font-semibold text-gray-800 whitespace-nowrap">
                                  {valTotal > 0 ? `R$ ${fmt(valTotal)}` : <span className="text-gray-300">—</span>}
                                </td>
                              </tr>
                            );
                          });

                          // Linha de Total da Filial
                          let qtdTotalFilial = {};
                          let valTotalFilial = {};
                          let qtdGeralFilial = 0;
                          let valGeralFilial = 0;

                          datasVisiveis.forEach(data => {
                            qtdTotalFilial[data] = 0;
                            valTotalFilial[data] = 0;

                            tipos.forEach(tipo => {
                              const entry = tipo.lookup[`${filial}_${data}`];
                              qtdTotalFilial[data] += entry?.quantidade || 0;
                              valTotalFilial[data] += entry?.valorTotal || 0;
                            });

                            qtdGeralFilial += qtdTotalFilial[data];
                            valGeralFilial += valTotalFilial[data];
                          });

                          const linhaTotalFilial = (
                            <tr key={`${filial}-total`} className="bg-gray-200 font-semibold">
                              <td className="border border-gray-200 px-4 py-2 text-right text-gray-800">Total {filial}:</td>
                              {datasVisiveis.map(data => (
                                <React.Fragment key={data}>
                                  <td className="border border-gray-200 px-3 py-2 text-center text-gray-800">
                                    {qtdTotalFilial[data] || <span className="text-gray-300">—</span>}
                                  </td>
                                  <td className="border border-gray-200 px-3 py-2 text-center text-gray-800 whitespace-nowrap">
                                    {valTotalFilial[data] > 0 ? `R$ ${fmt(valTotalFilial[data])}` : <span className="text-gray-300">—</span>}
                                  </td>
                                </React.Fragment>
                              ))}
                              <td className="border border-gray-200 px-3 py-2 text-center font-bold text-white bg-gray-700">
                                {qtdGeralFilial}
                              </td>
                              <td className="border border-gray-200 px-3 py-2 text-center font-bold text-white bg-gray-700 whitespace-nowrap">
                                R$ {fmt(valGeralFilial)}
                              </td>
                            </tr>
                          );

                          return [...linhasTipos, linhaTotalFilial];
                        })}
                      </tbody>
                    </table>
                  )}
                  </div>
                  )}
                </div>
              </>
            )}

            {dados.length === 0 && !loading && (
              <div className="text-center py-12 text-gray-500">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="mt-4">Faça upload de um arquivo para começar</p>
                <p className="text-sm mt-2">O arquivo {tipoArquivo === 'excel' ? 'Excel' : 'CSV'} deve ter as mesmas colunas do sistema</p>
                <p className="text-sm mt-1">Colunas: Nome Fantasia, Data de Previsão, Valor da Conta, Categoria, Forma de Pagamento, Conta Corrente</p>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}
