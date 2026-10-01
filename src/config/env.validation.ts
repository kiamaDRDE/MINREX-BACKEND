import Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),

  APP_NAME: Joi.string().default('minrex-api'),

  APP_PORT: Joi.number().port().default(3000),

  API_PREFIX: Joi.string().default('api'),

  API_VERSION: Joi.string().default('v1'),

  DATABASE_URL: Joi.string().required(),

  REDIS_HOST: Joi.string().default('localhost'),

  REDIS_PORT: Joi.number().port().default(6379),

  REDIS_PASSWORD: Joi.string().allow('').optional(),

  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace')
    .default('info'),

  LOG_PRETTY: Joi.boolean().truthy('true').falsy('false').default(false),

  CORS_ORIGINS: Joi.string().default(
    'http://localhost:3000,http://localhost:5173',
  ),

  CORS_CREDENTIALS: Joi.boolean().truthy('true').falsy('false').default(true),

  MAIL_HOST: Joi.string().required(),
  MAIL_PORT: Joi.number().port().default(1025),
  MAIL_SECURE: Joi.boolean().default(false),

  MAIL_USER: Joi.string().allow('').optional(),
  MAIL_PASSWORD: Joi.string().allow('').optional(),

  MAIL_FROM: Joi.string().email().required(),
  MAIL_FROM_NAME: Joi.string().default('MINREX'),

  FRONTEND_URL: Joi.string().uri().required(),

  JWT_ACCESS_SECRET: Joi.string().min(32).required(),

  JWT_ACCESS_TTL_SECONDS: Joi.number().integer().positive().default(900),

  JWT_REFRESH_TTL_SECONDS: Joi.number().integer().positive().default(604800),
});
