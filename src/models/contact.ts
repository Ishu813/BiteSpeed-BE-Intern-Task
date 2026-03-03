import { pool } from "../db";

export type LinkPrecedence = "primary" | "secondary";

export interface Contact {
  id: number;
  phoneNumber?: string | null;
  email?: string | null;
  linkedId?: number | null; // the ID of another Contact linked to this one
  linkPrecedence: LinkPrecedence; // "primary" if it's the first Contact in the link
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface NewContactPayload {
  phoneNumber?: string | null;
  email?: string | null;
  linkedId?: number | null;
  linkPrecedence: LinkPrecedence;
}

export async function findContactsByEmailOrPhone(params: {
  email?: string;
  phoneNumber?: string;
}): Promise<Contact[]> {
  const conditions: string[] = [];
  const values: Array<string> = [];

  if (params.email) {
    values.push(params.email);
    conditions.push(`email = $${values.length}`);
  }

  if (params.phoneNumber) {
    values.push(params.phoneNumber);
    conditions.push(`"phoneNumber" = $${values.length}`);
  }

  if (conditions.length === 0) {
    return [];
  }

  const query = `
    SELECT id, "phoneNumber", email, "linkedId", "linkPrecedence", "createdAt", "updatedAt", "deletedAt"
    FROM contacts
    WHERE ${conditions.join(" OR ")}
  `;

  const result = await pool.query(query, values);
  return result.rows as Contact[];
}

// export async function findContactsByIds(ids: number[]): Promise<Contact[]> {
//   if (ids.length === 0) {
//     return [];
//   }

//   const result = await pool.query(
//     `
//       SELECT id, "phoneNumber", email, "linkedId", "linkPrecedence", "createdAt", "updatedAt", "deletedAt"
//       FROM contacts
//       WHERE id = ANY($1::int[])
//     `,
//     [ids],
//   );

//   return result.rows as Contact[];
// }

export async function findContactById(id: number): Promise<Contact | null> {
  const result = await pool.query(
    `
      SELECT id, "phoneNumber", email, "linkedId", "linkPrecedence", "createdAt", "updatedAt", "deletedAt"
      FROM contacts
      WHERE id = $1
    `,
    [id],
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0] as Contact;
}

export async function findContactsByLinkedId(
  linkedId: number,
): Promise<Contact[]> {
  const result = await pool.query(
    `
      SELECT id, "phoneNumber", email, "linkedId", "linkPrecedence", "createdAt", "updatedAt", "deletedAt"
      FROM contacts
      WHERE "linkedId" = $1
    `,
    [linkedId],
  );

  return result.rows as Contact[];
}

export async function createContact(
  payload: NewContactPayload,
): Promise<Contact> {
  const result = await pool.query(
    `
      INSERT INTO contacts ("phoneNumber", email, "linkedId", "linkPrecedence")
      VALUES ($1, $2, $3, $4)
      RETURNING id, "phoneNumber", email, "linkedId", "linkPrecedence", "createdAt", "updatedAt", "deletedAt"
    `,
    [
      payload.phoneNumber ?? null,
      payload.email ?? null,
      payload.linkedId ?? null,
      payload.linkPrecedence,
    ],
  );

  return result.rows[0] as Contact;
}

export async function updateContactToSecondary(params: {
  primaryId: number;
  secondaryId: number;
}): Promise<void> {
  const { primaryId, secondaryId } = params;

  await pool.query(
    `
      UPDATE contacts
      SET "linkPrecedence" = 'secondary',
          "linkedId" = $1,
          "updatedAt" = NOW()
      WHERE id = $2
    `,
    [primaryId, secondaryId],
  );
}
