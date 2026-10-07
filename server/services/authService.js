// Universal Pest Control — Authentication Service
const bcrypt = require('bcryptjs');
const userModel = require('../models/userModel');
const auditLogModel = require('../models/auditLogModel');
const { generateToken } = require('../utils/jwt');

class AuthService {
  async login({ email, password, ipAddress = null, userAgent = null }) {
    const user = await userModel.findByEmail(email);

    if (!user) {
      await auditLogModel.log({
        action: 'LOGIN_FAILED_UNKNOWN_USER',
        entityType: 'auth',
        entityId: null,
        ipAddress,
        userAgent,
        details: { attemptedEmail: email }
      });
      throw new Error('Invalid email or password.');
    }

    if (!user.is_active) {
      await auditLogModel.log({
        userId: user.id,
        action: 'LOGIN_BLOCKED_INACTIVE',
        entityType: 'auth',
        entityId: String(user.id),
        ipAddress,
        userAgent
      });
      throw new Error('This user account has been deactivated. Please contact support.');
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      await auditLogModel.log({
        userId: user.id,
        action: 'LOGIN_FAILED_WRONG_PASSWORD',
        entityType: 'auth',
        entityId: String(user.id),
        ipAddress,
        userAgent
      });
      throw new Error('Invalid email or password.');
    }

    // Update last login timestamp
    await userModel.updateLastLogin(user.id);

    // Record successful login audit
    await auditLogModel.log({
      userId: user.id,
      action: 'USER_LOGIN_SUCCESS',
      entityType: 'auth',
      entityId: String(user.id),
      ipAddress,
      userAgent
    });

    const tokenPayload = {
      id: user.id,
      uuid: user.uuid,
      email: user.email,
      name: user.name,
      roles: user.roles
    };

    const token = generateToken(tokenPayload);

    return {
      token,
      user: {
        id: user.id,
        uuid: user.uuid,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatarUrl: user.avatar_url,
        roles: user.roles
      }
    };
  }

  async getMe(userId) {
    const user = await userModel.findById(userId);
    if (!user) {
      throw new Error('User not found.');
    }
    return {
      id: user.id,
      uuid: user.uuid,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.avatar_url,
      roles: user.roles,
      createdAt: user.created_at
    };
  }
}

module.exports = new AuthService();
