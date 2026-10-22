import { prisma } from '../models/prisma.js';

// Names for "who did it" in Amazon histories: Inventory staff (inventoryusers) or Ecom users (users).
// A missing user type means Inventory staff, as in the mapping history.
export type ActorRef = { requestedByUserId: number | null; requestedByUserType: string | null };

export const actorKey = (actor: ActorRef) =>
  actor.requestedByUserId === null ? null : `${actor.requestedByUserType ?? 'inventory'}:${actor.requestedByUserId}`;

export async function resolveActorNames(actors: ActorRef[]): Promise<Map<string, string>> {
  const ids = (type: 'inventory' | 'ecommerce') => [...new Set(actors.flatMap((actor) =>
    actor.requestedByUserId !== null && (actor.requestedByUserType ?? 'inventory') === type ? [actor.requestedByUserId] : []))];
  const [inventoryUsers, ecommerceUsers] = await Promise.all([
    ids('inventory').length
      ? prisma.inventoryusers.findMany({ where: { id: { in: ids('inventory') } }, select: { id: true, firstname: true, lastname: true } })
      : [],
    ids('ecommerce').length
      ? prisma.users.findMany({ where: { id: { in: ids('ecommerce') } }, select: { id: true, firstname: true, lastname: true } })
      : [],
  ]);
  const fullName = (user: { firstname: string | null; lastname: string | null }) =>
    [user.firstname, user.lastname].map((part) => part?.trim()).filter(Boolean).join(' ');
  const names = new Map<string, string>();
  for (const user of inventoryUsers) { const name = fullName(user); if (name) names.set(`inventory:${user.id}`, name); }
  for (const user of ecommerceUsers) { const name = fullName(user); if (name) names.set(`ecommerce:${user.id}`, name); }
  return names;
}
