import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const sanitize = (name: string) => name.replace(/[^a-z0-9.\\-]+/gi, "_");

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadsDir, { recursive: true });
    const filename = `${Date.now()}-${sanitize(file.name)}`;
    const destination = path.join(uploadsDir, filename);
    await fs.writeFile(destination, buffer);

    return NextResponse.json({ ok: true, url: `/uploads/${filename}`, name: file.name });
  } catch (error) {
    console.error("Upload failed", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
