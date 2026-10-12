// Universal Pest Control — Authentication Service
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const userModel = require('../models/userModel');
const sessionModel = require('../models/sessionModel');
const auditLogModel = require('../models/auditLogModel');
const { generateToken } = require('../utils/jwt');
const logger = require('../utils/logger');

class AuthService {
  /**
   * Authenticate user credentials and create MySQL-backed session
   */
  async login({ email, password, ipAddress = null, userAgent = null }) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const user = await userModel.findByEmail(normalizedEmail);

    // Generic error to prevent username/email enumeration
    const genericAuthError = new Error('Invalid email or password.');

    if (!user) {
      await auditLogModel.log({
        action: 'LOGIN_FAILED_UNKNOWN_USER',
        entityType: 'auth',
        entityId: null,
        ipAddress,
        userAgent,
        details: { attemptedEmail: normalizedEmail }
      });
      throw genericAuthError;
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
      // Generic error so attackers cannot discover valid accounts that are inactive
      throw genericAuthError;
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
      throw genericAuthError;
    }

    // Update last login timestamp
    await userModel.updateLastLogin(user.id);

    // Generate secure session ID
    const sessionId = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Persist session to MySQL
    try {
      await sessionModel.create({
        id: sessionId,
        userId: user.id,
        ipAddress,
        userAgent,
        expiresAt
      });
      logger.info(`Session created in MySQL for user ${user.id} (${user.email})`);
    } catch (sessionErr) {
      logger.warn(`Failed to persist session to MySQL (${sessionErr.message}). Fallback to stateless JWT claims.`);
    }

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
      roles: user.roles,
      sessionId
    };

    const token = generateToken(tokenPayload);

    return {
      sessionId,
      token,
      expiresAt,
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

  /**
   * Terminate active session in MySQL
   */
  async logout({ sessionId = null, userId = null, ipAddress = null }) {
    if (sessionId) {
      try {
        await sessionModel.delete(sessionId);
      } catch (err) {
        logger.warn(`Failed to delete session ${sessionId}: ${err.message}`);
      }
    }

    if (userId) {
      await auditLogModel.log({
        userId,
        action: 'USER_LOGOUT',
        entityType: 'auth',
        entityId: String(userId),
        ipAddress
      });
    }
  }

  /**
   * Retrieve currently authenticated user profile
   */
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
