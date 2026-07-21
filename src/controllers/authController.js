const asyncHandler = require('../utils/asyncHandler');
const { setAuthCookie, clearAuthCookie } = require('../utils/authCookie');

function createAuthController({ authService, env }) {
  const register = asyncHandler(async (req, res) => {
    const result = await authService.register(req.body);
    setAuthCookie(res, result.token, env);
    res.status(201).json({ user: result.user });
  });

  const login = asyncHandler(async (req, res) => {
    const result = await authService.authenticate(req.body);
    setAuthCookie(res, result.token, env);
    res.status(200).json({ user: result.user });
  });

  const logout = (req, res) => {
    clearAuthCookie(res, env);
    res.status(204).send();
  };

  const me = (req, res) => {
    res.status(200).json({ user: req.user });
  };

  return {
    register,
    login,
    logout,
    me,
  };
}

module.exports = createAuthController;
