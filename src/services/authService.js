const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const AppError = require('../utils/AppError');
const userRepository = require('../repositories/userRepository');

const BCRYPT_ROUNDS = 12;

function createAuthService({ db, env }) {
  function getPublicUser(user) {
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      nome: user.name,
      email: user.email,
      role: user.role,
      created_at: user.created_at,
    };
  }

  function generateToken(user) {
    if (!env.jwtSecret) {
      throw new AppError(
        'Autenticação não configurada neste ambiente',
        500,
        'AUTH_CONFIGURATION_ERROR'
      );
    }

    return jwt.sign(
      { sub: user.id },
      env.jwtSecret,
      { expiresIn: env.jwtExpiresIn }
    );
  }

  function verifyToken(token) {
    try {
      const payload = jwt.verify(token, env.jwtSecret);

      if (!payload || typeof payload.sub !== 'string') {
        throw new Error('Token sem subject');
      }

      return payload;
    } catch (_error) {
      throw new AppError('Autenticação necessária', 401, 'UNAUTHORIZED');
    }
  }

  async function register({ nome, email, senha }) {
    const normalizedEmail = userRepository.normalizeEmail(email);
    const existingUser = await userRepository.findUserByEmail(db, normalizedEmail);

    if (existingUser) {
      throw new AppError(
        'E-mail já cadastrado',
        409,
        'EMAIL_ALREADY_REGISTERED'
      );
    }

    const passwordHash = await bcrypt.hash(senha, BCRYPT_ROUNDS);

    try {
      const user = await userRepository.createUser(db, {
        name: nome,
        email: normalizedEmail,
        passwordHash,
        role: 'teacher',
      });

      return {
        user: getPublicUser(user),
        token: generateToken(user),
      };
    } catch (error) {
      if (error.code === '23505') {
        throw new AppError(
          'E-mail já cadastrado',
          409,
          'EMAIL_ALREADY_REGISTERED'
        );
      }

      throw error;
    }
  }

  async function authenticate({ email, senha }) {
    const user = await userRepository.findUserByEmail(db, email);
    const passwordMatches = user
      ? await bcrypt.compare(senha, user.password_hash)
      : false;

    if (!user || !passwordMatches) {
      throw new AppError('Credenciais inválidas', 401, 'INVALID_CREDENTIALS');
    }

    return {
      user: getPublicUser(user),
      token: generateToken(user),
    };
  }

  async function getAuthenticatedUser(userId) {
    const user = await userRepository.findUserById(db, userId);

    if (!user) {
      throw new AppError('Autenticação necessária', 401, 'UNAUTHORIZED');
    }

    return getPublicUser(user);
  }

  return {
    register,
    authenticate,
    generateToken,
    verifyToken,
    getAuthenticatedUser,
    getPublicUser,
  };
}

module.exports = {
  createAuthService,
  BCRYPT_ROUNDS,
};
