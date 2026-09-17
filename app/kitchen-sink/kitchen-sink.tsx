"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { es } from "@/lib/i18n/es";

const t = es.dev.kitchenSink;

/* Las clases van completas para que Tailwind las detecte. */
const swatches: { name: string; className: string }[] = [
  { name: "background", className: "bg-background" },
  { name: "background-deep", className: "bg-background-deep" },
  { name: "surface", className: "bg-surface" },
  { name: "surface-raised", className: "bg-surface-raised" },
  { name: "surface-overlay", className: "bg-surface-overlay" },
  { name: "border", className: "bg-border" },
  { name: "border-strong", className: "bg-border-strong" },
  { name: "border-subtle", className: "bg-border-subtle" },
  { name: "border-emphasis", className: "bg-border-emphasis" },
  { name: "text-primary", className: "bg-text-primary" },
  { name: "text-muted", className: "bg-text-muted" },
  { name: "text-subtle", className: "bg-text-subtle" },
  { name: "text-disabled", className: "bg-text-disabled" },
  { name: "accent", className: "bg-accent" },
  { name: "accent-hover", className: "bg-accent-hover" },
  { name: "accent-bright", className: "bg-accent-bright" },
  { name: "accent-emphasis", className: "bg-accent-emphasis" },
  { name: "accent-soft", className: "bg-accent-soft" },
  { name: "accent-outline", className: "bg-accent-outline" },
  { name: "accent-strong", className: "bg-accent-strong" },
  { name: "on-accent", className: "bg-on-accent" },
  { name: "success", className: "bg-success" },
  { name: "success-soft", className: "bg-success-soft" },
  { name: "danger", className: "bg-danger" },
  { name: "danger-soft", className: "bg-danger-soft" },
];

const typeScale: { name: string; className: string; sample: string }[] = [
  {
    name: "hero · 76",
    className: "font-display text-hero font-bold uppercase",
    sample: "Se mide.",
  },
  {
    name: "display-xl · 44",
    className: "font-display text-display-xl font-bold uppercase",
    sample: "Hipertrofia — Torso / Pierna",
  },
  {
    name: "display-lg · 40 (page-title)",
    className: "page-title",
    sample: "Panel de control",
  },
  {
    name: "display-md · 26",
    className: "font-display text-display-md font-semibold tracking-[1px] uppercase",
    sample: "Entrar",
  },
  {
    name: "display-sm · 20",
    className: "font-display text-display-sm font-semibold uppercase",
    sample: "Sentadilla trasera",
  },
  { name: "section-title · 15", className: "section-title", sample: "Revisiones recibidas" },
  {
    name: "lg · 17",
    className: "text-lg text-text-muted",
    sample: "Rutina, dieta y revisiones en un solo sitio.",
  },
  {
    name: "base · 15",
    className: "text-base",
    sample: "Barra apoyada en trapecio, bajada controlada.",
  },
  {
    name: "sm · 13",
    className: "text-sm text-text-muted",
    sample: "4 series · 6-8 reps · RIR 2 · descanso 3 min",
  },
  { name: "eyebrow · 12", className: "eyebrow", sample: "Viernes, 29 agosto" },
  {
    name: "xs · 11",
    className: "text-xs tracking-label text-success uppercase",
    sample: "Completa ✓",
  },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-5">
      <h2 className="section-title">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-text-subtle w-28 shrink-0 text-xs">{label}</span>
      {children}
    </div>
  );
}

