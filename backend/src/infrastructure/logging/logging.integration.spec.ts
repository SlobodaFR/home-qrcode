import { Controller, Get, Req } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import { Logger, LoggerModule } from 'nestjs-pino';
import { Writable } from 'stream';
import request from 'supertest';
import { pseudonymize } from '../../domain/shared/pseudonymize';
import { loggerParams } from './logger.config';

const SECRET = 'b'.repeat(64);

@Controller()
class StubController {
  @Get('ping')
  ping(@Req() req: Request): string {
    return req.url;
  }
}

describe('HTTP request logs (end to end)', () => {
  let app: NestExpressApplication;
  const lines: string[] = [];

  beforeAll(async () => {
    const stream = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        lines.push(chunk.toString());
        callback();
      },
    });
    const pinoHttp = loggerParams('production', SECRET).pinoHttp as object;
    const moduleRef = await Test.createTestingModule({
      imports: [
        LoggerModule.forRoot({
          pinoHttp: { ...pinoHttp, stream, transport: undefined },
        }),
      ],
      controllers: [StubController],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({
      bufferLogs: true,
    });
    app.useLogger(app.get(Logger));
    app.use(
      (
        req: Request & { user?: unknown },
        _res: Response,
        next: NextFunction,
      ) => {
        // Stands in for JwtAuthGuard, which sets req.user.
        req.user = {
          id: 'user-42',
          email: 'alice@example.com',
          name: 'Alice Martin',
        };
        next();
      },
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('logs a pseudonym of the user and no personal data, query string, cookie or IP', async () => {
    await request(app.getHttpServer())
      .get('/ping?code=oauth-secret&email=alice@example.com')
      .set('Cookie', 'access_token=jwt-secret')
      .set('X-Forwarded-For', '203.0.113.7')
      .expect(200);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const output = lines.join('');
    expect(output).toContain(pseudonymize('user-42', SECRET));
    expect(output).toContain('"url":"/ping"');
    for (const forbidden of [
      'user-42',
      'alice@example.com',
      'Alice Martin',
      'oauth-secret',
      'jwt-secret',
      '203.0.113.7',
      '127.0.0.1',
    ]) {
      expect(output).not.toContain(forbidden);
    }
  });
});
