import fs from "node:fs/promises";
import { p } from "./paths.js";

export const simpleUrl = (url) => {
  const i = url.indexOf("&");
  return i === -1 ? url : url.slice(0, i);
};

export const detailUrlPath = (date) => {
  const yyyymm = date.replace(/-/g, "").slice(0, 6);
  const dd = date.slice(8, 10);
  return `day/${yyyymm}/${dd}.html`;
};

const escAttr = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        c
      ]),
  );

// Fluent 图标（引用模板中的 SVG sprite symbol）
const icon = (id, cls = "") =>
  `<svg class="ic ${cls}" aria-hidden="true"><use href="#${id}"></use></svg>`;

const WEEKDAYS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

// 逐字符扫描 JS，去掉 // 与 /* */ 注释；跳过字符串、模板字符串，避免误删内容
function stripJsComments(code) {
  let out = "";
  let i = 0;
  let state = "code";
  while (i < code.length) {
    const c = code[i];
    const next = code[i + 1];
    if (state === "code") {
      if (c === "/" && next === "/") {
        state = "line";
        i += 2;
        continue;
      }
      if (c === "/" && next === "*") {
        state = "block";
        i += 2;
        continue;
      }
      if (c === "'" || c === '"' || c === "`") {
        state = c === "'" ? "sq" : c === '"' ? "dq" : "tpl";
        out += c;
        i += 1;
        continue;
      }
      out += c;
      i += 1;
      continue;
    }
    if (state === "line") {
      if (c === "\n") {
        state = "code";
        out += c;
      }
      i += 1;
      continue;
    }
    if (state === "block") {
      if (c === "*" && next === "/") {
        state = "code";
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }
    // 字符串内部：原样保留，处理转义
    out += c;
    if (c === "\\") {
      out += code[i + 1] ?? "";
      i += 2;
      continue;
    }
    if (
      (state === "sq" && c === "'") ||
      (state === "dq" && c === '"') ||
      (state === "tpl" && c === "`")
    ) {
      state = "code";
    }
    i += 1;
  }
  return out;
}

// 内联脚本去注释（带 src 的外链脚本不动）
const stripInlineScriptComments = (html) =>
  html.replace(
    /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi,
    (m, attrs, body) => {
      const cleaned = stripJsComments(body)
        .split("\n")
        .map((line) => line.replace(/\s+$/, ""))
        .filter((line, idx, arr) => !(line === "" && arr[idx - 1] === ""))
        .join("\n");
      return `<script${attrs}>${cleaned}</script>`;
    },
  );

// 输出前去掉 HTML 注释（保留条件注释，虽然本站不用）
const stripComments = (html) =>
  stripInlineScriptComments(html)
    .replace(/<!--(?!\[if)[\s\S]*?-->/g, "")
    .replace(/\n{3,}/g, "\n\n");

const weekday = (date) => {
  const [y, m, d] = date.split("-").map(Number);
  const w = new Date(y, m - 1, d).getDay();
  return Number.isNaN(w) ? "" : WEEKDAYS[w];
};

// 版权描述里常带 " (© xxx/Getty Images)"，卡片上只保留地点，署名留在详情页
const placeOf = (desc) => String(desc).replace(/\s*[（(]\s*(©|\(c\)|C)[^）)]*[）)]\s*$/i, "");

const shortDate = (date) => date.slice(5).replace("-", "/"); // 2026-10-31 -> 10/31

// 对应 HtmlConstant.Sidebar（导航抽屉条目，按年份分组）
const yearOf = (month) => month.slice(0, 4);

function renderSidebar(monthMap, nowMonth) {
  const months = [...monthMap.keys()];
  let out = "";
  let year = null;
  months.forEach((month, i) => {
    const key = yearOf(month);
    if (key !== year) {
      // 年份分组标签：第一组同时显示条目数
      year = key;
      const span = months.filter((m) => yearOf(m) === key);
      const label =
        i === 0 ? `${key} · 共 ${span.length} 个月` : `${key} · ${span.length} 个月`;
      out += `<div class="drawer-year">${label}</div>`;
    }
    const isCurrent = month === nowMonth;
    out += `<a href="${month}.html" class="drawer-item${
      isCurrent ? " is-current" : ""
    }"${isCurrent ? ' aria-current="page"' : ""}>${month}</a>`;
  });
  return out;
}

// 对应 HtmlConstant.ImgCard.IMG_CARD（Fluent Card）
function renderImgCard(img, region) {
  const simple = simpleUrl(img.url);
  const regionLower = region.toLowerCase();
  const href = detailUrlPath(img.date);
  const desc = escAttr(img.desc);
  const download4k = escAttr(
    `${simple}&rf=LaDigue_UHD.jpg&pid=hp&w=3840&h=2160&rs=1&c=4`,
  );
  const download1080 = escAttr(`${simple}&pid=hp&w=1920`);
  const dl = (url, label) =>
    `<a class="card-action bing-download" href="${url}" data-region="${regionLower}" data-date="${img.date}" data-desc="${desc}" target="_blank" rel="noopener" title="下载 ${label}" aria-label="下载 ${img.date} 的 ${label}">${label}</a>`;
  return (
    `<article class="card">` +
    `<a class="card-media" href="${href}" aria-label="查看 ${img.date} 的壁纸">` +
    `<img class="smallImg" src="${simple}&pid=hp&w=50" alt="" aria-hidden="true" />` +
    `<img class="bigImg" src="${simple}&pid=hp&w=384&h=216&rs=1&c=4" alt="${desc}" loading="lazy" onload="imgloading(this)">` +
    `</a>` +
    `<div class="card-body">` +
    `<span class="card-meta">${img.date} · ${weekday(img.date)}</span>` +
    `<a class="card-title" href="${href}">${escAttr(placeOf(img.desc))}</a>` +
    `<div class="card-foot">${dl(download4k, "4K")}${dl(download1080, "1080P")}</div>` +
    `</div>` +
    `</article>`
  );
}

// 按年份分组渲染月份归档（跨年时不居中、可读性更好）
function renderArchiveByYear(monthMap, nowMonth) {
  const groups = new Map();
  for (const month of monthMap.keys()) {
    const y = yearOf(month);
    if (!groups.has(y)) groups.set(y, []);
    groups.get(y).push(month);
  }
  let out = "";
  for (const [year, months] of groups) {
    out += `<section class="archive-year" aria-label="${year} 年">`;
    out += `<h3 class="archive-year-title"><span>${year}</span><small>${months.length} 个月</small></h3>`;
    out += `<div class="month-list">`;
    for (const month of months) {
      const isCurrent = month === nowMonth;
      out += `<a class="month-chip${isCurrent ? " is-current" : ""}" href="${month}.html"${
        isCurrent ? ' aria-current="page"' : ""
      }>${month}</a>`;
    }
    out += `</div></section>`;
  }
  return out;
}

function replaceHead(html, img, month) {
  let out = html.split("${head_img_url}").join(simpleUrl(img.url));
  out = out.split("${head_img_desc}").join(escAttr(img.desc));
  out = out.split("${head_date}").join(img.date);
  out = out
    .split("${head_title}")
    .join(month ? `Bing Wallpaper(${month})` : "Bing Wallpaper");
  return out;
}

export function renderIndexPage(template, images, monthMap, nowMonth, region) {
  const head = images[0];
  let html = replaceHead(template, head, nowMonth);
  html = html.split("${sidabar}").join(renderSidebar(monthMap, nowMonth));
  html = html
    .split("${recent_count}")
    .join(String(images.length));
  html = html
    .split("${total_months}")
    .join(String(monthMap.size));
  html = html
    .split("${total_images}")
    .join(String([...monthMap.values()].reduce((n, l) => n + l.length, 0)));
  html = html
    .split("${earliest_date}")
    .join(
      [...monthMap.values()]
        .flat()
        .map((x) => x.date)
        .sort()[0] ?? "—",
    );
  html = html
    .split("${img_card_list}")
    .join(images.map((img) => renderImgCard(img, region)).join(""));
  html = html
    .split("${month_history}")
    .join(renderArchiveByYear(monthMap, nowMonth));
  return stripComments(html);
}

export function renderDetailPage(template, img) {
  let html = template.split("${TITLE}").join(escAttr(img.desc));
  html = html.split("${IMG_URL}").join(simpleUrl(img.url));
  html = html.split("${IMG_DATE}").join(img.date);
  html = html.split("${IMG_DESC}").join(escAttr(img.desc));
  return stripComments(html);
}

let INDEX_TEMPLATE = null;
let DETAIL_TEMPLATE = null;

export async function loadTemplates() {
  try {
    INDEX_TEMPLATE = await fs.readFile(p("docs/bing-template.html"), "utf8");
    console.log("use docs/bing-template.html");
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    throw new Error(`template not found: ${p("docs/bing-template.html")}`);
  }
  try {
    DETAIL_TEMPLATE = await fs.readFile(p("docs/bing-detail.html"), "utf8");
    console.log("use docs/bing-detail.html");
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    throw new Error(`template not found: ${p("docs/bing-detail.html")}`);
  }
}
export function getIndexTemplate() {
  if (!INDEX_TEMPLATE) throw new Error("index template not loaded");
  return INDEX_TEMPLATE;
}

export function getDetailTemplate() {
  if (!DETAIL_TEMPLATE) throw new Error("detail template not loaded");
  return DETAIL_TEMPLATE;
}
