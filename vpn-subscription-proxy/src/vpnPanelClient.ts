import {networkErrorCode, PanelTransportError, safePanelMessage, type FailureDetails} from './diagnostics.js';
export {PanelTransportError} from './diagnostics.js';

export type PanelCreateResult = {created: true} | {created: false; details: FailureDetails};

export type PanelApiResponse = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const createEndpointUrl = (baseUrl: string, endpoint: string): string => {
  const url = new URL(baseUrl);
  const basePath = url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname;
  url.pathname = `${basePath}${endpoint}`;
  url.search = '';
  url.hash = '';
  return url.toString();
};

export class VpnPanelClient {
  public constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly timeoutMs: number,
    private readonly fetchImpl: typeof fetch = globalThis.fetch,
  ) {}

  public async getClients(): Promise<PanelApiResponse> {
    return (await this.request('/apiv2/clients', 'GET')).body;
  }

  /** Returns false only for a parsed, known S-UI rejection. */
  public async createClient(clientData: Readonly<Record<string, unknown>>): Promise<PanelCreateResult> {
    const form = new URLSearchParams({
      object: 'clients',
      action: 'new',
      data: JSON.stringify(clientData),
    });
    const {body: response, httpStatus} = await this.request('/apiv2/save', 'POST', form);
    if (response.success === true) return {created: true};
    if (response.success !== false) {
      throw new PanelTransportError({category: 'panel_invalid_response', endpoint: '/apiv2/save', httpStatus});
    }
    const strings: string[] = [this.token, this.baseUrl, new URL(this.baseUrl).pathname];
    const collectSecrets = (value: unknown): void => {
      if (typeof value === 'string') strings.push(value);
      else if (value && typeof value === 'object') Object.values(value).forEach(collectSecrets);
    };
    collectSecrets(clientData);
    const panelMessage = safePanelMessage(response.msg ?? response.message ?? response.error, strings.filter(value => value.length > 1));
    return {created: false, details: {
      category: 'panel_rejected', endpoint: '/apiv2/save', httpStatus,
      ...(panelMessage ? {panelMessage} : {}),
    }};
  }

  private async request(
    endpoint: string,
    method: 'GET' | 'POST',
    body?: URLSearchParams,
  ): Promise<{body: PanelApiResponse; httpStatus: number}> {
    let response: Response;
    try {
      const request: RequestInit = {
        method,
        headers: {
          Token: this.token,
          Accept: 'application/json',
          ...(body ? {'Content-Type': 'application/x-www-form-urlencoded'} : {}),
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      };
      if (body) {
        request.body = body;
      }
      response = await this.fetchImpl(createEndpointUrl(this.baseUrl, endpoint), request);
    } catch (error) {
      const code = networkErrorCode(error);
      const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
      throw new PanelTransportError({
        category: timedOut ? 'panel_timeout' : 'panel_network_error', endpoint,
        ...(code ? {code} : {}),
      });
    }

    if (!response.ok) {
      // Release the response stream without logging a potentially sensitive body.
      await response.body?.cancel().catch(() => {});
      throw new PanelTransportError({category: 'panel_http_error', endpoint, httpStatus: response.status});
    }

    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch (error) {
      const code = networkErrorCode(error);
      const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
      throw new PanelTransportError({
        category: timedOut ? 'panel_timeout' : error instanceof SyntaxError ? 'panel_invalid_json' : 'panel_network_error',
        endpoint, httpStatus: response.status, ...(code ? {code} : {}),
      });
    }

    if (!isRecord(parsed)) {
      throw new PanelTransportError({category: 'panel_invalid_response', endpoint, httpStatus: response.status});
    }
    return {body: parsed, httpStatus: response.status};
  }
}
