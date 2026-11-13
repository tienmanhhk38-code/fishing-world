import { test, expect, type Page } from "@playwright/test";
import { SPECIES, QUESTS, type Profile } from "../../packages/shared/src/index";

// Render the real popup components against a local API fixture. No game room or DB writes.
function sampleProfile(count = 12): Profile {
  return {
    id: "popup-design-qa",
    name: "Ngư dân 887",
    appearanceId: "sailor",
    xp: 100,
    coins: 1000,
    revision: 1,
    ownedRods: ["wood", "bamboo"],
    equippedRod: "wood",
    equippedBait: "dough",
    baitCounts: { dough: 0, worm: 0, shrimp: 2 },
    tutorialStep: 0,
    fish: Array.from({ length: count }, (_, i) => ({
      id: `fish-${i}`,
      species: SPECIES[i % SPECIES.length].name,
      speciesId: SPECIES[i % SPECIES.length].id,
      grams: 3320 + i * 21,
      caughtAt: "2026-11-13T00:40:29Z",
      area: SPECIES[i % SPECIES.length].area,
      rarity: SPECIES[i % SPECIES.length].rarity,
      saleValue: 80,
    })),
    album: SPECIES.slice(0, 9).map((s) => ({
      speciesId: s.id,
      count: 3,
      recordGrams: 1110,
    })),
    quests: QUESTS.map((q, i) => ({
      ...q,
      progress: i < 3 ? q.goal : 0,
      claimed: i === 0,
      available: i < 2 || q.kind === "daily",
      period: "qa",
    })),
  };
}

