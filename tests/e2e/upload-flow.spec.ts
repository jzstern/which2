import { test, expect } from "@playwright/test";

test.describe("Upload flow", () => {
  test("loads and displays the upload interface with expected UI elements", async ({
    page,
  }) => {
    // #given
    // User navigates to the home page

    // #when
    await page.goto("/");

    // #then
    expect(page).toHaveTitle(/which2/);
  });

  test("displays the upload zone with drop text", async ({ page }) => {
    // #given
    // User is on the home page

    // #when
    await page.goto("/");

    // #then
    await expect(page.getByText("Drop your photo here")).toBeVisible();
  });

  test("displays the tagline", async ({ page }) => {
    // #given
    // User is on the home page

    // #when
    await page.goto("/");

    // #then
    await expect(
      page.getByText("Find out which 2 famous faces you're a mashup of")
    ).toBeVisible();
  });

  test("displays the privacy note", async ({ page }) => {
    // #given
    // User is on the home page

    // #when
    await page.goto("/");

    // #then
    await expect(
      page.getByText("Your photo is analyzed but never stored")
    ).toBeVisible();
  });
});
