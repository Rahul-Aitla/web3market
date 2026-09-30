"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { revalidatePath } from "next/cache";

const reviewSchema = z.object({
  assetId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
});

export async function addReview(raw: unknown) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");

  const input = reviewSchema.parse(raw);

  const purchase = await prisma.purchase.findUnique({
    where: {
      buyerId_assetId: { buyerId: user.userId, assetId: input.assetId },
      status: "CONFIRMED",
    },
  });
  if (!purchase) throw new Error("You can only review assets you purchased");

  try {
    await prisma.review.create({
      data: {
        userId: user.userId,
        assetId: input.assetId,
        rating: input.rating,
        comment: input.comment || null,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error("You've already reviewed this asset");
    }
    throw e;
  }

  revalidatePath("/purchases");
  return { ok: true };
}
