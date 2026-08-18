import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import {
  addGroup,
  addGuest,
  deleteGroup,
  deleteGuest,
  getAdminData,
  lockAdmin,
  resetGuestAnswer,
  saveSettings,
  unlockAdmin,
} from "@/lib/party.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const LOCAL_TAG = "Родно место";
const TAGS = [LOCAL_TAG, "Од Скопје", "Не од Скопје"];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Организатор на роденден — листа на гости" },
      {
        name: "description",
        content:
          "Приватен панел: додавај гости, сподели лични линкови и следи кој доаѓа со кола или со автобус.",
      },
      { property: "og:title", content: "Организатор на роденден — листа на гости" },
      {
        property: "og:description",
        content: "Додавај гости, испраќај лични линкови и следи седишта во автобусот.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const queryClient = useQueryClient();
  const fetchData = useServerFn(getAdminData);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-data"],
    queryFn: () => fetchData(),
  });

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Се вчитува…</p>
      </main>
    );
  }

  if (!data || data.locked) {
    return <UnlockCard onUnlocked={() => queryClient.invalidateQueries({ queryKey: ["admin-data"] })} />;
  }

  return <Dashboard data={data} />;
}

function UnlockCard({ onUnlocked }: { onUnlocked: () => void }) {
  const unlock = useServerFn(unlockAdmin);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await unlock({ data: { password } });
    setBusy(false);
    if (res.ok) {
      onUnlocked();
      return;
    }
    toast.error(
      res.reason === "unset" ? "Сè уште не е поставена лозинка." : "Грешна лозинка, обиди се повторно.",
    );
    setPassword("");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="card-panel w-full max-w-sm space-y-5 p-8">
        <div className="space-y-1 text-center">
          <h1 className="text-4xl text-gradient-gold">Само за организаторот</h1>
          <p className="text-sm text-muted-foreground">
            Внеси лозинка за да управуваш со листата на гости.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Лозинка</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            maxLength={200}
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy || password.length === 0}>
          {busy ? "Проверувам…" : "Отклучи"}
        </Button>
      </form>
    </main>
  );
}

type AdminData = Extract<Awaited<ReturnType<typeof getAdminData>>, { locked: false }>;

