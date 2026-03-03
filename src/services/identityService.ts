import {
  Contact,
  createContact,
  findContactById,
  findContactsByEmailOrPhone,
  findContactsByLinkedId,
  updateContactToSecondary,
} from "../models/contact";

export interface IdentifyInput {
  email?: string;
  phoneNumber?: string;
}

export interface ContactSummary {
  primaryContactId: number;
  emails: string[];
  phoneNumbers: string[];
  secondaryContactIds: number[];
}

async function getAllMatchingContacts(
  seedContacts: Contact[],
): Promise<Contact[]> {
  const byId = new Map<number, Contact>();
  const queue: Contact[] = [];

  for (const contact of seedContacts) {
    if (!byId.has(contact.id)) {
      byId.set(contact.id, contact);
      queue.push(contact);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift() as Contact;

    const children = await findContactsByLinkedId(current.id);
    for (const child of children) {
      if (!byId.has(child.id)) {
        byId.set(child.id, child);
        queue.push(child);
      }
    }

    if (current.linkedId != null) {
      const parent = await findContactById(current.linkedId);
      if (parent && !byId.has(parent.id)) {
        byId.set(parent.id, parent);
        queue.push(parent);
      }
    }
  }

  return Array.from(byId.values());
}

function pickPrimary(contacts: Contact[]): Contact {
  if (contacts.length === 0) {
    throw new Error("Cannot pick primary from empty contacts list");
  }

  const contact = contacts.filter(
    (contact) => contact.linkPrecedence === "primary",
  );

  return contact.length == 0 ? contacts[0] : contact[0];
}

function summarizeContacts(
  primary: Contact,
  contacts: Contact[],
): ContactSummary {
  const emails: string[] = [];
  const emailSet = new Set<string>();

  const phoneNumbers: string[] = [];
  const phoneSet = new Set<string>();

  const secondaryContactIds: number[] = [];

  if (primary.email) {
    emails.push(primary.email);
    emailSet.add(primary.email);
  }

  if (primary.phoneNumber) {
    phoneNumbers.push(primary.phoneNumber);
    phoneSet.add(primary.phoneNumber);
  }

  for (const contact of contacts) {
    if (contact.id === primary.id) {
      continue;
    }

    if (contact.email && !emailSet.has(contact.email)) {
      emails.push(contact.email);
      emailSet.add(contact.email);
    }

    if (contact.phoneNumber && !phoneSet.has(contact.phoneNumber)) {
      phoneNumbers.push(contact.phoneNumber);
      phoneSet.add(contact.phoneNumber);
    }

    secondaryContactIds.push(contact.id);
  }

  return {
    primaryContactId: primary.id,
    emails,
    phoneNumbers,
    secondaryContactIds,
  };
}

export async function identifyOrCreateContact(
  input: IdentifyInput,
): Promise<ContactSummary> {
  const { email, phoneNumber } = input;

  if (!email && !phoneNumber) {
    throw new Error("Either email or phoneNumber must be provided");
  }

  const existingByInfo = await findContactsByEmailOrPhone({
    email,
    phoneNumber,
  });

  if (existingByInfo.length === 0) {
    const primary = await createContact({
      email: email ?? null,
      phoneNumber: phoneNumber ?? null,
      linkedId: null,
      linkPrecedence: "primary",
    });

    return summarizeContacts(primary, []);
  }

  const allContacts = await getAllMatchingContacts(existingByInfo);
  const primary = pickPrimary(allContacts);

  const primaryId = primary.id;

  const contactsToUpdate: Contact[] = [];

  for (const contact of allContacts) {
    if (contact.id === primaryId) {
      continue;
    }

    if (contact.linkPrecedence === "primary") {
      contactsToUpdate.push(contact);
    }
  }

  for (const contact of contactsToUpdate) {
    await updateContactToSecondary({
      primaryId,
      secondaryId: contact.id,
    });
    contact.linkPrecedence = "secondary";
    contact.linkedId = primaryId;
  }

  const emailsInGroup = new Set(
    allContacts
      .map((c) => c.email)
      .filter((value): value is string => typeof value === "string"),
  );

  const phonesInGroup = new Set(
    allContacts
      .map((c) => c.phoneNumber)
      .filter((value): value is string => typeof value === "string"),
  );

  let newSecondary: Contact | null = null;

  const hasNewEmail = !!email && !emailsInGroup.has(email);
  const hasNewPhone = !!phoneNumber && !phonesInGroup.has(phoneNumber);

  if (hasNewEmail || hasNewPhone) {
    newSecondary = await createContact({
      email: email ?? null,
      phoneNumber: phoneNumber ?? null,
      linkedId: primaryId,
      linkPrecedence: "secondary",
    });

    allContacts.push(newSecondary);
  }

  return summarizeContacts(
    primary,
    allContacts.filter((c) => c.id !== primaryId),
  );
}
