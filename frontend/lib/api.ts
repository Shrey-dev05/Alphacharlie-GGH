import type {
  AuthUser,
  LoginResponse,
  ScanResult,
  ScanListItem,
  ChatResponse,
  AnalyticsSummary,
  IngredientQualityReport,
  MultiProductComparisonResult,
  SamadhanLabelRequest,
  SamadhanLabelResponse,
  SamadhanTemplate,
  SamadhanPromptParseResponse,
  ConsumerLabelScanResponse,
} from "./types";

function getApiBase(): string {
  if (typeof window !== "undefined") {
    if (process.env.NEXT_PUBLIC_API_BASE_URL) {
      return `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1`;
    }
    const hostname = window.location.hostname;
    // On mobile / LAN IP (e.g. 10.137.212.98), connect directly to backend on port 8000
    // so multipart uploads are direct, instant, and bypass the Next.js dev server proxy.
    if (hostname && hostname !== "localhost" && hostname !== "127.0.0.1") {
      return `${window.location.protocol}//${hostname}:8000/api/v1`;
    }
  }
  return "/api/v1";
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("lm_token");
}

export function setToken(token: string) {
  window.localStorage.setItem("lm_token", token);
}

export function clearToken() {
  window.localStorage.removeItem("lm_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const apiBase = getApiBase();
  let res: Response;
  try {
    res = await fetch(`${apiBase}${path}`, { ...options, headers });
  } catch (netErr: any) {
    // If direct connection failed, try fallback to rewrite proxy
    if (apiBase !== "/api/v1") {
      try {
        res = await fetch(`/api/v1${path}`, { ...options, headers });
      } catch {
        throw new ApiError("Unable to connect to the compliance server. Please ensure the backend is running.", 0);
      }
    } else {
      throw new ApiError("Unable to connect to the compliance server. Please ensure the backend is running.", 0);
    }
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      /* ignore non-JSON error bodies */
    }
    throw new ApiError(detail, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  async register(payload: {
    full_name: string;
    email: string;
    password: string;
    role: string;
    organization?: string;
    state?: string;
  }): Promise<AuthUser> {
    return request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  async login(email: string, password: string): Promise<LoginResponse> {
    const form = new URLSearchParams();
    form.set("username", email);
    form.set("password", password);
    const data = await request<LoginResponse>("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    setToken(data.access_token);
    return data;
  },

  async me(): Promise<AuthUser> {
    return request("/auth/me");
  },

  async createScan(form: FormData): Promise<ScanResult> {
    return request("/scans", { method: "POST", body: form });
  },

  async getScan(id: string): Promise<ScanResult> {
    return request(`/scans/${id}`);
  },

  async listScans(params: Record<string, string> = {}): Promise<ScanListItem[]> {
    const qs = new URLSearchParams(params).toString();
    return request(`/scans${qs ? `?${qs}` : ""}`);
  },

  async generateReport(scanId: string): Promise<{ report_id: string; download_url: string }> {
    return request(`/reports/scans/${scanId}/generate`, { method: "POST" });
  },

  async askChatbot(sessionId: string, message: string): Promise<ChatResponse> {
    return request("/chatbot/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, message }),
    });
  },

  async analyticsSummary(): Promise<AnalyticsSummary> {
    return request("/analytics/summary");
  },

  async overrideViolation(
    scanId: string,
    violationId: string,
    ignored: boolean,
    reason?: string
  ): Promise<ScanResult> {
    return request(`/scans/${scanId}/violations/${violationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ignored, reason }),
    });
  },

  async overrideAllViolations(scanId: string, reason?: string): Promise<ScanResult> {
    return request(`/scans/${scanId}/override-all`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
  },

  async deleteScan(scanId: string): Promise<void> {
    return request(`/scans/${scanId}`, { method: "DELETE" });
  },

  async clearAllScans(): Promise<{ message: string; deleted_count: number }> {
    return request("/scans", { method: "DELETE" });
  },

  // ---------- Consumer Health & Ingredient Intelligence ----------
  async analyzeIngredients(payload: {
    ingredients_text: string;
    product_name?: string;
    brand_name?: string;
  }): Promise<IngredientQualityReport> {
    return request("/consumer/analyze-ingredients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  async getScanIngredients(scanId: string): Promise<IngredientQualityReport> {
    return request(`/consumer/scan/${scanId}/ingredients`);
  },

  async compareProducts(products: Array<{
    id?: string;
    product_name: string;
    brand_name?: string;
    ingredients: string;
  }>): Promise<MultiProductComparisonResult> {
    return request("/consumer/compare-products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ products }),
    });
  },

  // ---------- Consumer Label Image Scan (Camera / Upload) ----------
  async scanConsumerLabel(file: File, productName?: string): Promise<ConsumerLabelScanResponse> {
    const formData = new FormData();
    formData.append("file", file);
    if (productName) formData.append("product_name", productName);

    const base = getApiBase();
    let res: Response;
    try {
      res = await fetch(`${base}/consumer/scan-image`, {
        method: "POST",
        body: formData,
      });
    } catch {
      res = await fetch("/api/v1/consumer/scan-image", {
        method: "POST",
        body: formData,
      });
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Failed to scan packaging label" }));
      throw new Error(err.detail || `Scan failed (${res.status})`);
    }
    return res.json();
  },

  // ---------- Samadhan AI Label Generator ----------
  async generateSamadhanLabel(payload: SamadhanLabelRequest): Promise<SamadhanLabelResponse> {
    return request("/samadhan/generate-label", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  async parseSamadhanPrompt(prompt: string): Promise<SamadhanPromptParseResponse> {
    return request("/samadhan/parse-prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
  },

  async getSamadhanTemplates(): Promise<SamadhanTemplate[]> {
    return request("/samadhan/templates");
  },
};