function Dashboard({ data }: { data: AdminData }) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-data"] });

  const add = useServerFn(addGuest);
  const addGroupFn = useServerFn(addGroup);
  const removeGroup = useServerFn(deleteGroup);
  const remove = useServerFn(deleteGuest);
  const reset = useServerFn(resetGuestAnswer);
  const save = useServerFn(saveSettings);
  const lock = useServerFn(lockAdmin);

  const [name, setName] = useState("");
  const [tag, setTag] = useState(TAGS[0]!);
  const [groupName, setGroupName] = useState("");
  const [groupTag, setGroupTag] = useState(TAGS[1]!);
  const [groupNames, setGroupNames] = useState("");
  const [seats, setSeats] = useState(String(data.settings.bus_seats));
  const [title, setTitle] = useState(data.settings.event_title);
  const [details, setDetails] = useState(data.settings.event_details);

  const addMutation = useMutation({
    mutationFn: (input: { name: string; tag: string }) => add({ data: input }),
    onSuccess: () => {
      setName("");
      toast.success("Гостинот е додаден");
      refresh();
    },
    onError: () => toast.error("Не успеа додавањето"),
  });

  const groupMutation = useMutation({
    mutationFn: (input: { groupName: string; names: string[]; tag: string }) =>
      addGroupFn({ data: input }),
    onSuccess: () => {
      setGroupName("");
      setGroupNames("");
      toast.success("Групата е додадена");
      refresh();
    },
    onError: () => toast.error("Не успеа додавањето на групата"),
  });

  const settingsMutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          bus_seats: Number(seats) || 0,
          event_title: title.trim() || "Мојот роденден",
          event_details: details,
        },
      }),
    onSuccess: () => {
      toast.success("Зачувано");
      refresh();
    },
    onError: () => toast.error("Не успеа зачувувањето"),
  });

  const coming = data.guests.filter((g) => g.rsvp === "yes");
  const notComing = data.guests.filter((g) => g.rsvp === "no");
  const pending = data.guests.filter((g) => g.rsvp === "pending");
  const byBus = coming.filter((g) => g.transport === "bus");
  const byCar = coming.filter((g) => g.transport === "own");
  const seatsLeft = Math.max(0, data.settings.bus_seats - data.busTaken);

  function copyLink(token: string) {
    const url = `${window.location.origin}/i/${token}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success("Линкот е копиран"),
      () => toast.error("Копирањето не успеа — линк: " + url),
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Панел на организаторот
          </p>
          <h1 className="text-5xl text-gradient-gold">{data.settings.event_title}</h1>
        </div>
        <Button
          variant="outline"
          onClick={async () => {
            await lock({});
            refresh();
          }}
        >
          Заклучи панел
        </Button>
      </header>

      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Поканети" value={data.guests.length} />
        <Stat label="Доаѓаат" value={coming.length} />
        <Stat label="Не доаѓаат" value={notComing.length} />
        <Stat label="Без одговор" value={pending.length} />
        <Stat label="Слободни седишта" value={seatsLeft} highlight />
      </section>

      <section className="card-panel mb-6 p-6">
        <h2 className="mb-4 text-2xl">Додај гостин</h2>
        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            addMutation.mutate({ name: name.trim(), tag });
          }}
        >
          <Input
            placeholder="Име на гостинот"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            className="sm:flex-1"
          />
          <Select value={tag} onValueChange={setTag}>
            <SelectTrigger className="sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TAGS.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" disabled={addMutation.isPending}>
            Додај
          </Button>
        </form>
      </section>

      <section className="card-panel mb-6 p-6">
        <h2 className="mb-1 text-2xl">Групна покана</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Еден линк за цело семејство или друштво — секој член одговара за себе на истата
          страница.
        </p>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const names = groupNames
              .split(/[\n,]/)
              .map((n) => n.trim())
              .filter(Boolean);
            if (!groupName.trim() || names.length === 0) return;
            groupMutation.mutate({ groupName: groupName.trim(), names, tag: groupTag });
          }}
        >
          <Input
            placeholder="Име на групата (пр. Фамилија Петрови)"
            value={groupName}
            maxLength={80}
            onChange={(e) => setGroupName(e.target.value)}
          />
          <Select value={groupTag} onValueChange={setGroupTag}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TAGS.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            className="sm:col-span-2"
            rows={3}
            placeholder="Имена на членовите — по едно во ред"
            value={groupNames}
            onChange={(e) => setGroupNames(e.target.value)}
          />
          <div className="sm:col-span-2">
            <Button type="submit" disabled={groupMutation.isPending}>
              Додај група
            </Button>
          </div>
        </form>
      </section>

      <section className="card-panel mb-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-6 py-4">
          <h2 className="text-2xl">Листа на гости</h2>
          <p className="text-sm text-muted-foreground">
            Автобус: {byBus.length} · Своја кола: {byCar.length}
          </p>
        </div>
        {data.guests.length === 0 ? (
          <p className="px-6 py-10 text-center text-muted-foreground">
            Сè уште нема гости — додај го првиот погоре.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {data.guests.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center gap-3 px-6 py-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{g.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {g.tag}
                    {g.group_name ? ` · група: ${g.group_name}` : ""}
                  </p>
                </div>
                <RsvpBadge rsvp={g.rsvp} />
                {g.rsvp === "yes" && g.tag !== LOCAL_TAG && (
                  <Badge variant="outline">
                    {g.transport === "bus" ? `Автобус · седиште ${g.seat_number}` : "Своја кола"}
                  </Badge>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => copyLink(g.group_token ?? g.token)}
                  >
                    {g.group_token ? "Копирај групен линк" : "Копирај линк"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await reset({ data: { id: g.id } });
                      refresh();
                    }}
                  >
                    Ресетирај
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (g.group_token) {
                        await removeGroup({ data: { groupToken: g.group_token } });
                      } else {
                        await remove({ data: { id: g.id } });
                      }
                      refresh();
                    }}
                  >
                    {g.group_token ? "Избриши група" : "Избриши"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card-panel p-6">
        <h2 className="mb-4 text-2xl">Поставки за забавата и автобусот</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="title">Наслов на забавата</Label>
            <Input id="title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="seats">Седишта во автобусот (вкупно)</Label>
            <Input
              id="seats"
              type="number"
              min={0}
              max={500}
              value={seats}
              onChange={(e) => setSeats(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Зголеми го бројот кога ќе ти треба повеќе место. Кога сите седишта се зафатени,
              гостите можат да изберат само своја кола.
            </p>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="details">Детали што ќе ги видат гостите</Label>
            <Textarea
              id="details"
              rows={3}
              maxLength={600}
              value={details}
              placeholder="Датум, место, време, каде тргнува автобусот…"
              onChange={(e) => setDetails(e.target.value)}
            />
          </div>
        </div>
        <Button className="mt-4" onClick={() => settingsMutation.mutate()} disabled={settingsMutation.isPending}>
          Зачувај поставки
        </Button>
      </section>
    </main>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="card-panel px-4 py-3">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-3xl font-display ${highlight ? "text-gradient-gold" : ""}`}>{value}</p>
    </div>
  );
}

function RsvpBadge({ rsvp }: { rsvp: string }) {
  if (rsvp === "yes") return <Badge className="bg-primary text-primary-foreground">Доаѓа</Badge>;
  if (rsvp === "no") return <Badge variant="destructive">Не доаѓа</Badge>;
  return <Badge variant="secondary">Чека</Badge>;
}
