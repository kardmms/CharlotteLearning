'use server';
import { requireStudentAccount } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { normalizeAccessibility } from '@/lib/accessibility';

export async function saveAccessibility(value: unknown) {
  const account = await requireStudentAccount();
  const preferences = normalizeAccessibility(value);
  await prisma.studentAccount.update({ where: { id: account.id }, data: { accessibilityPreferences: preferences } });
  return preferences;
}
