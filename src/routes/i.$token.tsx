import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { getInvite, submitRsvp } from "@/lib/party.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/i/$token")({
  head: () => ({
    meta: [
      { title: "Поканет си — потврди присуство" },
      {
        name: "description",
        content: "Кажи дали доаѓаш и дали одиш со своја кола или со организираниот автобус.",
      },
      { property: "og:title", content: "Поканет си — потврди присуство" },
      {
        property: "og:description",
        content: "Потврди го местото и избери превоз: своја кола или организиран автобус.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const queryClient = useQueryClient();
  const fetchInvite = useServerFn(getInvite);
  const respond = useServerFn(submitRsvp);
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["invite", token],
    queryFn: () => fetchInvite({ data: { token } }),
  });

  async function answer(guestId: string, rsvp: "yes" | "no", transport: "own" | "bus" | null) {
    setBusy(true);
    const res = await respond({ data: { token, guestId, rsvp, transport } });
    setBusy(false);
    if (!res.ok) {
      toast.error(
        res.reason === "bus_full"
          ? "Автобусот е полн — избери своја кола или прашај го организаторот за уште седишта."
          : "Нешто не е во ред.",
      );
    } else {
      toast.success("Фала! Одговорот е зачуван.");
    }
    queryClient.invalidateQueries({ queryKey: ["invite", token] });
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Поканата се вчитува…</p>
      </main>
    );
  }

  if (!data?.found) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="card-panel max-w-sm p-8 text-center">
          <h1 className="text-3xl">Поканата не е најдена</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Овој линк не е валиден. Прашај го организаторот за нов.
          </p>
        </div>
      </main>
    );
  }

  const { members, groupName, event, seatsLeft } = data;
  const isGroup = members.length > 1;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="card-panel w-full max-w-lg p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          {isGroup ? "Групна покана" : "Поканет си"}
        </p>
        <h1 className="mt-1 text-5xl text-gradient-gold">{event.title}</h1>
        <p className="mt-4 text-lg">
          {isGroup ? (
            <>
              Еј <span className="font-semibold">{groupName ?? "пријатели"}</span>, кој од вас
              доаѓа?
            </>
          ) : (
            <>
              Еј <span className="font-semibold">{members[0]!.name}</span>, доаѓаш ли?
            </>
          )}
        </p>
        {event.details && (
          <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{event.details}</p>
        )}

        <div className="mt-8 space-y-6">
          {members.map((guest) => {
            const busFull = seatsLeft <= 0 && !(guest.transport === "bus" && guest.rsvp === "yes");
            return (
              <div
                key={guest.id}
                className="rounded-xl border border-border/60 bg-background/30 p-4"
              >
                <p className="text-lg font-semibold">{guest.name}</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <Button
                    disabled={busy}
                    variant={guest.rsvp === "yes" ? "default" : "secondary"}
                    onClick={() =>
                      answer(
                        guest.id,
                        "yes",
                        guest.local ? null : guest.transport === "bus" ? "bus" : "own",
                      )
                    }
                  >
                    Да, доаѓам
                  </Button>
                  <Button
                    disabled={busy}
                    variant={guest.rsvp === "no" ? "destructive" : "secondary"}
                    onClick={() => answer(guest.id, "no", null)}
                  >
                    Не можам
                  </Button>
                </div>

                {guest.rsvp === "yes" && !guest.local && (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Како ќе патува?
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        size="sm"
                        disabled={busy}
                        variant={guest.transport === "own" ? "default" : "secondary"}
                        onClick={() => answer(guest.id, "yes", "own")}
                      >
                        Своја кола
                      </Button>
                      <Button
                        size="sm"
                        disabled={busy || busFull}
                        variant={guest.transport === "bus" ? "default" : "secondary"}
                        onClick={() => answer(guest.id, "yes", "bus")}
                      >
                        {busFull ? "Автобусот е полн" : "Организиран автобус"}
                      </Button>
                    </div>
                    {guest.transport === "bus" && guest.seat_number !== null && (
                      <p className="text-sm text-primary">
                        Седиште во автобусот: #{guest.seat_number}
                      </p>
                    )}
                    {!busFull && (
                      <p className="text-xs text-muted-foreground">Слободни седишта: {seatsLeft}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-xs text-muted-foreground">
          Одговорот може да се смени кога сакате преку истиот линк.
        </p>
      </div>
    </main>
  );
}
