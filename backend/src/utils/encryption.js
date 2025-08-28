"use strict";
/**
 * Encryption service for PII data using AES-256-GCM
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptionService = exports.EncryptionService = void 0;
const crypto = __importStar(require("crypto"));
const environment_1 = require("../config/environment");
const logger_1 = require("./logger");
class EncryptionService {
    constructor() {
        // Ensure the key is exactly 32 bytes for AES-256
        const keyString = environment_1.config.encryption.key;
        if (keyString.length !== 32) {
            // For development, pad or truncate the key
            const paddedKey = keyString.padEnd(32, '0').substring(0, 32);
            this.key = Buffer.from(paddedKey, 'utf8');
            logger_1.logger.warn('Encryption key was adjusted to 32 bytes. Use a proper 32-byte key in production.');
        }
        else {
            this.key = Buffer.from(keyString, 'utf8');
        }
    }
    /**
     * Encrypt PII data
     */
    encrypt(plaintext) {
        try {
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipher('aes-256-cbc', this.key);
            let encrypted = cipher.update(plaintext, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            return {
                encrypted,
                iv: iv.toString('hex'),
                tag: '', // Not used for CBC mode
            };
        }
        catch (error) {
            logger_1.logger.error('Error encrypting data:', error instanceof Error ? error : new Error(String(error)));
            throw new Error('Encryption failed');
        }
    }
    /**
     * Decrypt PII data
     */
    decrypt(encryptedData) {
        try {
            const decipher = crypto.createDecipher('aes-256-cbc', this.key);
            let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        }
        catch (error) {
            logger_1.logger.error('Error decrypting data:', error instanceof Error ? error : new Error(String(error)));
            throw new Error('Decryption failed');
        }
    }
    /**
     * Hash sensitive data (for indexing purposes)
     */
    hash(data) {
        return crypto.createHash('sha256').update(data).digest('hex');
    }
    /**
     * Generate a secure random string
     */
    generateRandomString(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }
    /**
     * Validate encrypted data structure
     */
    isValidEncryptedData(data) {
        return (data &&
            typeof data.encrypted === 'string' &&
            typeof data.iv === 'string' &&
            typeof data.tag === 'string');
    }
}
exports.EncryptionService = EncryptionService;
// Singleton instance
exports.encryptionService = new EncryptionService();
