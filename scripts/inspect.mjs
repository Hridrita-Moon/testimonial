import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const t = await p.testimonial.findMany({
  where: { space: { publicSlug: "product-hunt-reviews" } },
  select: {
    contributorName: true,
    isWallOfLove: true,
    visibilityStatus: true,
    additionalValues: true,
  },
});
console.log(JSON.stringify(t, null, 2));
await p.$disconnect();
