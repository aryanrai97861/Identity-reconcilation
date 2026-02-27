import prisma from "../db/prisma";
import { Contact, LinkPrecedence } from "@prisma/client";

interface IdentifyRequest {
  email?: string | null;
  phoneNumber?: string | null;
}

interface IdentifyResponse {
  contact: {
    primaryContatctId: number;
    emails: string[];
    phoneNumbers: string[];
    secondaryContactIds: number[];
  };
}

/**
 * Given the primary contact's ID, fetch all contacts in the group
 * (the primary + all its secondaries) and build the consolidated response.
 */
async function buildConsolidatedResponse(
  primaryId: number
): Promise<IdentifyResponse> {
  const primary = await prisma.contact.findUnique({ where: { id: primaryId } });
  if (!primary) throw new Error("Primary contact not found");

  const secondaries = await prisma.contact.findMany({
    where: { linkedId: primaryId },
    orderBy: { createdAt: "asc" },
  });

  const emails: string[] = [];
  const phoneNumbers: string[] = [];
  const secondaryContactIds: number[] = [];

  // Primary first
  if (primary.email) emails.push(primary.email);
  if (primary.phoneNumber) phoneNumbers.push(primary.phoneNumber);

  // Then secondaries
  for (const sec of secondaries) {
    if (sec.email && !emails.includes(sec.email)) emails.push(sec.email);
    if (sec.phoneNumber && !phoneNumbers.includes(sec.phoneNumber))
      phoneNumbers.push(sec.phoneNumber);
    secondaryContactIds.push(sec.id);
  }

  return {
    contact: {
      primaryContatctId: primary.id,
      emails,
      phoneNumbers,
      secondaryContactIds,
    },
  };
}

/**
 * Find the root primary contact for a given contact.
 * Follows the linkedId chain up to the root.
 */
async function findPrimaryContact(contact: Contact): Promise<Contact> {
  let current = contact;
  while (current.linkedId !== null) {
    const parent = await prisma.contact.findUnique({
      where: { id: current.linkedId },
    });
    if (!parent) break;
    current = parent;
  }
  return current;
}

/**
 * Core identity reconciliation logic.
 */
export async function identifyContact(
  request: IdentifyRequest
): Promise<IdentifyResponse> {
  const { email, phoneNumber } = request;

  // Validate: at least one of email or phoneNumber must be provided
  if (!email && !phoneNumber) {
    throw new Error("At least one of email or phoneNumber must be provided");
  }

  // Convert phoneNumber to string if it comes as a number
  const phone = phoneNumber ? String(phoneNumber) : null;
  const mail = email || null;

  // Step 1: Find all existing contacts matching email OR phoneNumber
  const conditions: any[] = [];
  if (mail) conditions.push({ email: mail });
  if (phone) conditions.push({ phoneNumber: phone });

  const matchingContacts = await prisma.contact.findMany({
    where: { OR: conditions },
  });

  // Step 2: No matches — create a new primary contact
  if (matchingContacts.length === 0) {
    const newContact = await prisma.contact.create({
      data: {
        email: mail,
        phoneNumber: phone,
        linkPrecedence: LinkPrecedence.primary,
      },
    });
    return buildConsolidatedResponse(newContact.id);
  }

  // Step 3: Find all unique primary contacts in the matched set
  const primaryContactsMap = new Map<number, Contact>();
  for (const contact of matchingContacts) {
    const primary = await findPrimaryContact(contact);
    primaryContactsMap.set(primary.id, primary);
  }

  const primaryContacts = Array.from(primaryContactsMap.values());

  // Step 4: If matches span two different primaries, merge them
  if (primaryContacts.length > 1) {
    // Sort by createdAt — oldest stays primary
    primaryContacts.sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );
    const olderPrimary = primaryContacts[0];
    const newerPrimary = primaryContacts[1];

    // Turn the newer primary into a secondary of the older primary
    await prisma.contact.update({
      where: { id: newerPrimary.id },
      data: {
        linkedId: olderPrimary.id,
        linkPrecedence: LinkPrecedence.secondary,
      },
    });

    // Re-link all secondaries of the newer primary to the older primary
    await prisma.contact.updateMany({
      where: { linkedId: newerPrimary.id },
      data: { linkedId: olderPrimary.id },
    });

    return buildConsolidatedResponse(olderPrimary.id);
  }

  // Step 5: All matches belong to one primary
  const thePrimary = primaryContacts[0];

  // Gather all contacts in this group to check if new info exists
  const allGroupContacts = await prisma.contact.findMany({
    where: {
      OR: [{ id: thePrimary.id }, { linkedId: thePrimary.id }],
    },
  });

  const existingEmails = new Set(
    allGroupContacts.map((c) => c.email).filter(Boolean)
  );
  const existingPhones = new Set(
    allGroupContacts.map((c) => c.phoneNumber).filter(Boolean)
  );

  const hasNewEmail = mail && !existingEmails.has(mail);
  const hasNewPhone = phone && !existingPhones.has(phone);

  // If the request introduces new information, create a secondary contact
  if (hasNewEmail || hasNewPhone) {
    await prisma.contact.create({
      data: {
        email: mail,
        phoneNumber: phone,
        linkedId: thePrimary.id,
        linkPrecedence: LinkPrecedence.secondary,
      },
    });
  }

  return buildConsolidatedResponse(thePrimary.id);
}
