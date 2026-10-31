import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 项目根目录（scripts 的上一级）
export const ROOT = path.resolve(__dirname, "..");

// 把相对项目根的路径转成绝对路径
export const p = (...parts) => path.resolve(ROOT, ...parts);
