export class APIError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export type ApiTransport = (
  path: string,
  options: RequestInit,
) => Promise<Response>;

// The transport owns server selection and credentials. Request bodies and
// HTTP errors use the same contract in the browser and future clients.
export function createApiClient(transport: ApiTransport) {
  function request(path: string, options: RequestInit = {}, csrf = "") {
    const headers = new Headers(options.headers);
    if (
      !(options.body instanceof FormData) &&
      options.body &&
      !headers.has("Content-Type")
    )
      headers.set("Content-Type", "application/json");
    if (csrf) headers.set("X-CSRF-Token", csrf);
    return transport(path, { ...options, headers });
  }

  async function json<T>(
    path: string,
    options: RequestInit = {},
    csrf = "",
  ): Promise<T> {
    const response = await request(path, options, csrf);
    if (!response.ok) {
      const body = await response
        .json()
        .catch(() => ({ detail: "Ошибка сервера" }));
      throw new APIError(
        response.status,
        typeof body.detail === "string"
          ? body.detail
          : "Проверьте заполнение полей",
      );
    }
    return response.json();
  }

  return { json, request };
}

const webClient = createApiClient((path, options) =>
  fetch("/api/v1" + path, { ...options, credentials: "same-origin" }),
);

export const api = webClient.json;
export const apiResponse = webClient.request;
