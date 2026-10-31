import fs from "node:fs/promises";
import path from "node:path";
import { REGION } from "./config.js";
import { fetchLatest } from "./bing.js";
import { loadStore, saveStore } from "./store.js";
import { mergeLatest, groupByMonth } from "./merge.js";
import { renderAll, renderReadme, renderMonth } from "./render-md.js";
import {
  loadTemplates,
  getIndexTemplate,
  getDetailTemplate,
  renderIndexPage,
  renderDetailPage,
  detailUrlPath,
  simpleUrl,
} from "./template.js";
import { p } from "./paths.js";

const INDEX_LIMIT = 30;

const write = async (file, content) => {
  const full = p(file);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content);
};

// 单语言：全部输出到项目根
const PATHS = {
  mdRoot: ".",
  monthRoot: "picture",
  htmlRoot: "docs",
  linkPrefix: "/picture",
};

async function writeImagesJson(file, images) {
  let existing = [];
  try {
    existing = JSON.parse(await fs.readFile(p(file), "utf8")) ?? [];
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  // 旧数据里可能混有 en-us，这里只保留 zh-cn
  const regionLower = REGION.toLowerCase();
  const map = new Map(
    existing.filter((x) => x.region === regionLower).map((x) => [x.date, x]),
  );
  for (const img of images) {
    map.set(img.date, {
      date: img.date,
      region: regionLower,
      url: simpleUrl(img.url),
      desc: img.desc,
    });
  }
  await write(file, JSON.stringify([...map.values()]));
}

async function writeToday(file, img) {
  const regionLower = REGION.toLowerCase();
  await write(
    file,
    JSON.stringify(
      {
        file_name: `${regionLower}_${img.date}.jpg`,
        url: img.url,
        date: img.date,
        region: regionLower,
        desc: img.desc,
      },
      null,
      2,
    ),
  );
}

async function generateHtml(images) {
  const monthMap = groupByMonth(images);
  const indexTemplate = getIndexTemplate();
  const detailTemplate = getDetailTemplate();

  // 首页：docs/index.html
  const indexImages = images.slice(0, INDEX_LIMIT);
  await write(
    path.join(PATHS.htmlRoot, "index.html"),
    renderIndexPage(indexTemplate, indexImages, monthMap, null, REGION),
  );

  // 月份页：docs/YYYY-MM.html
  for (const [month, list] of monthMap) {
    await write(
      path.join(PATHS.htmlRoot, `${month}.html`),
      renderIndexPage(indexTemplate, list, monthMap, month, REGION),
    );
  }

  // 详情页：docs/day/YYYYMM/DD.html
  for (const img of images) {
    await write(
      path.join(PATHS.htmlRoot, detailUrlPath(img.date)),
      renderDetailPage(detailTemplate, img),
    );
  }

  await writeToday(path.join(PATHS.htmlRoot, "today"), images[0]);
  await writeImagesJson(path.join(PATHS.htmlRoot, "images.json"), images);
}

async function main() {
  const store = await loadStore();
  await loadTemplates();

  console.log(`== ${REGION} ==`);
  const latest = await fetchLatest();
  console.log(`latest: ${latest.date}  ${latest.desc.slice(0, 60)}`);

  const merged = mergeLatest(store[REGION] ?? [], latest);
  store[REGION] = merged;

  // Markdown
  await write(path.join(PATHS.mdRoot, "bing-wallpaper.md"), renderAll(merged));
  await write(
    path.join(PATHS.mdRoot, "README.md"),
    renderReadme(merged, PATHS.linkPrefix),
  );

  for (const [month, list] of groupByMonth(merged)) {
    await write(
      path.join(PATHS.monthRoot, month, "README.md"),
      renderMonth(month, list),
    );
  }

  // HTML
  await generateHtml(merged);

  await saveStore(store);
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
