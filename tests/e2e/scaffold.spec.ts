import { expect, test } from "@playwright/test";

test("renders the default admin scaffold", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Admin scaffold is ready." }),
  ).toBeVisible();
  await expect(page.getByText("PICUP PICNIC")).toBeVisible();
});
