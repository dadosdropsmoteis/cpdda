// Vercel Serverless Function - API Santander OAuth Proxy
// Mantém credenciais seguras no servidor

export default async function handler(req, res) {
  // Permitir apenas POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Obter credenciais da variável de ambiente
    const credentialsJson = process.env.SANTANDER_CREDENTIALS;
    
    if (!credentialsJson) {
      console.error('❌ SANTANDER_CREDENTIALS não configurado');
      return res.status(500).json({ 
        error: 'Credenciais não configuradas no servidor',
        hint: 'Configure SANTANDER_CREDENTIALS nas variáveis de ambiente do Vercel'
      });
    }

    const credentials = JSON.parse(credentialsJson);

    // Obter parâmetros da requisição
    const { filial, accountNumber } = req.body;

    if (!filial) {
      return res.status(400).json({ error: 'Filial não informada' });
    }

    // Buscar credenciais da filial
    const filialConfig = credentials[filial];

    if (!filialConfig) {
      console.error(`❌ Filial não encontrada: ${filial}`);
      console.log('Filiais disponíveis:', Object.keys(credentials));
      return res.status(404).json({ 
        error: `Filial "${filial}" não encontrada nas credenciais`,
        filiaisDisponiveis: Object.keys(credentials)
      });
    }

    const { clientId, clientSecret, accounts } = filialConfig;

    if (!clientId || !clientSecret) {
      return res.status(500).json({ error: `Credenciais incompletas para ${filial}` });
    }

    console.log(`🏦 Buscando saldo para ${filial}`);

    // PASSO 1: Obter Access Token via OAuth
    const authString = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    const tokenResponse = await fetch('https://trust-open.api.santander.com.br/auth/oauth/v2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error(`❌ Erro OAuth para ${filial}:`, errorText);
      return res.status(tokenResponse.status).json({ 
        error: 'Erro ao obter token OAuth',
        details: errorText,
        status: tokenResponse.status
      });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    console.log(`✅ Token obtido para ${filial}`);

    // PASSO 2: Buscar saldos das contas
    const accountsToFetch = accountNumber ? [accountNumber] : (accounts || []);

    if (accountsToFetch.length === 0) {
      return res.status(400).json({ error: 'Nenhuma conta especificada' });
    }

    const results = [];

    for (const account of accountsToFetch) {
      try {
        console.log(`📊 Buscando conta ${account}...`);

        const balanceResponse = await fetch('https://api-customer.santander.com.br/balance_statement/v1/accounts/balance', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            accountNumber: account
          })
        });

        if (!balanceResponse.ok) {
          const errorText = await balanceResponse.text();
          console.error(`❌ Erro ao buscar conta ${account}:`, errorText);
          results.push({
            accountNumber: account,
            error: true,
            message: `Erro ${balanceResponse.status}`,
            details: errorText
          });
          continue;
        }

        const balanceData = await balanceResponse.json();
        console.log(`✅ Saldo obtido para conta ${account}`);

        results.push({
          accountNumber: account,
          success: true,
          data: balanceData
        });

      } catch (error) {
        console.error(`❌ Exceção ao buscar conta ${account}:`, error);
        results.push({
          accountNumber: account,
          error: true,
          message: error.message
        });
      }
    }

    // Retornar resultados
    return res.status(200).json({
      success: true,
      filial: filial,
      results: results
    });

  } catch (error) {
    console.error('❌ Erro geral:', error);
    return res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: error.message 
    });
  }
}
