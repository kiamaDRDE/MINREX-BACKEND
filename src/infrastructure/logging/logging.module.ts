import { randomUUID } from 'node:crypto';

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [ConfigModule],

      inject: [ConfigService],

      useFactory: (configService: ConfigService) => {
        const isDevelopment =
          configService.get<string>('NODE_ENV') === 'development';

        const pretty =
          configService.get<boolean>('LOG_PRETTY', false);

        return {
          pinoHttp: {
            level: configService.get<string>('LOG_LEVEL', 'info'),

            transport:
              isDevelopment && pretty
                ? {
                    target: 'pino-pretty',
                    options: {
                      singleLine: true,
                      translateTime: 'SYS:standard',
                      ignore: 'pid,hostname',
                    },
                  }
                : undefined,

            genReqId: (req, res) => {
              const incomingRequestId =
                req.headers['x-request-id'];

              const requestId =
                typeof incomingRequestId === 'string'
                  ? incomingRequestId
                  : randomUUID();

              res.setHeader('x-request-id', requestId);

              return requestId;
            },

            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'res.headers["set-cookie"]',
              ],
              censor: '[REDACTED]',
            },
          },
        };
      },
    }),
  ],

  exports: [LoggerModule],
})
export class LoggingModule {}
