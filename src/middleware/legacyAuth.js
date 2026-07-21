const { supabase } = require('../services/supabaseService');

// Middleware mantido exclusivamente para as rotas legadas do Supabase.
async function authenticateLegacyToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        sucesso: false,
        erro: 'Token de autenticação não fornecido',
      });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        sucesso: false,
        erro: 'Token inválido ou expirado',
      });
    }

    const { createClient } = require('@supabase/supabase-js');
    const supabaseAuth = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: userData, error: userError } = await supabaseAuth
      .from('usuarios')
      .select('*')
      .eq('email', user.email)
      .single();

    let legacyUser = userData;

    if (userError || !legacyUser) {
      const { data: newUser, error: createError } = await supabaseAuth
        .from('usuarios')
        .insert([{
          nome: user.email.split('@')[0],
          email: user.email,
          papel: 'professor',
        }])
        .select()
        .single();

      if (createError || !newUser) {
        return res.status(401).json({
          sucesso: false,
          erro: 'Usuário legado não encontrado',
        });
      }

      legacyUser = newUser;
    }

    req.supabaseAuth = supabaseAuth;
    req.user = legacyUser;
    req.authUser = user;
    req.token = token;
    return next();
  } catch (error) {
    console.error('[legacy-auth] Falha de autenticação:', error.message);
    return res.status(500).json({
      sucesso: false,
      erro: 'Erro interno ao verificar autenticação',
    });
  }
}

module.exports = {
  authenticateLegacyToken,
};
