import { Writable } from 'stream';
import pino from 'pino';
import { pseudonymize } from '../../domain/shared/pseudonymize';
import { QueryFailedError } from 'typeorm';
import { loggerParams, REDACT_PATHS } from './logger.config';

type Serializer = (value: unknown) => unknown;
const SECRET = 'a'.repeat(64);

function options(): {
  serializers: { req: Serializer; res: Serializer };
  customProps: (req: unknown) => Record<string, unknown>;
  level: string;
} {
  return loggerParams('production', SECRET).pinoHttp as ReturnType<
    typeof options
  >;
}

describe('logger configuration', () => {
  it('logs requests as method and path only: no query string, headers or IP', () => {
    const serialized = options().serializers.req({
      method: 'GET',
      url: '/api/auth/callback?code=abc',
      headers: { cookie: 'access_token=x', authorization: 'Bearer y' },
      remoteAddress: '203.0.113.7',
    });

    expect(serialized).toEqual({ method: 'GET', url: '/api/auth/callback' });
  });

  it('logs responses as status code only: no Location or Set-Cookie header', () => {
    const serialized = options().serializers.res({
      statusCode: 302,
      headers: {
        location: 'https://qrcode.example.test/?code=secret',
        'set-cookie': 'access_token=jwt',
      },
    });

    expect(serialized).toEqual({ statusCode: 302 });
  });

  it('tags authenticated requests with a pseudonym of the user id, never the id, email or name', () => {
    const props = options().customProps({
      user: { id: 'user-42', email: 'alice@example.com', name: 'Alice' },
    });

    expect(props).toEqual({ user: pseudonymize('user-42', SECRET) });
    const serialized = JSON.stringify(props);
    for (const personal of ['user-42', 'alice@example.com', 'Alice']) {
      expect(serialized).not.toContain(personal);
    }
  });

  it('adds nothing for anonymous requests (public scans)', () => {
    expect(options().customProps({})).toEqual({});
  });

  it('is silent under test', () => {
    expect(
      (loggerParams('test', SECRET).pinoHttp as { level: string }).level,
    ).toBe('silent');
  });

  it('redacts personal and secret fields in structured log objects', () => {
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        lines.push(chunk.toString());
        callback();
      },
    });
    const logger = pino({ redact: REDACT_PATHS }, stream);

    logger.info(
      { user: { email: 'a@b.c', token: 't0k3n' }, err: { code: 'X' } },
      'event',
    );

    const output = lines.join('');
    expect(output).not.toContain('a@b.c');
    expect(output).not.toContain('t0k3n');
    expect(output).toContain('"code":"X"');
  });

  describe('error serializer (allow-list)', () => {
    function logThroughPino(error: unknown): string {
      const lines: string[] = [];
      const stream = new Writable({
        write(chunk: Buffer, _encoding, callback) {
          lines.push(chunk.toString());
          callback();
        },
      });
      const { serializers } = options();
      const logger = pino(
        {
          redact: REDACT_PATHS,
          serializers: {
            err: (serializers as Record<string, Serializer>)['err'],
          },
        },
        stream,
      );
      // Same shape as nestjs-pino when Nest's exception filter logs an unhandled error.
      logger.error({ err: error }, 'Unhandled error');
      return lines.join('');
    }

    it('never logs the bound parameters, query or driver error of a failed TypeORM query', () => {
      const driverError = Object.assign(
        new Error('SQLITE_BUSY: database is locked'),
        {
          code: 'SQLITE_BUSY',
        },
      );
      const error = new QueryFailedError(
        'INSERT INTO users (email, name) VALUES (?, ?)',
        ['alice@example.com', 'Alice Martin'],
        driverError,
      );

      const output = logThroughPino(error);

      for (const personal of [
        'alice@example.com',
        'Alice Martin',
        'INSERT INTO',
      ]) {
        expect(output).not.toContain(personal);
      }
      expect(output).toContain('QueryFailedError');
      expect(output).toContain('SQLITE_BUSY');
      expect(output).not.toContain('driverError');
      expect(output).not.toContain('"parameters"');
    });

    it('keeps only type, message, stack and code', () => {
      const error = Object.assign(new Error('boom'), {
        code: 'E_BOOM',
        response: { body: 'sk-secret-token alice@example.com' },
        config: { headers: { authorization: 'Bearer abc' } },
        cause: new Error('alice@example.com'),
      });

      const logged = JSON.parse(logThroughPino(error)) as {
        err: Record<string, unknown>;
      };

      expect(Object.keys(logged.err).sort()).toEqual([
        'code',
        'message',
        'stack',
        'type',
      ]);
      expect(logged.err['message']).toBe('boom');
    });
  });
});
