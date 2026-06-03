// responsive-audit.ts
// Run with: node src/scripts/responsive-audit.ts
import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import os from "os";

interface OverflowEntry {
  route: string;
  viewportWidth: number;
  overflow: boolean;
  offendingElements: {
    selector: string;
    scrollWidth: number;
    clientWidth: number;
    right: number;
    tagName: string;
    className: string;
  }[];
}

const routes = [
  "/attendance",
  "/live-roster",
  "/operator-console",
  "/kpi-governance",
  "/workforce",
];

// No dynamic scanning – only the prioritized routes are audited.
// Prioritized routes are listed first in the initial array

const viewports = [375, 390, 414, 430];
const results: OverflowEntry[] = [];

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"], protocolTimeout: 300000, timeout: 300000 });
  const page = await browser.newPage();
    // Increase navigation timeout to accommodate slower local dev server
    page.setDefaultNavigationTimeout(120000);
    page.setDefaultTimeout(180000);

  for (const route of routes) {
    const url = `http://localhost:5173${route}`; // default Vite dev port
    for (const vw of viewports) {
      await page.setViewport({ width: vw, height: 844, deviceScaleFactor: 1 });
      await page.goto(url, { waitUntil: "load", timeout: 120000 }).catch(() => console.warn(`Failed to load ${url}`));
      // If route is attendance, perform Clock In flow to reach post‑clock‑in state
      if (route === "/attendance") {
        // click Clock In button if present
        try {
          await page.waitForSelector('button:has-text("Clock In")', { timeout: 2000 });
          await page.click('button:has-text("Clock In")');
          // wait for selfie capture dialog to appear and close (skip actual capture)
          await new Promise(resolve => setTimeout(resolve, 1500));
        } catch (e) { /* ignore if not present */ }
      }
      // Evaluate overflow
      const overflowData = await page.evaluate(() => {
        const elems = Array.from(document.querySelectorAll<HTMLElement>("*")).filter(el => el.scrollWidth > el.clientWidth);
        const offending = elems.map(el => ({
          selector: el.tagName.toLowerCase() + (el.id ? `#${el.id}` : ''),
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          right: el.getBoundingClientRect().right,
          tagName: el.tagName,
          className: el.className,
        }));
        return {
          overflow: offending.length > 0,
          offending,
        };
      });
      results.push({
        route,
        viewportWidth: vw,
        overflow: overflowData.overflow,
        offendingElements: overflowData.offending,
      });
      // capture screenshot only if overflow occurs
      if (overflowData.overflow) {
        const screenshotPath = path.resolve("artifacts", "screenshots", `${route.replace("/", "")}__${vw}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
      }
    }
  }
  await browser.close();
  const reportPath = path.resolve("artifacts", "audit_report.json");
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log('Audit completed. Report saved to', reportPath);
})();
