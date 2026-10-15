import type {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';
import type {ProxyConfig} from './config.js';
import type {CreateDemoAccessService} from './createDemoAccess.js';
import {errorDetails, journalAudit, type AuditSink, type FailureDetails} from './diagnostics.js';
import {hmacIdentity, parseRequestGate, type RequestGateContext, type RequestRateLimiter} from './requestGate.js';
import type {RuntimeStats} from './runtimeStats.js';
import {demoCooldownResponse, proxyRequestSchema, serviceErrorResponse} from './schema.js';
import type {VerifySubscriptionService} from './verifySubscription.js';

type AuditResult = {outcome: 'accepted' | 'rejected' | 'error'; reason: string; details?: FailureDetails};
type RequestAudit = {
  startedAt: number;
  fields: Readonly<Record<string, unknown>>;
  purpose: 'verify' | 'demo' | 'unknown';
  result?: AuditResult;
  finished: boolean;
};

declare module 'fastify' {
  interface FastifyRequest {
    dragonetGate?: RequestGateContext;
    dragonetAudit?: RequestAudit;
  }
}

type ApiServices = Readonly<{
  verificationService: Pick<VerifySubscriptionService, 'verify'>;
  demoService: Pick<CreateDemoAccessService, 'create'>;
  rateLimiter: RequestRateLimiter;
  runtimeStats: RuntimeStats;
  audit?: AuditSink;
}>;

const isLoopback = (address: string | undefined): boolean => (
  address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
);

const hostMatches = (header: string | string[] | undefined, hostname: string): boolean => {
  if (typeof header !== 'string' || !header || header.includes(',')) return false;
  try {
    const url = new URL(`https://${header}`);
    return url.hostname.toLowerCase() === hostname && url.pathname === '/'
      && !url.username && !url.password && !url.search && !url.hash;
  } catch { return false; }
};

/** Shared by the production TLS listener and isolated HTTP integration tests. */
export const registerProxyApi = (app: FastifyInstance, config: ProxyConfig, hostname: string, services: ApiServices): void => {
  const audit = services.audit ?? journalAudit;
  const finish = (request: FastifyRequest, statusCode: number, override?: AuditResult): void => {
    const context = request.dragonetAudit;
    if (!context || context.finished) return;
    context.finished = true;
    const result = override ?? context.result ?? {outcome: 'error', reason: 'request_incomplete'};
    audit({event: 'request_completed', ...context.fields, purpose: context.purpose,
      ...result, statusCode, durationMs: Date.now() - context.startedAt});
  };
  const emitDemoFailure = (request: FastifyRequest, reason: string, details?: FailureDetails): void => {
    const context = request.dragonetAudit;
    if (context?.purpose === 'demo') {
      audit({event: 'demo_failed', ...context.fields, reason, ...details});
    }
  };
  const fail = (request: FastifyRequest, reply: FastifyReply, result: AuditResult, cooldown = false) => {
    if (request.dragonetAudit) request.dragonetAudit.result = result;
    emitDemoFailure(request, result.reason, result.details);
    services.runtimeStats.recordFailedRequest();
    return reply.code(200).send(cooldown ? demoCooldownResponse : serviceErrorResponse);
  };
  const closeWithoutResponse = (request: FastifyRequest, reply: FastifyReply, reason: string): void => {
    finish(request, 0, {outcome: 'rejected', reason});
    reply.hijack();
    request.raw.socket.destroy();
  };

  app.addHook('onRequest', (request, reply, done) => {
    const requestUrl = request.raw.url ?? '';
    const remoteAddress = request.raw.socket.remoteAddress;
    if (request.method === 'GET' && (requestUrl === '/healthz' || requestUrl === '/stats')) {
      if (!isLoopback(remoteAddress)) closeWithoutResponse(request, reply, 'health_endpoint_not_loopback');
      done();
      return;
    }
    const gate = parseRequestGate({
      requestId: request.headers['mpei-app-req-id'], remoteAddress,
      forwardedFor: request.headers['x-forwarded-for'], trustedReverseProxyIps: config.trustedReverseProxyIps,
    });
    if (!gate) {
      closeWithoutResponse(request, reply, 'invalid_request_header');
      done();
      return;
    }
    request.dragonetGate = gate;
    request.dragonetAudit = {
      startedAt: Date.now(), purpose: 'unknown', finished: false,
      fields: {
        requestId: request.id,
        method: request.method,
        ipHash: hmacIdentity(config.cooldownHmacKey, 'demo-ip', gate.clientIp),
        deviceHash: hmacIdentity(config.cooldownHmacKey, 'demo-device', gate.deviceId),
      },
    };
    audit({event: 'request_received', ...request.dragonetAudit.fields, headerAccepted: true});
    reply.raw.once('close', () => {
      if (!reply.raw.writableFinished) finish(request, 0, {outcome: 'error', reason: 'client_disconnected'});
    });
    if (request.method !== 'POST' || requestUrl !== config.requestPath) {
      closeWithoutResponse(request, reply, request.method !== 'POST' ? 'wrong_method' : 'wrong_path');
      done();
      return;
    }
    const servername = (request.raw.socket as {servername?: string}).servername;
    if (!hostMatches(request.headers.host, hostname) || servername?.toLowerCase() !== hostname) {
      closeWithoutResponse(request, reply, !hostMatches(request.headers.host, hostname) ? 'host_mismatch' : 'sni_mismatch');
    }
    done();
  });

  app.addHook('onResponse', async (request, reply) => { finish(request, reply.statusCode); });
  app.addHook('onRequestAbort', async request => { finish(request, 0, {outcome: 'error', reason: 'request_aborted'}); });
  app.addHook('onTimeout', async request => { finish(request, 0, {outcome: 'error', reason: 'connection_timeout'}); });

  app.get('/healthz', async () => ({status: 'ok'}));
  app.get('/stats', async () => services.runtimeStats.snapshot());
  app.post(config.requestPath, async (request, reply) => {
    const parsed = proxyRequestSchema.safeParse(request.body);
    const context = request.dragonetAudit;
    if (context && typeof request.body === 'object' && request.body !== null && 'purpose' in request.body) {
      const purpose = request.body.purpose;
      if (purpose === 'demo' || purpose === 'verify') context.purpose = purpose;
    }
    if (!request.dragonetGate || !parsed.success) {
      return fail(request, reply, {outcome: 'rejected', reason: 'invalid_body', details: {
        issues: parsed.success ? [] : parsed.error.issues.map(issue => ({
          code: issue.code, field: issue.path[0] === 'clientName' ? 'clientName' : 'request',
          ...(issue.code === 'custom' && issue.path[0] === 'clientName' ? {rule: issue.message} : {}),
          ...(issue.code === 'unrecognized_keys' ? {unknownKeyCount: issue.keys.length} : {}),
        })),
      }});
    }
    if (!services.rateLimiter.tryConsume(request.dragonetGate.clientIp)) {
      return fail(request, reply, {outcome: 'rejected', reason: 'rate_limited', details: {
        maximum: config.rateLimitMax, windowMs: config.rateLimitWindowMs,
      }});
    }
    try {
      if (parsed.data.purpose === 'verify') {
        const verification = await services.verificationService.verify(parsed.data.clientName);
        services.runtimeStats.recordSuccessfulVerify();
        if (context) context.result = {outcome: 'accepted', reason: 'verification_completed', details: verification};
        return reply.code(200).send({reqStatus: 'success',
          isClientFound: verification.isClientFound, isClientActive: verification.isClientActive});
      }
      const demo = await services.demoService.create(request.dragonetGate);
      if ('failure' in demo) {
        return fail(request, reply, {
          outcome: demo.failure === 'demo_cooldown' ? 'rejected' : 'error',
          reason: demo.failure, details: demo.details,
        }, demo.failure === 'demo_cooldown');
      }
      services.runtimeStats.recordSuccessfulDemo();
      audit({event: 'demo_created', ...context?.fields});
      if (context) context.result = {outcome: 'accepted', reason: 'demo_created'};
      return reply.code(200).send({reqStatus: 'success', demoSubURL: demo.demoSubURL});
    } catch (error) {
      return fail(request, reply, {outcome: 'error', reason: 'operation_failed', details: {stage: parsed.data.purpose, ...errorDetails(error)}});
    }
  });
  app.setErrorHandler((error, request, reply) => {
    if (reply.sent) return;
    const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
    const reason = code === 'FST_ERR_CTP_BODY_TOO_LARGE' ? 'body_too_large'
      : code === 'FST_ERR_CTP_INVALID_JSON_BODY' || code === 'FST_ERR_CTP_EMPTY_JSON_BODY' ? 'invalid_json'
      : code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE' ? 'unsupported_content_type' : 'request_error';
    fail(request, reply, {outcome: 'rejected', reason, details: errorDetails(error)});
  });
};
