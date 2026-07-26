import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { MercuriusDriver, type MercuriusDriverConfig } from '@nestjs/mercurius';
import { LoggerModule } from 'nestjs-pino';
import { createDepthLimitRule } from './modules/evidence/infrastructure/graphql/depth-limit.rule.js';
import { EvidenceModule } from './modules/evidence/infrastructure/nest/evidence.module.js';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env['LOG_LEVEL'] ?? 'info',
        quietReqLogger: true,
        redact: ['req.headers.authorization', 'req.headers.cookie'],
      },
    }),
    GraphQLModule.forRoot<MercuriusDriverConfig>({
      driver: MercuriusDriver,
      autoSchemaFile: true,
      graphiql: false,
      path: '/graphql',
      validationRules: [createDepthLimitRule(6)],
    }),
    EvidenceModule,
  ],
})
export class AppModule {}
