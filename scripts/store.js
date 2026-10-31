import fs from "node:fs/promises";
import path from "node:path";
import { REGION } from "./config.js";
import { p } from "./paths.js";

const DATA = p("data/images.json");
const LEGACY = p("zh-cn/bing-wallpaper.md");
const LINE_RE = /^(\d{4}-\d{2}-\d{2}) \| \[(.*)\]\((https?:\/\/[^)\s]+)\)\s*$/;

export async function loadStore() {
  try {
    const raw = JSON.parse(await fs.readFile(DATA, "utf8"));
    // 兼容旧结构 { "zh-CN": [...] } 和扁平数组
    const list = Array.isArray(raw) ? raw : raw[REGION] ?? [];
    return { [REGION]: list };
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    return migrateLegacy();
  }
}

export async function saveStore(store) {
  await fs.mkdir(path.dirname(DATA), { recursive: true });
  await fs.writeFile(DATA, JSON.stringify(store, null, 2) + "\n");
}

async function migrateLegacy() {
  try {
    const text = await fs.readFile(LEGACY, "utf8");
    const imgs = [];
    for (const line of text.split("\n")) {
      const m = line.match(LINE_RE);
      if (m) imgs.push({ date: m[1], desc: m[2], url: m[3] });
    }
    if (imgs.length) {
      console.log(`migrate ${REGION}: ${imgs.length} entries from ${LEGACY}`);
      return { [REGION]: imgs };
    }
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  return { [REGION]: [] };
}
