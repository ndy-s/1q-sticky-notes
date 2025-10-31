import dotenv from 'dotenv';

dotenv.config();

function requireEnv(name, defaultValue = undefined) {
    const value = process.env[name] ?? defaultValue;

    if (value === undefined || value === '') {
        throw new Error(`❌ Missing required environment variable: ${name}`);
    }

    return value;
}

export const config = {
    PORT: parseInt(requireEnv('SERVER_PORT', 10101)),
    SHARED_PASSWORD: requireEnv('SHARED_PASSWORD'),
};