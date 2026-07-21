function getAuthCookieOptions(env) {
  return {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: env.cookieSameSite,
    path: '/',
    maxAge: env.jwtExpiresInMs,
  };
}

function setAuthCookie(res, token, env) {
  res.cookie(env.cookieName, token, getAuthCookieOptions(env));
}

function clearAuthCookie(res, env) {
  const { httpOnly, secure, sameSite, path } = getAuthCookieOptions(env);
  res.clearCookie(env.cookieName, { httpOnly, secure, sameSite, path });
}

module.exports = {
  getAuthCookieOptions,
  setAuthCookie,
  clearAuthCookie,
};
