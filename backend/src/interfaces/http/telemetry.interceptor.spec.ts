import {
  Body,
  Controller,
  ExecutionContext,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import express from 'express';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { lastValueFrom, of } from 'rxjs';
import request from 'supertest';
import { FakeTelemetry } from '../../application/test/fake-telemetry';
import { Telemetry } from '../../domain/shared/telemetry';
import { TelemetryInterceptor } from './telemetry.interceptor';

@Controller('api/qr')
class QrController {
  @Get('boom')
  boom(): never {
    throw new TypeError('secret detail about alice@example.com');
  }

  @Get('missing')
  missing(): never {
    throw new NotFoundException('nope');
  }

  @Post()
  create(
    @Body() body: { content?: string },
    @Query('text') _text?: string,
  ): { ok: true } {
    void body;
    return { ok: true };
  }

  // Public, unthrottled routes (image/meta served to anyone holding the id).
  @Get(':id/png')
  png(@Param('id') id: string): string {
    return id;
  }

  @Get(':id/svg')
  svg(@Param('id') id: string): string {
    return id;
  }

  @Get(':id/meta')
  meta(@Param('id') id: string): string {
    return id;
  }

  @Get(':id/logo')
  logo(@Param('id') id: string): string {
    return id;
  }

  @Get(':id')
  find(@Param('id') id: string): { id: string } {
    return { id };
  }
}

@Controller('r')
class RedirectController {
  @Get(':id')
  redirect(@Param('id') id: string): string {
    return id;
  }
}

@Controller()
class HealthController {
  @Get('version')
  version(): string {
    return 'ok';
  }

  @Get('healthz')
  healthz(): string {
    return 'ok';
  }
}

describe('HTTP telemetry', () => {
  let app: NestExpressApplication;
  let telemetry: FakeTelemetry;
  let staticDir: string;

  beforeEach(async () => {
    telemetry = new FakeTelemetry();
    staticDir = mkdtempSync(join(tmpdir(), 'qrcode-telemetry-'));
    writeFileSync(join(staticDir, 'index.html'), '<html>spa</html>');
    writeFileSync(join(staticDir, 'app.js'), 'console.log(1)');
    const moduleRef = await Test.createTestingModule({
      controllers: [QrController, RedirectController, HealthController],
      providers: [
        { provide: Telemetry, useValue: telemetry },
        { provide: APP_INTERCEPTOR, useClass: TelemetryInterceptor },
      ],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    // Same order as production: ServeStatic middleware sits before the Nest routes.
    app.use(express.static(staticDir));
    app.use(
      (
        req: express.Request,
        res: express.Response,
        next: express.NextFunction,
      ) => {
        if (/^\/(api|r|healthz|version)(\/|$)/.test(req.path)) return next();
        res.sendFile(join(staticDir, 'index.html'));
      },
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    rmSync(staticDir, { recursive: true, force: true });
  });

  it('reports each request with its parameterized route, never the raw URL or query', async () => {
    await request(app.getHttpServer())
      .get('/api/qr/42?token=secret')
      .expect(200);

    expect(telemetry.names()).toEqual(['http_request']);
    const { properties } = telemetry.captured[0].event as {
      properties: Record<string, unknown>;
    };
    expect(properties).toEqual({
      route: '/api/qr/:id',
      method: 'GET',
      status: 200,
      duration_ms: expect.any(Number),
    });
    expect(JSON.stringify(telemetry.captured)).not.toMatch(/42|secret/);
  });

  it('reports client errors with their status', async () => {
    await request(app.getHttpServer()).get('/api/qr/missing').expect(404);

    expect(telemetry.captured[0].event).toMatchObject({
      name: 'http_request',
      properties: { route: '/api/qr/missing', status: 404 },
    });
  });

  it('reports server errors with status 500 and never the error message', async () => {
    await request(app.getHttpServer()).get('/api/qr/boom').expect(500);

    expect(telemetry.names()).toEqual(['http_request']);
    expect(telemetry.captured[0].event).toMatchObject({
      properties: { route: '/api/qr/boom', status: 500 },
    });
    expect(JSON.stringify(telemetry.captured)).not.toContain('alice');
  });

  it('does not report /healthz (polled by Docker)', async () => {
    await request(app.getHttpServer()).get('/healthz').expect(200);

    expect(telemetry.captured).toEqual([]);
  });

  it('does not report /version (public release identity, cost amplifier)', async () => {
    await request(app.getHttpServer()).get('/version').expect(200);

    expect(telemetry.captured).toEqual([]);
  });

  it('does not report the public scan redirect (/r/:id): unauthenticated, unthrottled, scan-driven volume', async () => {
    await request(app.getHttpServer()).get('/r/abc123').expect(200);

    expect(telemetry.captured).toEqual([]);
  });

  it.each(['png', 'svg', 'meta', 'logo'])(
    'does not report the public unthrottled /api/qr/:id/%s route',
    async (suffix) => {
      await request(app.getHttpServer())
        .get(`/api/qr/abc123/${suffix}`)
        .expect(200);

      expect(telemetry.captured).toEqual([]);
    },
  );

  it('reports nothing for a request that matches no route', async () => {
    await request(app.getHttpServer())
      .get('/api/qr/nope/alice@example.com/extra/segments')
      .expect(404);

    expect(telemetry.names()).not.toContain('http_request');
  });

  it('reports nothing for a static asset or an SPA request (served outside Nest routes)', async () => {
    await request(app.getHttpServer()).get('/app.js').expect(200);
    await request(app.getHttpServer()).get('/q/abc123').expect(200);
    await request(app.getHttpServer()).get('/').expect(200);

    expect(telemetry.captured).toEqual([]);
  });

  it('ignores non-HTTP contexts: a WebSocket handler sharing the global interceptor emits nothing', async () => {
    const interceptor = new TelemetryInterceptor(telemetry);
    const next = { handle: () => of('pong') };
    const wsContext = {
      getType: () => 'ws',
      switchToHttp: () => {
        throw new Error('must not read an HTTP request on a ws context');
      },
    } as unknown as ExecutionContext;

    await lastValueFrom(interceptor.intercept(wsContext, next));

    expect(telemetry.captured).toEqual([]);
  });

  it('never reports an email carried by a query string or a path parameter', async () => {
    await request(app.getHttpServer())
      .get('/api/qr/alice@example.com?email=bob@example.com')
      .expect(200);

    expect(telemetry.names()).toEqual(['http_request']);
    expect(JSON.stringify(telemetry.captured)).not.toMatch(/alice|bob|@/);
    expect(telemetry.captured[0].event).toMatchObject({
      properties: { route: '/api/qr/:id' },
    });
  });

  it('never reports a QR payload (URL or text) carried by a query string or a body', async () => {
    await request(app.getHttpServer())
      .post('/api/qr?text=my%20wifi%20password%20hunter2')
      .send({ content: 'https://private.example.org/invoice?id=987654' })
      .expect(201);

    expect(telemetry.names()).toEqual(['http_request']);
    expect(JSON.stringify(telemetry.captured)).not.toMatch(
      /private|invoice|987654|hunter2|wifi|https?:/,
    );
    expect(telemetry.captured[0].event).toMatchObject({
      properties: { route: '/api/qr', method: 'POST', status: 201 },
    });
  });
});
