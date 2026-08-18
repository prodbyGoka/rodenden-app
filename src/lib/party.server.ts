import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const LOCAL_TAG = "Родно место";
export const TAGS = [LOCAL_TAG, "Од Скопје", "Не од Скопје"] as const;

export function isLocal(tag: string): boolean {
  return tag === LOCAL_TAG;
}

function sessionConfig() {
  return {
    password: process.env["SESSION_SECRET"]!,
    name: "party-admin",
    maxAge: 60 * 60 * 24 * 14,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

type AdminSession = { unlocked?: boolean };

export function passwordMatches(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export async function getSession() {
  return useSession<AdminSession>(sessionConfig());
}


export async function isUnlocked(): Promise<boolean> {
  const session = await getSession();
  return session.data.unlocked === true;
}

export async function requireAdmin() {
  if (!(await isUnlocked())) throw new Error("LOCKED");
}

export const db = supabaseAdmin;

export type Guest = {
  id: string;
  name: string;
  tag: string;
  token: string;
  rsvp: string;
  transport: string | null;
  seat_number: number | null;
  group_token: string | null;
  group_name: string | null;
  created_at: string;
  responded_at: string | null;
};

export type Settings = {
  bus_seats: number;
  event_title: string;
  event_details: string;
};

export async function loadSettings(): Promise<Settings> {
  const { data, error } = await db
    .from("event_settings")
    .select("bus_seats, event_title, event_details")
    .eq("id", true)
    .single();
  if (error) throw error;
  return data as Settings;
}

export async function loadGuests(): Promise<Guest[]> {
  const { data, error } = await db
    .from("guests")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Guest[];
}

export async function busTakenSeats(): Promise<number[]> {
  const { data, error } = await db
    .from("guests")
    .select("seat_number")
    .eq("rsvp", "yes")
    .eq("transport", "bus")
    .not("seat_number", "is", null);
  if (error) throw error;
  return (data ?? []).map((r) => r.seat_number as number);
}

export async function nextFreeSeat(busSeats: number): Promise<number | null> {
  const taken = new Set(await busTakenSeats());
  for (let seat = 1; seat <= busSeats; seat++) {
    if (!taken.has(seat)) return seat;
  }
  return null;
}
