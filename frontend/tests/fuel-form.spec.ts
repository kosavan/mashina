import { expect, test } from "@playwright/test";

test.use({
  extraHTTPHeaders: { "X-Forwarded-For": "198.51.100.183" },
  timezoneId: "Asia/Tokyo",
});

test("English fill-ups use 24-hour time, car mileage and editable suggestions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.clock.setFixedTime(new Date("2026-01-10T15:07:00Z"));
  await page.goto("/");
  await page.getByLabel("Язык / Language", { exact: true }).selectOption("en");
  await page.getByRole("button", { name: "Explore the demo garage" }).click();
  await page.getByRole("button", { name: "Add vehicle", exact: true }).click();
  await page.getByLabel("Vehicle name", { exact: true }).fill("Fuel form test");
  await page
    .getByLabel("Odometer at purchase, km", { exact: true })
    .fill("1234");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const getState = async () => (await page.request.get("/api/v1/state")).json();
  const initial = await getState();
  const added = initial.vehicles.find(
    (car: { name: string }) => car.name === "Fuel form test",
  );
  const volvo = initial.vehicles.find(
    (car: { name: string }) => car.name === "Volvo XC60",
  );

  const openFillUp = async () => {
    await page.getByRole("button", { name: "Add record", exact: true }).click();
    await page.getByRole("button", { name: /^Fill-up / }).click();
  };
  const dialog = page.getByRole("dialog");
  const vehicle = dialog.getByRole("combobox", { name: "Vehicle", exact: true });
  const odometer = dialog.getByLabel("Odometer, km", { exact: true });
  const fuel = dialog.getByRole("combobox", { name: "Fuel", exact: true });
  const station = dialog.getByRole("combobox", {
    name: "Fuel station",
    exact: true,
  });
  const saveFillUp = async (description: string) => {
    await dialog.getByLabel("Liters", { exact: true }).fill("20");
    await dialog.getByLabel("Amount, ₽", { exact: true }).fill("1300");
    await dialog.getByLabel("Description", { exact: true }).fill(description);
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    return (await getState()).events.find(
      (entry: { description: string }) => entry.description === description,
    );
  };

  await openFillUp();
  await expect(dialog.getByLabel("Date", { exact: true })).toHaveValue(
    "2026-01-11",
  );
  await expect(
    dialog.getByRole("combobox", { name: "Hour (24 h)", exact: true }),
  ).toHaveValue("00");
  await expect(
    dialog.getByRole("combobox", { name: "Minute", exact: true }),
  ).toHaveValue("07");
  await vehicle.selectOption(added.id);
  await expect(odometer).toHaveValue("1234");
  await expect(fuel).toHaveValue("AI-95");
  await odometer.fill("1350");
  await vehicle.selectOption(volvo.id);
  await expect(odometer).toHaveValue(String(volvo.current_odometer));
  await vehicle.selectOption(added.id);
  await expect(odometer).toHaveValue("1234");

  await fuel.fill("AI-98");
  await fuel.press("ArrowDown");
  await fuel.press("Enter");
  await expect(fuel).toHaveValue("AI-98");
  await dialog
    .getByRole("button", { name: "Show options: Fuel station" })
    .click();
  await dialog.getByRole("option", { name: "Lukoil", exact: true }).click();
  await expect(station).toHaveValue("Lukoil");
  await station.fill("Independent station");

  await dialog.getByLabel("Date", { exact: true }).fill("2026-01-10");
  await dialog
    .getByRole("combobox", { name: "Hour (24 h)", exact: true })
    .selectOption("23");
  await dialog
    .getByRole("combobox", { name: "Minute", exact: true })
    .selectOption("47");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(await saveFillUp("Localized stock fuel")).toMatchObject({
    vehicle_id: added.id,
    odometer: 1234,
    fuel: "АИ-98",
    station: "Independent station",
    occurred_at: "2026-01-10T23:47:00",
  });

  await page.clock.setFixedTime(new Date("2026-01-11T10:34:00Z"));
  await openFillUp();
  await vehicle.selectOption(added.id);
  await expect(fuel).toHaveValue("AI-98");
  await expect(station).toHaveValue("Independent station");
  await fuel.fill("AI-95");
  expect(await saveFillUp("Manual fuel label")).toMatchObject({
    fuel: "AI-95",
    station: "Independent station",
    occurred_at: "2026-01-11T19:34:00",
  });
});
