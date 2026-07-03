import { readFile } from "node:fs/promises";
import path from "node:path";

let cachedHomePhotoSrc: string | null = null;

export async function getHomePhotoSrc(): Promise<string> {
  if (cachedHomePhotoSrc) return cachedHomePhotoSrc;

  const photoPath = path.join(process.cwd(), "public", "images", "home-dog.png");
  const photo = await readFile(photoPath);
  cachedHomePhotoSrc = `data:image/png;base64,${photo.toString("base64")}`;

  return cachedHomePhotoSrc;
}
