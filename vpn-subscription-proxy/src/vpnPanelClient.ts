export class PanelTransportError extends Error {
  public constructor() {
    super('Panel request failed');
  }
}

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
    return this.request('/apiv2/clients', 'GET');
  }

  /** Returns false only for a parsed, known S-UI rejection. */
  public async createClient(clientData: Readonly<Record<string, unknown>>): Promise<boolean> {
    const form = new URLSearchParams({
      object: 'clients',
      action: 'new',
      data: JSON.stringify(clientData),
    });
    const response = await this.request('/apiv2/save', 'POST', form);
    return response.success === true;
  }

  private async request(
    endpoint: string,
    method: 'GET' | 'POST',
    body?: URLSearchParams,
  ): Promise<PanelApiResponse> {
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
    } catch {
      throw new PanelTransportError();
    }

    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch {
      throw new PanelTransportError();
    }

    if (!isRecord(parsed)) {
      throw new PanelTransportError();
    }
    return parsed;
  }
}
