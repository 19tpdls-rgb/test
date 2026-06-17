import { expect, test } from "@playwright/test";

test("renders the admin login page", async ({ page }) => {
  await page.goto("/login");

  await expect(
    page.getByRole("heading", { name: "PICUP PICNIC Admin" }),
  ).toBeVisible();
  await expect(page.getByLabel("이메일")).toBeVisible();
  await expect(page.getByLabel("비밀번호")).toBeVisible();
});
