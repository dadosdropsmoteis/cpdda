import React, { useState } from 'react';
import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line } from 'recharts';
import * as XLSX from 'xlsx';

export default function App() {
  const [dados, setDados] = useState([]);
  const [filialSelecionada, setFilialSelecionada] = useState('todas');
  const [filiaisSelecionadas, setFiliaisSelecionadas] = useState([]);
  const [datasSelecionadas, setDatasSelecionadas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tabelaTransposta, setTabelaTransposta] = useState(false);

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
        const workbook = XLSX.read(evento.target.result, { type: 'binary' });

        const nomeAba = 'Já Existentes';

        if (!workbook.SheetNames.includes(nomeAba)) {
          alert(`Aba "${nomeAba}" não encontrada. Abas disponíveis: ${workbook.SheetNames.join(', ')}`);
          setLoading(false);
          return;
        }

        const worksheet = workbook.Sheets[nomeAba];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
          alert('A aba "Já Existentes" está vazia.');
          setLoading(false);
          return;
        }

        // --- Diagnóstico de colunas (descomentar para depuração) ---
        // console.log('Colunas:', Object.keys(jsonData[0]));
        // console.log('1ª linha:', jsonData[0]);
        // -----------------------------------------------------------

        setDados(jsonData);
        setDatasSelecionadas([]);
        setLoading(false);
      } catch (erro) {
        console.error('Erro ao processar arquivo:', erro);
        alert('Erro ao processar o arquivo. Verifique o formato.');
        setLoading(false);
      }
    };

    reader.readAsBinaryString(arquivo);
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

  const dadosAgrupados = agruparPorDiaEFilial();

  const dadosFiltrados = filiaisSelecionadas.length > 0
    ? dadosAgrupados.filter(d => filiaisSelecionadas.includes(d.filial))
    : dadosAgrupados;

  const datasUnicas = [...new Set(dadosAgrupados.map(d => d.data))].sort((a, b) => {
    const [diaA, mesA, anoA] = a.split('/');
    const [diaB, mesB, anoB] = b.split('/');
    return new Date(anoA, mesA - 1, diaA) - new Date(anoB, mesB - 1, diaB);
  });

  const datasVisiveis = datasSelecionadas.length > 0
    ? datasUnicas.filter(d => datasSelecionadas.includes(d))
    : datasUnicas;

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

  const dadosParaGrafico = datasVisiveis.map(data => {
    let quantidade = 0;
    let valorTotal = 0;
    filiaisVisiveis.forEach(filial => {
      const entry = lookup[`${filial}_${data}`];
      if (entry) { quantidade += entry.quantidade; valorTotal += entry.valorTotal; }
    });
    return { data, quantidade, valorTotal };
  });

  const totais = dadosFiltrados.reduce((acc, item) => {
    if (datasVisiveis.includes(item.data)) {
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
            margin-bottom: 6px !important;
          }
          .recharts-wrapper {
            height: 140px !important;
          }
          .recharts-surface {
            height: 140px !important;
          }
          .table-container {
            max-height: none !important;
            overflow: visible !important;
            page-break-inside: avoid;
          }
          table { 
            font-size: 6.5px !important;
            width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
          }
          th, td { 
            padding: 1.5px 2px !important;
            font-size: 6.5px !important;
            line-height: 1.1 !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }
          th {
            background-color: #4f46e5 !important;
            color: white !important;
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Carregar arquivo Excel</label>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={processarArquivo}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
              />
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
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">Filtrar por filial</label>
                      {filiaisSelecionadas.length > 0 && (
                        <button onClick={() => setFiliaisSelecionadas([])} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                          Limpar ({filiaisSelecionadas.length} selecionada{filiaisSelecionadas.length > 1 ? 's' : ''})
                        </button>
                      )}
                    </div>
                    <div className="border border-gray-300 rounded-md p-3 max-h-36 overflow-y-auto bg-white">
                      <div className="flex flex-wrap gap-2">
                        {obterFiliais().map(filial => {
                          const sel = filiaisSelecionadas.includes(filial);
                          return (
                            <button
                              key={filial}
                              onClick={() => toggleFilial(filial)}
                              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                                sel ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400 hover:text-indigo-600'
                              }`}
                            >
                              {filial}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {filiaisSelecionadas.length === 0 ? 'Todas as filiais exibidas' : `${filiaisSelecionadas.length} de ${obterFiliais().length} filiais selecionadas`}
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">Filtrar por data</label>
                      {datasSelecionadas.length > 0 && (
                        <button onClick={() => setDatasSelecionadas([])} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                          Limpar ({datasSelecionadas.length} selecionada{datasSelecionadas.length > 1 ? 's' : ''})
                        </button>
                      )}
                    </div>
                    <div className="border border-gray-300 rounded-md p-3 max-h-36 overflow-y-auto bg-white">
                      <div className="flex flex-wrap gap-2">
                        {datasUnicas.map(data => {
                          const sel = datasSelecionadas.includes(data);
                          return (
                            <button
                              key={data}
                              onClick={() => toggleData(data)}
                              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                                sel ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400 hover:text-indigo-600'
                              }`}
                            >
                              {data}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {datasSelecionadas.length === 0 ? 'Todas as datas exibidas' : `${datasSelecionadas.length} de ${datasUnicas.length} datas selecionadas`}
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

                {/* Gráfico combinado */}
                <div className="mb-8 grafico-print">
                  <h2 className="text-xl font-semibold text-gray-800 mb-4">Quantidade de Registros e Valor Total por Data</h2>
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={dadosParaGrafico} margin={{ top: 10, right: 40, left: 10, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="data" angle={-45} textAnchor="end" height={80} />
                      <YAxis
                        yAxisId="left"
                        orientation="left"
                        tickFormatter={(v) => `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`}
                        label={{ value: 'Valor Total', angle: -90, position: 'insideLeft', offset: 10 }}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        label={{ value: 'Quantidade', angle: 90, position: 'insideRight', offset: 10 }}
                      />
                      <Tooltip
                        formatter={(value, name) =>
                          name === 'Quantidade'
                            ? [value, name]
                            : [`R$ ${fmt(value)}`, name]
                        }
                      />
                      <Legend verticalAlign="top" />
                      <Bar yAxisId="left" dataKey="valorTotal" fill="#3b82f6" name="Valor Total (R$)" radius={[4, 4, 0, 0]} />
                      <Line yAxisId="right" type="monotone" dataKey="quantidade" stroke="#10b981" strokeWidth={2} name="Quantidade" dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* Tabela Pivô */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-800">Detalhamento por Filial e Data</h2>
                    <button
                      onClick={() => setTabelaTransposta(!tabelaTransposta)}
                      className="no-print flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                      {tabelaTransposta ? 'Visualização Normal' : 'Inverter Eixos'}
                    </button>
                  </div>
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
                        {datasVisiveis.map((data, idx) => {
                          const totalQtd = filiaisVisiveis.reduce((s, f) => s + (lookup[`${f}_${data}`]?.quantidade || 0), 0);
                          const totalVal = filiaisVisiveis.reduce((s, f) => s + (lookup[`${f}_${data}`]?.valorTotal || 0), 0);
                          return (
                            <tr key={data} className={idx % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-gray-50 hover:bg-blue-50'}>
                              <td className="sticky-col border border-gray-200 px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{data}</td>
                              {filiaisVisiveis.map(filial => {
                                const entry = lookup[`${filial}_${data}`];
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
                            const qtd = datasVisiveis.reduce((s, d) => s + (lookup[`${filial}_${d}`]?.quantidade || 0), 0);
                            const val = datasVisiveis.reduce((s, d) => s + (lookup[`${filial}_${d}`]?.valorTotal || 0), 0);
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
                            {filiaisVisiveis.reduce((s, f) => s + datasVisiveis.reduce((ss, d) => ss + (lookup[`${f}_${d}`]?.quantidade || 0), 0), 0)}
                          </td>
                          <td className="border border-gray-300 px-3 py-3 text-center text-white bg-indigo-700 font-bold whitespace-nowrap">
                            R$ {fmt(filiaisVisiveis.reduce((s, f) => s + datasVisiveis.reduce((ss, d) => ss + (lookup[`${f}_${d}`]?.valorTotal || 0), 0), 0))}
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
                          {datasVisiveis.map(data => (
                            <th key={data} colSpan={2} className="border border-gray-300 bg-indigo-500 text-white px-4 py-2 text-center font-semibold whitespace-nowrap">
                              {data}
                            </th>
                          ))}
                          <th colSpan={2} className="border border-gray-300 bg-indigo-800 text-white px-4 py-2 text-center font-semibold whitespace-nowrap">
                            Total Geral
                          </th>
                        </tr>
                        <tr className="sticky-header-second">
                          {datasVisiveis.map(data => (
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
                          const totalQtd = datasVisiveis.reduce((s, d) => s + (lookup[`${filial}_${d}`]?.quantidade || 0), 0);
                          const totalVal = datasVisiveis.reduce((s, d) => s + (lookup[`${filial}_${d}`]?.valorTotal || 0), 0);
                          return (
                            <tr key={filial} className={idx % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-gray-50 hover:bg-blue-50'}>
                              <td className="sticky-col border border-gray-200 px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{filial}</td>
                              {datasVisiveis.map(data => {
                                const entry = lookup[`${filial}_${data}`];
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
                          {datasVisiveis.map(data => {
                            const qtd = filiaisVisiveis.reduce((s, f) => s + (lookup[`${f}_${data}`]?.quantidade || 0), 0);
                            const val = filiaisVisiveis.reduce((s, f) => s + (lookup[`${f}_${data}`]?.valorTotal || 0), 0);
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
                            {filiaisVisiveis.reduce((s, f) => s + datasVisiveis.reduce((ss, d) => ss + (lookup[`${f}_${d}`]?.quantidade || 0), 0), 0)}
                          </td>
                          <td className="border border-gray-300 px-3 py-3 text-center text-white bg-indigo-700 font-bold whitespace-nowrap">
                            R$ {fmt(filiaisVisiveis.reduce((s, f) => s + datasVisiveis.reduce((ss, d) => ss + (lookup[`${f}_${d}`]?.valorTotal || 0), 0), 0))}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  )}
                  </div>
                </div>
              </>
            )}

            {dados.length === 0 && !loading && (
              <div className="text-center py-12 text-gray-500">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="mt-4">Faça upload de um arquivo Excel para começar</p>
                <p className="text-sm mt-2">O arquivo deve conter uma aba chamada "Já Existentes"</p>
                <p className="text-sm mt-1">Colunas necessárias: Filial, Vencimento e Valor</p>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}
