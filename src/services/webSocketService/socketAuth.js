const jwt = require('jsonwebtoken');
const db = require('../../modules/dbModules/db');
const logger = require('../../logger');

function parseCookies(cookieHeader = '') {
    return cookieHeader
        .split(';')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .reduce((acc, entry) => {
            const separatorIndex = entry.indexOf('=');
            if (separatorIndex <= 0) return acc;
            const key = entry.slice(0, separatorIndex).trim();
            const value = entry.slice(separatorIndex + 1).trim();
            acc[key] = decodeURIComponent(value);
            return acc;
        }, {});
}

function extractBearerToken(authorizationHeader = '') {
    if (!authorizationHeader) return null;
    const [scheme, token] = authorizationHeader.split(' ');
    if (!scheme || !token) return null;
    if (scheme.toLowerCase() !== 'bearer') return null;
    return token;
}

async function getUserFromSocket(socket) {
    const cookieToken = parseCookies(socket?.handshake?.headers?.cookie || '').token;
    const authToken = socket?.handshake?.auth?.token || null;
    const bearerToken = extractBearerToken(socket?.handshake?.headers?.authorization || '');
    const token = cookieToken || authToken || bearerToken;

    if (!token) {
        throw new Error('missing_token');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await db.oneOrNone('SELECT * FROM user_data_department WHERE user_id = $1', [decoded.userId]);

    if (!user) {
        throw new Error('user_not_found');
    }

    return user;
}

function namespaceJwtAuth({ namespaceName, allowedDepartments = [] }) {
    return async (socket, next) => {
        try {
            const user = await getUserFromSocket(socket);

            if (allowedDepartments.length > 0 && !allowedDepartments.includes(user.department_name)) {
                logger.warn(`WS access denied for ${user.email} on ${namespaceName}; required=${allowedDepartments.join(',')}, has=${user.department_name}`);
                return next(new Error('forbidden'));
            }

            socket.data.user = {
                user_id: user.user_id,
                email: user.email,
                department_name: user.department_name
            };
            return next();
        } catch (error) {
            logger.warn(`WS auth failed on ${namespaceName}: ${error.message}`);
            return next(new Error('unauthorized'));
        }
    };
}

function namespaceApiKeyAuth({ namespaceName, envKeys = ['RFID_WS_TOKEN', 'CONTROLLER_API_KEY', 'MQTT_API_KEY'] }) {
    return (socket, next) => {
        const configuredKeys = envKeys
            .map((keyName) => process.env[keyName])
            .filter((value) => typeof value === 'string' && value.length > 0);

        if (configuredKeys.length === 0) {
            logger.error(`WS namespace ${namespaceName} has no configured API key in env: ${envKeys.join(',')}`);
            return next(new Error('server_misconfigured'));
        }

        const providedKey =
            socket?.handshake?.auth?.apiKey ||
            socket?.handshake?.query?.apiKey ||
            socket?.handshake?.headers?.['x-mqtt-api-key'] ||
            socket?.handshake?.headers?.['x-controller-api-key'] ||
            null;

        if (!providedKey || !configuredKeys.includes(providedKey)) {
            logger.warn(`WS API key auth failed on ${namespaceName}`);
            return next(new Error('unauthorized'));
        }

        return next();
    };
}

module.exports = {
    namespaceJwtAuth,
    namespaceApiKeyAuth
};
