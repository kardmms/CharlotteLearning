import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { stripeClient } from "@/lib/stripe";

export const dynamic = "force-dynamic";

async function syncSubscription(subscription: Stripe.Subscription) {
  const priceId = process.env.STRIPE_STUDENT_PRICE_ID;
  const item = subscription.items.data.find((entry) => entry.price.id === priceId);
  const existing = await prisma.teacherLicense.findUnique({
    where: { stripeSubscriptionId: subscription.id }
  });
  if (!item && !existing) return;
  const teacherId = existing?.teacherId || subscription.metadata.teacherId;
  if (!teacherId || !(await prisma.teacher.findUnique({ where: { id: teacherId }, select: { id: true } }))) return;
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const current = await prisma.teacherLicense.findUnique({ where: { teacherId } });
  if (current?.stripeSubscriptionId && current.stripeSubscriptionId !== subscription.id && current.status === "active") {
    return;
  }
  const seats = item?.quantity || 0;
  await prisma.$transaction(async (transaction) => {
    await transaction.teacherLicense.upsert({
      where: { teacherId },
      create: { teacherId, stripeCustomerId: customerId, stripeSubscriptionId: subscription.id, status: item ? subscription.status : "inactive", seats },
      update: { stripeCustomerId: customerId, stripeSubscriptionId: subscription.id, status: item ? subscription.status : "inactive", seats }
    });
    const redemptions = await transaction.studentLicense.findMany({
      where: { teacherId }, orderBy: [{ createdAt: "asc" }, { accountId: "asc" }], select: { accountId: true }
    });
    await transaction.studentLicense.updateMany({ where: { teacherId }, data: { active: false } });
    await transaction.studentLicense.updateMany({
      where: { teacherId, accountId: { in: redemptions.slice(0, seats).map((row) => row.accountId) } },
      data: { active: true }
    });
  });
}

export async function POST(request: Request) {
  if (!process.env.STRIPE_WEBHOOK_SECRET || !process.env.STRIPE_SECRET_KEY) {
    return new Response("Stripe is not configured", { status: 503 });
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });
  let event: Stripe.Event;
  const stripe = stripeClient();
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
    if (subscriptionId) await syncSubscription(await stripe.subscriptions.retrieve(subscriptionId));
  } else if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    await syncSubscription(await stripe.subscriptions.retrieve(event.data.object.id));
  }
  return new Response("ok");
}
