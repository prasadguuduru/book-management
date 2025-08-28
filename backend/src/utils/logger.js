"use strict";
/**
 * Enhanced logging utility for the ebook publishing platform
 * Provides comprehensive logging for debugging and monitoring
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const environment_1 = require("../config/environment");
class Logger {
    constructor() {
        const levels = { debug: 0, info: 1, warn: 2, error: 3 };
        this.logLevel = levels[environment_1.config.logging.level] || 0; // Default to debug for POC
    }
    formatMessage(level, message, context) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            environment: environment_1.config.environment,
            service: 'ebook-backend',
            version: process.env['npm_package_version'] || '1.0.0',
            ...context,
        };
        return JSON.stringify(logEntry, null, 2);
    }
    debug(message, context) {
        if (this.logLevel <= 0) {
            console.log(this.formatMessage('DEBUG', message, context));
        }
    }
    info(message, context) {
        if (this.logLevel <= 1) {
            console.log(this.formatMessage('INFO', message, context));
        }
    }
    warn(message, context) {
        if (this.logLevel <= 2) {
            console.warn(this.formatMessage('WARN', message, context));
        }
    }
    error(message, error, context) {
        if (this.logLevel <= 3) {
            const errorContext = {
                ...context,
                error: error ? {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                    cause: error.cause,
                } : undefined,
            };
            console.error(this.formatMessage('ERROR', message, errorContext));
        }
    }
    // Security-specific logging methods
    security(message, context) {
        const securityContext = {
            ...context,
            category: 'SECURITY',
            severity: 'HIGH',
        };
        console.log(this.formatMessage('SECURITY', message, securityContext));
    }
    audit(message, context) {
        const auditContext = {
            ...context,
            category: 'AUDIT',
            severity: 'MEDIUM',
        };
        console.log(this.formatMessage('AUDIT', message, auditContext));
    }
    performance(message, context) {
        const perfContext = {
            ...context,
            category: 'PERFORMANCE',
        };
        console.log(this.formatMessage('PERF', message, perfContext));
    }
    // Function entry/exit logging
    functionEntry(functionName, args, context) {
        this.debug(`🔵 ENTER: ${functionName}`, {
            ...context,
            functionName,
            arguments: this.sanitizeArgs(args),
            operation: 'FUNCTION_ENTRY',
        });
    }
    functionExit(functionName, result, context) {
        this.debug(`🔴 EXIT: ${functionName}`, {
            ...context,
            functionName,
            result: this.sanitizeResult(result),
            operation: 'FUNCTION_EXIT',
        });
    }
    // State change logging
    stateChange(entity, from, to, context) {
        this.info(`🔄 STATE_CHANGE: ${entity}`, {
            ...context,
            entity,
            fromState: from,
            toState: to,
            operation: 'STATE_CHANGE',
        });
    }
    // Database operation logging
    dbOperation(operation, table, key, context) {
        this.debug(`💾 DB_${operation.toUpperCase()}`, {
            ...context,
            operation: `DB_${operation.toUpperCase()}`,
            table,
            key: this.sanitizeKey(key),
        });
    }
    // JWT token logging
    tokenOperation(operation, tokenType, payload, context) {
        this.security(`🔐 TOKEN_${operation.toUpperCase()}: ${tokenType}`, {
            ...context,
            operation: `TOKEN_${operation.toUpperCase()}`,
            tokenType,
            payload: this.sanitizeTokenPayload(payload),
        });
    }
    // HTTP request/response logging
    httpRequest(method, url, headers, body, context) {
        this.debug(`📥 HTTP_REQUEST: ${method} ${url}`, {
            ...context,
            method,
            url,
            headers: this.sanitizeHeaders(headers),
            body: this.sanitizeBody(body),
            operation: 'HTTP_REQUEST',
        });
    }
    httpResponse(statusCode, headers, body, context) {
        this.debug(`📤 HTTP_RESPONSE: ${statusCode}`, {
            ...context,
            statusCode,
            headers: this.sanitizeHeaders(headers),
            body: this.sanitizeBody(body),
            operation: 'HTTP_RESPONSE',
        });
    }
    // Validation logging
    validation(type, success, errors, context) {
        const level = success ? 'debug' : 'warn';
        this[level](`✅ VALIDATION_${success ? 'SUCCESS' : 'FAILED'}: ${type}`, {
            ...context,
            validationType: type,
            success,
            errors,
            operation: 'VALIDATION',
        });
    }
    // Authorization logging
    authorization(resource, action, allowed, reason, context) {
        const level = allowed ? 'info' : 'warn';
        this[level](`🔒 AUTHORIZATION_${allowed ? 'GRANTED' : 'DENIED'}: ${action} on ${resource}`, {
            ...context,
            resource,
            action,
            allowed,
            reason,
            operation: 'AUTHORIZATION',
        });
    }
    // Private helper methods for sanitization
    sanitizeArgs(args) {
        if (!args)
            return undefined;
        if (typeof args === 'object') {
            const sanitized = { ...args };
            // Remove sensitive fields
            delete sanitized.password;
            delete sanitized.token;
            delete sanitized.refreshToken;
            delete sanitized.accessToken;
            return sanitized;
        }
        return args;
    }
    sanitizeResult(result) {
        if (!result)
            return undefined;
        if (typeof result === 'object') {
            const sanitized = { ...result };
            // Remove sensitive fields
            delete sanitized.hashedPassword;
            delete sanitized.password;
            delete sanitized.token;
            delete sanitized.refreshToken;
            delete sanitized.accessToken;
            return sanitized;
        }
        return result;
    }
    sanitizeKey(key) {
        if (!key)
            return undefined;
        if (typeof key === 'object') {
            return { ...key };
        }
        return key;
    }
    sanitizeTokenPayload(payload) {
        if (!payload)
            return undefined;
        return {
            userId: payload.userId,
            email: payload.email ? '***@***.***' : undefined,
            role: payload.role,
            iat: payload.iat,
            exp: payload.exp,
            aud: payload.aud,
            iss: payload.iss,
        };
    }
    sanitizeHeaders(headers) {
        if (!headers)
            return undefined;
        const sanitized = { ...headers };
        // Remove sensitive headers
        delete sanitized.authorization;
        delete sanitized.cookie;
        return sanitized;
    }
    sanitizeBody(body) {
        if (!body)
            return undefined;
        if (typeof body === 'object') {
            const sanitized = { ...body };
            // Remove sensitive fields
            delete sanitized.password;
            delete sanitized.token;
            delete sanitized.refreshToken;
            delete sanitized.accessToken;
            return sanitized;
        }
        return body;
    }
}
exports.logger = new Logger();
