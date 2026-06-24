import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
  createClient: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

describe("admin navigation", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("redirects the root page to the admin dashboard", async () => {
    const { default: Home } = await import("@/app/page");

    expect(() => Home()).toThrow("redirect:/dashboard");
  });

  it("signs in with Supabase credentials and redirects to the dashboard", async () => {
    const signInWithPassword = vi.fn(async () => ({ error: null }));
    mocks.createClient.mockResolvedValue({
      auth: { signInWithPassword },
    });
    const formData = new FormData();
    formData.set("email", "admin@example.com");
    formData.set("password", "correct-password");

    const { login } = await import("@/app/(auth)/login/actions");

    await expect(login(formData)).rejects.toThrow("redirect:/dashboard");
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "admin@example.com",
      password: "correct-password",
    });
  });

  it("maps the default admin username to the Supabase Auth email", async () => {
    const signInWithPassword = vi.fn(async () => ({ error: null }));
    mocks.createClient.mockResolvedValue({
      auth: { signInWithPassword },
    });
    const formData = new FormData();
    formData.set("identifier", "19tpdls");
    formData.set("password", "zeze1256!@");

    const { login } = await import("@/app/(auth)/login/actions");

    await expect(login(formData)).rejects.toThrow("redirect:/dashboard");
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "19tpdls@picup-picnic.local",
      password: "zeze1256!@",
    });
  });

  it("redirects failed login attempts with an invalid credentials error", async () => {
    mocks.createClient.mockResolvedValue({
      auth: {
        signInWithPassword: vi.fn(async () => ({
          error: new Error("Invalid login credentials"),
        })),
      },
    });
    const formData = new FormData();
    formData.set("email", "admin@example.com");
    formData.set("password", "wrong-password");

    const { login } = await import("@/app/(auth)/login/actions");

    await expect(login(formData)).rejects.toThrow(
      "redirect:/login?error=invalid_credentials",
    );
  });
});
