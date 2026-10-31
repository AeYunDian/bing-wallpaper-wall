// 按日期去重，最新日期覆盖旧版权描述，结果按日期倒序
export function mergeLatest(list, latest) {
  const map = new Map([[latest.date, latest]]);
  for (const img of list) {
    if (img?.date && !map.has(img.date)) map.set(img.date, img);
  }
  return [...map.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function groupByMonth(images) {
  const map = new Map();
  for (const img of images) {
    const m = img.date.slice(0, 7);
    if (!map.has(m)) map.set(m, []);
    map.get(m).push(img);
  }
  return map;
}
