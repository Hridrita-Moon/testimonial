import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const spaces = await p.space.findMany({ select: { publicSlug: true, title: true } });
console.log("All spaces in DB:");
for (const s of spaces) console.log("  ", s.publicSlug, "·", s.title);
const a = await p.space.findUnique({ where: { publicSlug: "agentic-engineering" }, select: { publicSlug: true } });
console.log("\nagentic-engineering exists?", a !== null);
await p.$disconnect();