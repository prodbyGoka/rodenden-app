import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tokenSchema = z.object({ token: z.string().trim().min(8).max(64) });

export const unlockAdmin = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) =>
    z.object({ password: z.string().min(1).max(200) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { getSession, passwordMatches } = await import("./party.server");
    const expected = process.env["SITE_PASSWORD"];
    if (!expected) return { ok: false as const, reason: "unset" as const };
    if (!passwordMatches(data.password, expected)) {
      return { ok: false as const, reason: "wrong" as const };
    }
    const session = await getSession();
    await session.update({ unlocked: true });
    return { ok: true as const, reason: null };
  });

export const lockAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const { getSession } = await import("./party.server");
  const session = await getSession();
  await session.clear();
  return { ok: true as const };
});

export const getAdminData = createServerFn({ method: "GET" }).handler(async () => {
  const { isUnlocked, loadGuests, loadSettings, busTakenSeats } = await import("./party.server");
  if (!(await isUnlocked())) return { locked: true as const };
  const [settings, guests, taken] = await Promise.all([
    loadSettings(),
    loadGuests(),
    busTakenSeats(),
  ]);
  return { locked: false as const, settings, guests, busTaken: taken.length };
});

export const addGuest = createServerFn({ method: "POST" })
  .inputValidator((data: { name: string; tag: string }) =>
    z
      .object({
        name: z.string().trim().min(1, "Name required").max(80),
        tag: z.string().trim().min(1).max(40),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin, db } = await import("./party.server");
    await requireAdmin();
    const { error } = await db.from("guests").insert({ name: data.name, tag: data.tag });
    if (error) throw error;
    return { ok: true as const };
  });

export const addGroup = createServerFn({ method: "POST" })
  .inputValidator((data: { groupName: string; names: string[]; tag: string }) =>
    z
      .object({
        groupName: z.string().trim().min(1).max(80),
        names: z.array(z.string().trim().min(1).max(80)).min(1).max(30),
        tag: z.string().trim().min(1).max(40),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin, db } = await import("./party.server");
    await requireAdmin();
    const groupToken = crypto.randomUUID().replace(/-/g, "");
    const rows = data.names.map((name) => ({
      name,
      tag: data.tag,
      group_token: groupToken,
      group_name: data.groupName,
    }));
    const { error } = await db.from("guests").insert(rows);
    if (error) throw error;
    return { ok: true as const, groupToken };
  });

export const deleteGroup = createServerFn({ method: "POST" })
  .inputValidator((data: { groupToken: string }) =>
    z.object({ groupToken: z.string().trim().min(8).max(64) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin, db } = await import("./party.server");
    await requireAdmin();
    const { error } = await db.from("guests").delete().eq("group_token", data.groupToken);
    if (error) throw error;
    return { ok: true as const };
  });

export const deleteGuest = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin, db } = await import("./party.server");
    await requireAdmin();
    const { error } = await db.from("guests").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true as const };
  });

export const resetGuestAnswer = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin, db } = await import("./party.server");
    await requireAdmin();
    const { error } = await db
      .from("guests")
      .update({ rsvp: "pending", transport: null, seat_number: null, responded_at: null })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true as const };
  });

export const saveSettings = createServerFn({ method: "POST" })
  .inputValidator((data: { bus_seats: number; event_title: string; event_details: string }) =>
    z
      .object({
        bus_seats: z.number().int().min(0).max(500),
        event_title: z.string().trim().min(1).max(120),
        event_details: z.string().trim().max(600),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin, db } = await import("./party.server");
    await requireAdmin();
    const { error } = await db.from("event_settings").update(data).eq("id", true);
    if (error) throw error;
    return { ok: true as const };
  });

export const getInvite = createServerFn({ method: "GET" })
  .inputValidator((data: { token: string }) => tokenSchema.parse(data))
  .handler(async ({ data }) => {
    const { db, loadSettings, busTakenSeats, isLocal } = await import("./party.server");
    const { data: rows } = await db
      .from("guests")
      .select("id, name, tag, rsvp, transport, seat_number, group_token, group_name")
      .or(`token.eq.${data.token},group_token.eq.${data.token}`)
      .order("created_at", { ascending: true });
    if (!rows || rows.length === 0) return { found: false as const };
    const [settings, taken] = await Promise.all([loadSettings(), busTakenSeats()]);
    const seatsLeft = Math.max(0, settings.bus_seats - taken.length);
    const members = rows.map((g) => ({
      id: g.id as string,
      name: g.name as string,
      tag: g.tag as string,
      rsvp: g.rsvp as string,
      transport: (g.transport ?? null) as string | null,
      seat_number: (g.seat_number ?? null) as number | null,
      local: isLocal(g.tag as string),
    }));
    return {
      found: true as const,
      members,
      groupName: (rows[0]!.group_name ?? null) as string | null,
      event: { title: settings.event_title, details: settings.event_details },
      seatsLeft,
    };
  });

export const submitRsvp = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      token: string;
      guestId: string;
      rsvp: "yes" | "no";
      transport: "own" | "bus" | null;
    }) =>
      z
        .object({
          token: z.string().trim().min(8).max(64),
          guestId: z.string().uuid(),
          rsvp: z.enum(["yes", "no"]),
          transport: z.enum(["own", "bus"]).nullable(),
        })
        .parse(data),
  )
  .handler(async ({ data }) => {
    const { db, loadSettings, nextFreeSeat, isLocal } = await import("./party.server");
    const { data: guest } = await db
      .from("guests")
      .select("id, seat_number, transport, rsvp, tag, token, group_token")
      .eq("id", data.guestId)
      .maybeSingle();
    if (!guest || (guest.token !== data.token && guest.group_token !== data.token)) {
      return { ok: false as const, reason: "not_found" as const };
    }
    const local = isLocal(guest.tag as string);

    if (data.rsvp === "no") {
      await db
        .from("guests")
        .update({
          rsvp: "no",
          transport: null,
          seat_number: null,
          responded_at: new Date().toISOString(),
        })
        .eq("id", guest.id);
      return { ok: true as const, reason: null, seat: null };
    }

    if (local) {
      await db
        .from("guests")
        .update({
          rsvp: "yes",
          transport: null,
          seat_number: null,
          responded_at: new Date().toISOString(),
        })
        .eq("id", guest.id);
      return { ok: true as const, reason: null, seat: null };
    }

    if (data.transport === "bus") {
      const settings = await loadSettings();
      const keepSeat =
        guest.transport === "bus" && guest.rsvp === "yes" && guest.seat_number !== null
          ? guest.seat_number
          : null;
      const seat = keepSeat ?? (await nextFreeSeat(settings.bus_seats));
      if (seat === null) return { ok: false as const, reason: "bus_full" as const, seat: null };
      await db
        .from("guests")
        .update({
          rsvp: "yes",
          transport: "bus",
          seat_number: seat,
          responded_at: new Date().toISOString(),
        })
        .eq("id", guest.id);
      return { ok: true as const, reason: null, seat };
    }

    await db
      .from("guests")
      .update({
        rsvp: "yes",
        transport: "own",
        seat_number: null,
        responded_at: new Date().toISOString(),
      })
      .eq("id", guest.id);
    return { ok: true as const, reason: null, seat: null };
  });
