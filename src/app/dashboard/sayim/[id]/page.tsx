import { db } from "@/db";
import { blindCounts, blindCountItems, products, categories, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import BlindCountDetailPageClient from "@/components/BlindCountDetailPageClient";

export const dynamic = "force-dynamic";

export default async function BlindCountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const countObj = await db
    .select()
    .from(blindCounts)
    .where(eq(blindCounts.id, id))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!countObj) {
    redirect("/dashboard");
  }

  const category = await db
    .select()
    .from(categories)
    .where(eq(categories.id, countObj.categoryId ?? ""))
    .limit(1)
    .then((r) => r[0] ?? null);

  const starter = await db
    .select()
    .from(users)
    .where(eq(users.id, countObj.startedBy))
    .limit(1)
    .then((r) => r[0] ?? null);

  const items = await db
    .select({
      id: blindCountItems.id,
      productId: blindCountItems.productId,
      countedQty: blindCountItems.countedQty,
      previousQty: blindCountItems.previousQty,
      difference: blindCountItems.difference,
      productName: products.name,
      productUnit: products.unit,
    })
    .from(blindCountItems)
    .innerJoin(products, eq(blindCountItems.productId, products.id))
    .where(eq(blindCountItems.blindCountId, id))
    .orderBy(products.name);

  return (
    <BlindCountDetailPageClient
      countObj={countObj}
      category={category}
      starter={starter}
      items={items}
      session={session}
    />
  );
}
