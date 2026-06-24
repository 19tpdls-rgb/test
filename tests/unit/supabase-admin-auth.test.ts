import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createBrowserClient: vi.fn(),
  createServerClient: vi.fn(),
  cookies: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
  adminServerCreateClient: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: mocks.createBrowserClient,
  createServerClient: mocks.createServerClient,
}));

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

describe("Supabase client helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  });

  it("creates a browser client from public Supabase environment variables", async () => {
    const browserClient = { from: vi.fn() };
    mocks.createBrowserClient.mockReturnValue(browserClient);

    const { createClient } = await import("@/lib/supabase/client");

    expect(createClient()).toBe(browserClient);
    expect(mocks.createBrowserClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "anon-key",
    );
  });

  it("creates a server client with getAll and setAll cookie adapters", async () => {
    const cookieStore = {
      getAll: vi.fn(() => [{ name: "session", value: "old" }]),
      set: vi.fn(),
    };
    mocks.cookies.mockResolvedValue(cookieStore);
    mocks.createServerClient.mockReturnValue({ auth: {} });

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    expect(supabase).toEqual({ auth: {} });
    const options = mocks.createServerClient.mock.calls[0][2];
    expect(options.cookies.getAll()).toEqual([{ name: "session", value: "old" }]);

    options.cookies.setAll([
      {
        name: "session",
        value: "new",
        options: { path: "/", httpOnly: true },
      },
    ]);

    expect(cookieStore.set).toHaveBeenCalledWith("session", "new", {
      path: "/",
      httpOnly: true,
    });
  });

  it("refreshes middleware sessions and writes updated cookies and cache headers", async () => {
    mocks.createServerClient.mockImplementation((_url, _key, options) => ({
      auth: {
        getUser: vi.fn(async () => {
          options.cookies.setAll(
            [
              {
                name: "session",
                value: "fresh",
                options: { path: "/", httpOnly: true },
              },
            ],
            { "Cache-Control": "private, no-store" },
          );
          return { data: { user: { id: "user-1" } }, error: null };
        }),
      },
    }));

    const { updateSession } = await import("@/lib/supabase/middleware");
    const request = new NextRequest("https://picup.example/admin", {
      headers: { cookie: "session=stale" },
    });
    const response = await updateSession(request);

    expect(mocks.createServerClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "anon-key",
      expect.objectContaining({ cookies: expect.any(Object) }),
    );
    expect(response.cookies.get("session")?.value).toBe("fresh");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
});

describe("requireAdmin", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doMock("@/lib/supabase/server", () => ({
      createClient: mocks.adminServerCreateClient,
    }));
  });

  it("redirects unauthenticated users to login", async () => {
    mocks.adminServerCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
      },
    });

    const { requireAdmin } = await import("@/lib/auth/admin");

    await expect(requireAdmin()).rejects.toThrow("redirect:/login");
  });

  it("redirects authenticated users without an active admin row to login with an error", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    };
    mocks.adminServerCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: "user-1", email: "admin@example.com" } },
          error: null,
        })),
      },
      from: vi.fn(() => query),
    });

    const { requireAdmin } = await import("@/lib/auth/admin");

    await expect(requireAdmin()).rejects.toThrow(
      "redirect:/login?error=not_admin",
    );
    expect(query.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(query.eq).toHaveBeenCalledWith("is_active", true);
    expect(query.maybeSingle).toHaveBeenCalled();
  });

  it("throws Supabase admin lookup errors instead of redirecting as not_admin", async () => {
    const lookupError = new Error("PostgREST unavailable");
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(async () => ({ data: null, error: lookupError })),
    };
    mocks.adminServerCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: "user-1", email: "admin@example.com" } },
          error: null,
        })),
      },
      from: vi.fn(() => query),
    });

    const { requireAdmin } = await import("@/lib/auth/admin");

    await expect(requireAdmin()).rejects.toThrow(lookupError);
    expect(mocks.redirect).not.toHaveBeenCalledWith("/login?error=not_admin");
  });

  it("returns the verified user and active admin row", async () => {
    const user = { id: "user-1", email: "admin@example.com" };
    const admin = {
      user_id: "user-1",
      name: "PICUP Admin",
      role: "admin",
      is_active: true,
    };
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(async () => ({ data: admin, error: null })),
    };
    mocks.adminServerCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user }, error: null })),
      },
      from: vi.fn(() => query),
    });

    const { requireAdmin } = await import("@/lib/auth/admin");

    await expect(requireAdmin()).resolves.toEqual({ user, admin });
    expect(query.select).toHaveBeenCalledWith("user_id, name, role, is_active");
    expect(query.maybeSingle).toHaveBeenCalled();
  });
});
