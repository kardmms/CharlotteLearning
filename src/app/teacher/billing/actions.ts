"use server";

import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireTeacher } from "@/lib/auth";
import { billingEnabled, licenseKeyHash } from "@/lib/licensing";
import { stripeClient } from "@/lib/stripe";

function billingPath(message: string): never {
  redirect(`/teacher/account?error=${encodeURIComponent(message)}`);
}

export async function setTeacherLicenseKey(formData: FormData) {
  const teacher = await requireTeacher();
  if (!billingEnabled() || teacher.isShowcase) billingPath("Billing is not available.");
  const key = String(formData.get("licenseKey") || "").trim();
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(key)) billingPath("Use 8–64 letters, numbers, or hyphens for the license key.");
  try {
    await prisma.teacherLicense.upsert({
      where: { teacherId: teacher.id },
      create: { teacherId: teacher.id, keyHash: licenseKeyHash(key) },
      update: { keyHash: licenseKeyHash(key) }
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    billingPath("That license key is already in use. Choose another.");
  }
  redirect("/teacher/account?licenseSaved=1");
}

export async function startSeatCheckout(formData: FormData) {
  const teacher = await requireTeacher();
  if (!billingEnabled() || teacher.isShowcase) billingPath("Billing is not available.");
  const quantity = Number(String(formData.get("quantity") || ""));
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 5000) billingPath("Choose 1–5000 student seats.");
  const priceId = process.env.STRIPE_STUDENT_PRICE_ID;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!priceId || !siteUrl) billingPath("Stripe checkout is not configured yet.");
  const stripe = stripeClient();
  const price = await stripe.prices.retrieve(priceId);
  if (!price.active || price.unit_amount !== 1000 || price.currency !== "usd" || price.recurring?.interval !== "month" || price.recurring.interval_count !== 1 || price.recurring.usage_type !== "licensed") {
    billingPath("The configured Stripe price must be $10 per student per month.");
  }
  const license = await prisma.teacherLicense.findUnique({ where: { teacherId: teacher.id } });
  if (!license?.keyHash) billingPath("Create your license key before buying seats.");
  if (license.stripeSubscriptionId && !["canceled", "incomplete_expired"].includes(license.status)) billingPath("Manage your existing subscription to change seats.");
  if (license.checkoutSessionId) {
    const previous = await stripe.checkout.sessions.retrieve(license.checkoutSessionId);
    if (previous.status === "open" && previous.url) redirect(previous.url);
    if (previous.status === "complete" && !["canceled", "incomplete_expired"].includes(license.status)) billingPath("Your payment is being confirmed. Refresh this page shortly.");
  }
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    client_reference_id: teacher.id,
    ...(license.stripeCustomerId ? { customer: license.stripeCustomerId } : { customer_email: teacher.email }),
    line_items: [{ price: priceId, quantity }],
    subscription_data: { metadata: { teacherId: teacher.id } },
    success_url: `${siteUrl}/teacher/account?checkout=success`,
    cancel_url: `${siteUrl}/teacher/account?checkout=canceled`
  }, { idempotencyKey: `teacher-seats-${teacher.id}-${license.updatedAt.getTime()}-${quantity}` });
  if (!session.url) billingPath("Stripe could not start checkout.");
  await prisma.teacherLicense.update({ where: { teacherId: teacher.id }, data: { checkoutSessionId: session.id } });
  redirect(session.url);
}

export async function openBillingPortal() {
  const teacher = await requireTeacher();
  if (!billingEnabled() || teacher.isShowcase) billingPath("Billing is not available.");
  const license = await prisma.teacherLicense.findUnique({ where: { teacherId: teacher.id } });
  if (!license?.stripeCustomerId || !process.env.NEXT_PUBLIC_SITE_URL) billingPath("No subscription is available to manage.");
  const session = await stripeClient().billingPortal.sessions.create({
    customer: license.stripeCustomerId,
    return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/teacher/account`
  });
  redirect(session.url);
}