export function KitchenSink() {
  return (
    <TooltipProvider>
      <main className="mx-auto flex max-w-6xl flex-col gap-14 px-10 py-12">
        <header>
          <div className="eyebrow">{t.eyebrow}</div>
          <h1 className="page-title mt-1">{t.title}</h1>
        </header>

        <Section title={t.palette}>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-7">
            {swatches.map((s) => (
              <div key={s.name} className="flex flex-col gap-2">
                <div className={`border-border-subtle h-14 rounded-lg border ${s.className}`} />
                <span className="text-text-muted text-xs">{s.name}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title={t.typography}>
          <div className="flex flex-col gap-6">
            {typeScale.map((row) => (
              <div key={row.name} className="grid grid-cols-[180px_1fr] items-baseline gap-6">
                <span className="text-text-subtle text-xs">{row.name}</span>
                <span className={row.className}>{row.sample}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title={t.buttons}>
          <Row label="variant">
            <Button>+ Nuevo cliente</Button>
            <Button variant="outline">Editar plan</Button>
            <Button variant="secondary">Todos</Button>
            <Button variant="ghost">Cancelar</Button>
            <Button variant="destructive">Eliminar</Button>
            <Button variant="link">Ver todas →</Button>
            <Button variant="pill">Registrar ▾</Button>
          </Row>
          <Row label="size">
            <Button size="sm">Guardar</Button>
            <Button>Guardar</Button>
            <Button size="lg">Continuar</Button>
            <Button disabled>Deshabilitado</Button>
          </Row>
        </Section>

        <Section title={t.badges}>
          <Row label="variant">
            <Badge>Nueva</Badge>
            <Badge variant="outline">Parcial</Badge>
            <Badge variant="success">
              <span className="bg-success size-2 rounded-full" />
              Pagada
            </Badge>
            <Badge variant="destructive">
              <span className="bg-danger size-2 rounded-full" />
              No pagada
            </Badge>
            <Badge variant="secondary">Rutina</Badge>
            <Badge variant="ghost">Inactiva</Badge>
          </Row>
        </Section>

        <Section title={t.forms}>
          <div className="grid max-w-xl grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ks-email">Email</Label>
              <Input id="ks-email" placeholder="tu@email.com" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ks-pass">Contraseña</Label>
              <Input id="ks-pass" type="password" placeholder="••••••••" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ks-group">Grupo</Label>
              <Select defaultValue="pierna">
                <SelectTrigger id="ks-group" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pierna">Pierna</SelectItem>
                  <SelectItem value="empuje">Empuje</SelectItem>
                  <SelectItem value="traccion">Tracción</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ks-invalid">Con error</Label>
              <Input id="ks-invalid" aria-invalid defaultValue="63,4" />
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="ks-desc">Descripción / técnica</Label>
              <Textarea
                id="ks-desc"
                defaultValue="Barra apoyada en trapecio, bajada controlada hasta romper paralela."
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch id="ks-switch" defaultChecked />
              <Label htmlFor="ks-switch">Sugerido</Label>
            </div>
          </div>
        </Section>

        <Section title={t.tabs}>
          <Row label="underline">
            <Tabs defaultValue="rutina" className="w-full">
              <TabsList>
                <TabsTrigger value="rutina">Rutina</TabsTrigger>
                <TabsTrigger value="menu">Menú</TabsTrigger>
              </TabsList>
              <TabsContent value="rutina" className="text-text-muted text-sm">
                La rutina se organiza por días numéricos (Día 1, Día 2…)
              </TabsContent>
              <TabsContent value="menu" className="text-text-muted text-sm">
                Se establecen aparte del menú
              </TabsContent>
            </Tabs>
          </Row>
          <Row label="segmented">
            <Tabs defaultValue="entreno">
              <TabsList variant="segmented">
                <TabsTrigger value="entreno">Día de entrenamiento</TabsTrigger>
                <TabsTrigger value="descanso">Día de descanso</TabsTrigger>
              </TabsList>
            </Tabs>
          </Row>
        </Section>

        <Section title={t.cards}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardContent>
                <div className="font-display text-[38px] font-bold">14</div>
                <div className="eyebrow">Clientes activos</div>
              </CardContent>
            </Card>
            <Card className="border-accent-outline">
              <CardContent>
                <div className="font-display text-accent text-[38px] font-bold">3</div>
                <div className="eyebrow">Revisiones sin revisar</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Nota del entrenador</CardTitle>
                <CardDescription>— Adrián · lunes</CardDescription>
              </CardHeader>
              <CardContent className="text-sm">
                Esta semana sube 2,5 kg en sentadilla si el RIR 2 se te queda fácil.
              </CardContent>
            </Card>
          </div>
        </Section>

        <Section title={t.table}>
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Inicio</TableHead>
                  <TableHead>Fin</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-semibold">Marta Ruiz</TableCell>
                  <TableCell>Trimestral</TableCell>
                  <TableCell>01-07-2026</TableCell>
                  <TableCell>30-09-2026</TableCell>
                  <TableCell>
                    <Badge variant="success">Pagada</Badge>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-semibold">Jorge Lema</TableCell>
                  <TableCell>Mensual</TableCell>
                  <TableCell>01-09-2026</TableCell>
                  <TableCell>30-09-2026</TableCell>
                  <TableCell>
                    <Badge variant="destructive">No pagada</Badge>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Card>
        </Section>

        <Section title={t.overlays}>
          <Row label="dialog">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Enviar revisión</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Revisión incompleta</DialogTitle>
                  <DialogDescription>
                    Faltan las medidas. Puedes enviarla igualmente y completarla después.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="ghost">Cancelar</Button>
                  <Button>Enviar igualmente</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Row>
          <Row label="dropdown">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">⋯</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Hiper 5d v3</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Editar</DropdownMenuItem>
                <DropdownMenuItem>Duplicar</DropdownMenuItem>
                <DropdownMenuItem variant="destructive">Archivar</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </Row>
          <Row label="tooltip">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="pill">Registrar ▸</Button>
              </TooltipTrigger>
              <TooltipContent>Opcional — no hace falta completar</TooltipContent>
            </Tooltip>
          </Row>
        </Section>
      </main>
    </TooltipProvider>
  );
}
