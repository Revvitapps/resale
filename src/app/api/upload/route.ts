import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

const sanitize = (name: string) => name.replace(/[^a-z0-9.\-]+/gi, "_");

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const filename = `${Date.now()}-${sanitize(file.name)}`;
    const blobPath = `uploads/${filename}`;

    const { url } = await put(blobPath, file, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return NextResponse.json({ ok: true, url, name: file.name });
  } catch (error) {
    console.error("Upload failed", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
