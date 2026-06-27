'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

type NewTrackerEntry = {
  date: string;
  product: string;
  quantity: number;
  credit: number;
  spent: number;
  cookies: string;
  uuid?: string;
  deliveryLink?: string | null;
};

type TrackerEntryUpdate = {
  product: string;
  quantity: number;
  credit: number;
  spent: number;
  deliveryLink?: string | null;
};

const BULK_PRODUCT = "1X (ENGLISH) CROWN ZENITH BOOSTER PACK";
const BULK_DATE = "27/06/2026";
const BULK_SPENT = 2.63;
const BULK_CREDIT = 25;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Handles saving multiple rows at once from the modal
export async function addEntries(entries: NewTrackerEntry[]) {
  try {
    console.log("Saving entries to database:", entries);
    
    // Use createMany for efficiency
    await prisma.trackerEntry.createMany({
      data: entries.map((e) => ({
        date: e.date,
        product: e.product,
        quantity: Number(e.quantity) || 1,
        credit: Number(e.credit) || 0,
        spent: Number(e.spent) || 0,
        cookies: e.cookies,
        uuid: e.uuid?.trim() || null,
        deliveryLink: e.deliveryLink || null,
        delivered: false,
      })),
    });

    // Revalidate the dashboard page to trigger a fresh data fetch from SQLite
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error("Database save error:", error);
    return { success: false, error: "Failed to save to database" };
  }
}

export async function bulkAddEntries(rawText: string) {
  const compactText = rawText.replace(/\s+/g, "");
  const compactProduct = escapeRegExp(BULK_PRODUCT.replace(/\s+/g, ""));
  const compactDate = escapeRegExp(BULK_DATE);
  const compactSpent = escapeRegExp(BULK_SPENT.toFixed(2));
  const pattern = new RegExp(
    `([0-9a-fA-F-]{36})Y?${compactProduct}${compactDate}${compactSpent}${BULK_CREDIT}`,
    "g",
  );

  const entries = Array.from(compactText.matchAll(pattern), ([, uuid]) => ({
    uuid,
    product: BULK_PRODUCT,
    date: BULK_DATE,
    spent: BULK_SPENT,
    credit: BULK_CREDIT,
    cookies: "bulk_imported",
    quantity: 1,
    deliveryLink: null,
    delivered: false,
  }));

  if (!entries.length) {
    return { success: false, error: "No matching entries found.", count: 0 };
  }

  await prisma.trackerEntry.createMany({ data: entries });
  revalidatePath('/');
  return { success: true, count: entries.length };
}

// Deletes a specific row by its unique ID
export async function deleteEntry(id: string) {
  try {
    await prisma.trackerEntry.delete({
      where: { id },
    });
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error("Delete error:", error);
    return { success: false, error: "Failed to delete entry" };
  }
}

// Toggles the delivered checkbox status
export async function toggleDelivery(id: string, currentStatus: boolean) {
  try {
    await prisma.trackerEntry.update({
      where: { id },
      data: { delivered: !currentStatus },
    });
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error("Toggle error:", error);
    return { success: false, error: "Failed to update status" };
  }
}

// Allows updating the delivery link for an existing entry
export async function updateDeliveryLink(id: string, link: string) {
  try {
    await prisma.trackerEntry.update({
      where: { id },
      data: { deliveryLink: link },
    });
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error("Update link error:", error);
    return { success: false, error: "Failed to update link" };
  }
}

export async function updateEntry(id: string, data: TrackerEntryUpdate) {
  const updateData = {
    product: data.product,
    quantity: data.quantity,
    credit: data.credit,
    spent: data.spent,
    ...("deliveryLink" in data ? { deliveryLink: data.deliveryLink?.trim() || null } : {}),
  };

  await prisma.trackerEntry.update({
    where: { id },
    data: updateData,
  });
  revalidatePath('/');
}

export async function addPremiumTopUp(amount: number) {
  await prisma.premiumCreditLog.create({ data: { amount } });
  revalidatePath('/');
}