async function installFixture(page: Page, count = 12) {
  page.on("pageerror", (error) =>
    console.error("Popup fixture:", error.message),
  );
  let profile = sampleProfile(count);
  const operations: Record<string, unknown>[] = [];
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = route.request().postDataJSON() ?? {};
    let result: unknown = profile;
    if (path === "/api/character") {
      profile = {
        ...profile,
        name: body.name,
        appearanceId: body.appearanceId,
        revision: profile.revision + 1,
      };
      result = { profile };
    } else if (path === "/api/economy") {
      operations.push(body);
      if (body.action === "equipRod") profile.equippedRod = body.itemId;
      if (body.action === "equipBait") profile.equippedBait = body.itemId;
      profile = { ...profile, revision: profile.revision + 1 };
      result = { profile, message: "Đã trang bị" };
    } else if (path === "/api/sale-quote") {
      result = {
        id: "qa-quote",
        count: body.fishId ? 1 : profile.fish.length,
        total: body.fishId ? 80 : 80 * profile.fish.length,
        expiresAt: new Date(Date.now() + 600000).toISOString(),
      };
    } else if (path === "/api/quests/claim") {
      operations.push(body);
      profile = {
        ...profile,
        revision: profile.revision + 1,
        quests: profile.quests?.map((q) =>
          q.id === body.questId ? { ...q, claimed: true } : q,
        ),
      };
      result = { profile, message: "Đã nhận thưởng" };
    }
    await route.fulfill({ json: result });
  });
  await page.route("**/__popup-design?*", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    ${["style", "social", "coastal", "experience", "responsive", "popup-mobile", "popup-design", "scrollbars"].map((n) => `<link rel="stylesheet" href="/src/${n}.css">`).join("")}
    </head><body><div id="root"></div><script type="module">
    import RefreshRuntime from '/@react-refresh';
    RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;
    const React = (await import('/node_modules/.vite/deps/react.js')).default;
    const {createRoot} = (await import('/node_modules/.vite/deps/react-dom_client.js')).default;
    const {InventoryPanel} = await import('/src/InventoryPanel.tsx');
    const {AlbumPanel,ShopPanel} = await import('/src/CollectionPanels.tsx');
    const {QuestPanel} = await import('/src/QuestPanel.tsx');
    const {AppearancePanel} = await import('/src/AppearancePanel.tsx');
    const {HelpPanel} = await import('/src/HelpPanel.tsx');
    const {MapPanel} = await import('/src/MapPanel.tsx');
    // Share the exact module URL Vite uses, including any active HMR timestamp.
    const componentSource = await (await fetch('/src/InventoryPanel.tsx')).text();
    const networkImport = componentSource.split('\\n').find(line => line.includes('from "/src/network.ts'));
    const networkUrl = networkImport?.split('"')[1] ?? '/src/network.ts';
    const {useGame} = await import(networkUrl);
    await import('/node_modules/@fontsource-variable/nunito/index.css');
    useGame.setState({profile:${JSON.stringify(profile)},connected:true,phase:'IDLE',area:'beach'});
    const h=React.createElement;
    function App(){const profile=useGame(s=>s.profile);const [view,setView]=React.useState(new URLSearchParams(location.search).get('view'));const [shopTab,setShopTab]=React.useState('rods');const close=()=>setView(null);
    const content=view==='inventory'?h(InventoryPanel,{profile,onClose:close,canVisitShop:!new URLSearchParams(location.search).has('away'),onShop:tab=>{setShopTab(tab);setView('shop')}}):view==='album'?h(AlbumPanel,{onClose:close}):view==='quests'?h(QuestPanel,{onClose:close}):view==='appearance'?h(AppearancePanel,{onClose:close}):view==='map'?h(MapPanel,{onClose:close}):view==='shop'?h(ShopPanel,{onClose:close,initialTab:shopTab}):view==='help'?h(HelpPanel,{onClose:close}):null;
    return h('main',{style:{background:'center / cover url(/assets/ui/island-map-reference.png)'}},content)}
    createRoot(document.getElementById('root')).render(h(App));</script></body></html>`,
    }),
  );
  return operations;
}

test("reference popups fit desktop, portrait and landscape", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await installFixture(page);
  for (const viewport of [
    { width: 1100, height: 700 },
    { width: 390, height: 844 },
    { width: 360, height: 800 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    for (const view of [
      "map",
      "inventory",
      "album",
      "quests",
      "help",
      "appearance",
    ]) {
      await page.goto(`/__popup-design?view=${view}`);
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const bounds = await dialog.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return {
          x: r.x,
          y: r.y,
          right: r.right,
          bottom: r.bottom,
          overflow: el.scrollWidth > el.clientWidth + 1,
        };
      });
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.right).toBeLessThanOrEqual(viewport.width + 1);
      expect(bounds.bottom).toBeLessThanOrEqual(viewport.height + 1);
      expect(bounds.overflow, `${view} at ${viewport.width}`).toBe(false);
      await page.screenshot({
        path: `.local/popup-reference/${view}-${viewport.width}.png`,
      });
      if (view === "inventory")
        for (const name of ["Cần câu", "Mồi"]) {
          await page.getByRole("tab", { name, exact: true }).click();
          expect(
            await dialog.evaluate((el) => el.scrollWidth > el.clientWidth + 1),
          ).toBe(false);
          await page.screenshot({
            path: `.local/popup-reference/inventory-${name === "Mồi" ? "bait" : "rod"}-${viewport.width}.png`,
          });
        }
    }
  }
  expect(errors).toEqual([]);
});

test("inventory four-row scrolling, selection, equipment, sale preview and shop links", async ({
  page,
}) => {
  const operations = await installFixture(page, 25);
  await page.goto("/__popup-design?view=inventory");
  await page.locator(".fish-grid article button").nth(1).click();
  await expect(page.locator(".fish-detail h3")).toHaveText(SPECIES[1].name);
  await expect(page.locator(".fish-grid article")).toHaveCount(25);
  await expect(page.locator(".pagination")).toHaveCount(0);
  const metrics = await page.locator(".fish-grid").evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      height: el.getBoundingClientRect().height,
      row: parseFloat(style.gridAutoRows),
      gap: parseFloat(style.rowGap),
      scrollHeight: el.scrollHeight,
    };
  });
  expect(metrics.height).toBeCloseTo(metrics.row * 4 + metrics.gap * 3, 0);
  expect(
    (await page.locator(".fish-detail").boundingBox())!.height,
  ).toBeCloseTo(metrics.height, 0);
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.height);
  await page.locator(".fish-grid article button").last().click();
  expect(
    await page.locator(".fish-grid").evaluate((el) => el.scrollTop),
  ).toBeGreaterThan(0);
  await expect(page.locator(".fish-detail h3")).toHaveText(
    SPECIES[24 % SPECIES.length].name,
  );
  await page.getByRole("button", { name: "Bán cá", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Bán 1 con cá?" }),
  ).toContainText("80");
  await page.getByRole("button", { name: "Hủy bán cá", exact: true }).click();
  await page.getByRole("tab", { name: "Cần câu", exact: true }).click();
  await page.getByRole("button", { name: "Cần tre", exact: true }).click();
  await page.getByRole("button", { name: "Trang bị", exact: true }).click();
  await expect(page.locator(".rod-details .equip-button")).toHaveText(
    "Đang dùng",
  );
  expect(operations[0]).toMatchObject({
    action: "equipRod",
    itemId: "bamboo",
    requestId: expect.any(String),
  });
  await page.getByRole("tab", { name: "Mồi", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Hết mồi", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Mua thêm mồi", exact: false })
    .click();
  await expect(
    page.getByRole("tab", { name: "Mồi", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
});

test("album four-row scrolling and filters, quest rewards, character editing and help close", async ({
  page,
}) => {
  const operations = await installFixture(page);
  await page.goto("/__popup-design?view=album");
  await expect(page.locator(".album-grid > button")).toHaveCount(
    SPECIES.length,
  );
  await expect(page.locator(".pagination")).toHaveCount(0);
  const metrics = await page.locator(".album-grid").evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      height: el.getBoundingClientRect().height,
      row: parseFloat(style.gridAutoRows),
      gap: parseFloat(style.rowGap),
    };
  });
  expect(metrics.height).toBeCloseTo(metrics.row * 4 + metrics.gap * 3, 0);
  expect(
    (await page.locator(".fish-detail").boundingBox())!.height,
  ).toBeCloseTo(metrics.height, 0);
  await page.locator(".album-grid > button").last().click();
  expect(
    await page.locator(".album-grid").evaluate((el) => el.scrollTop),
  ).toBeGreaterThan(0);
  await page.getByRole("tab", { name: "Nước ngọt", exact: true }).click();
  await expect(page.locator(".album-grid > button")).toHaveCount(
    SPECIES.filter((s) => s.area === "village").length,
  );
  expect(await page.locator(".album-grid").evaluate((el) => el.scrollTop)).toBe(
    0,
  );
  await page.goto("/__popup-design?view=quests");
  await page.getByRole("button", { name: "Nhận", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Đã nhận", exact: true }),
  ).toHaveCount(2);
  expect(operations.at(-1)).toMatchObject({
    questId: "intro-catch",
    requestId: expect.any(String),
  });
  await page.getByRole("button", { name: "Hằng ngày", exact: true }).click();
  await expect(page.locator(".quest-list article")).toHaveCount(3);
  await page.goto("/__popup-design?view=appearance");
  await page.getByRole("button", { name: "Chọn Nắng hè", exact: true }).click();
  await page.getByLabel("Tên nhân vật", { exact: true }).fill("Nắng trên đảo");
  await page
    .getByRole("button", { name: "Lưu nhân vật", exact: false })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.goto("/__popup-design?view=help");
  await expect(page.locator(".help-steps li")).toHaveCount(3);
  await page.getByRole("button", { name: "Ra bến thôi", exact: false }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("empty inventory, merchant proximity and locked destinations", async ({
  page,
}) => {
  await installFixture(page, 0);
  await page.goto("/__popup-design?view=inventory&away=1");
  await expect(page.locator(".fish-grid .empty")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Bán tất cả", exact: true }),
  ).toBeDisabled();
  await page.getByRole("tab", { name: "Cần câu", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Xem cửa hàng", exact: false }),
  ).toBeDisabled();
  await page.goto("/__popup-design?view=map");
  await page.locator(".map-hotspot").last().click();
  await expect(page.locator(".area-card .play")).toBeDisabled();
  await expect(page.locator(".area-card .destination-preview")).toHaveCount(0);
});
