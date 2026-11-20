import { Writable } from 'stream';
import pino from 'pino';
import { pseudonymize } from '../../domain/shared/pseudonymize';
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
});
