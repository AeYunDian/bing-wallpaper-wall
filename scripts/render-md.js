import { README_LIMIT } from "./config.js";

const baseUrl = (u) => {
  const i = u.indexOf("&");
  return i === -1 ? u : u.slice(0, i);
};

const small = (u) => `${baseUrl(u)}&pid=hp&w=384&h=216&rs=1&c=4`;
const large = (u) => `${baseUrl(u)}&w=1000`;

// 版权描述里的特殊字符会破坏 markdown 表格和链接
const escMd = (s) => s.replace(/([|\[\]\\])/g, "\\$1");

export function renderAll(images) {
  const out = ["## Bing Wallpaper", ""];
  for (const img of images) {
    out.push(`${img.date} | [${escMd(img.desc)}](${img.url}) `);
    out.push("");
  }
  return out.join("\n") + "\n";
}

export function renderReadme(images, linkPrefix) {
  const recent = images.slice(0, README_LIMIT);
  const out = ["## Bing Wallpaper", ""];

  if (recent[0]) {
    out.push(
      `![](${large(recent[0].url)})Today: [${escMd(recent[0].desc)}](${
        recent[0].url
      })`,
      "",
    );
  }

  out.push("|      |      |      |", "| :----: | :----: | :----: |");
  for (let i = 0; i < recent.length; i += 3) {
    out.push(
      recent
        .slice(i, i + 3)
        .map((x) => `|![](${small(x.url)})${x.date} [download 4k](${x.url})`)
        .join("") + "|",
    );
  }

  out.push("", "### 历史归档：");
  const months = [...new Set(images.map((x) => x.date.slice(0, 7)))];
  const links = months.map((m) => `[${m}](${linkPrefix}/${m}/) | `);
  for (let i = 0; i < links.length; i += 8) {
    out.push(links.slice(i, i + 8).join(""));
  }

  return out.join("\n") + "\n";
}

export function renderMonth(month, images) {
  const out = [`## Bing Wallpaper (${month})`, ""];
  if (images[0]) {
    out.push(
      `![](${large(images[0].url)})Today: [${escMd(images[0].desc)}](${
        images[0].url
      })`,
      "",
    );
  }
  out.push("|      |      |      |", "| :----: | :----: | :----: |");
  for (let i = 0; i < images.length; i += 3) {
    out.push(
      images
        .slice(i, i + 3)
        .map((x) => `|![](${small(x.url)})${x.date} [download 4k](${x.url})`)
        .join("") + "|",
    );
  }
  return out.join("\n") + "\n";
}
