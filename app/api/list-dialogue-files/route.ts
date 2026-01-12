import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  const dialogueDir = path.join(process.cwd(), "data", "raw_dialogue");

  if (!fs.existsSync(dialogueDir)) {
    return NextResponse.json({ ok: true, files: [] });
  }

  const files = fs.readdirSync(dialogueDir)
    .filter(file => file.endsWith('.txt'))
    .sort();

  return NextResponse.json({ ok: true, files });
}
