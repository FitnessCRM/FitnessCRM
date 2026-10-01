"use client";

import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { EmptyState } from "@/components/ui/states";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  DAY_TYPES,
  derivedKcal,
  setSuggestedMenu,
  type DayType,
  type Meal,
  type MenuTemplateEntry,
} from "@/lib/domain";
import { formatInteger } from "@/lib/format";
import { es } from "@/lib/i18n/es";
import { NumberField } from "./number-field";

const t = es.editor.menu;

function newId(): string {
  return crypto.randomUUID();
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <XIcon />
    </Button>
  );
}

/**
 * Menús de una plantilla: varios por tipo de día, uno sugerido por tipo, con sus macros
 * declaradas y su jerarquía comida → alimento. Controlado y sin datos, como el de rutina: el
 * editor del plan de un cliente puede montarlo igual.
 */
export function MenusEditor({
  menus,
  onChange,
}: {
  menus: MenuTemplateEntry[];
  onChange: (menus: MenuTemplateEntry[]) => void;
}) {
  const update = (menuId: string, change: (menu: MenuTemplateEntry) => MenuTemplateEntry) =>
    onChange(menus.map((menu) => (menu.id === menuId ? change(menu) : menu)));

  const addMenu = () => {
    const dayType: DayType = "entrenamiento";
    const hasSuggested = menus.some((m) => m.dayType === dayType && m.suggested);
    onChange([
      ...menus,
      {
        id: newId(),
        name: "",
        dayType,
        suggested: !hasSuggested,
        macros: { proteinG: 0, carbsG: 0, fatG: 0 },
        meals: [],
        note: "",
      },
    ]);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-text-muted text-[13px]">{t.hint}</p>
        <Button type="button" variant="secondary" size="sm" onClick={addMenu}>
          {t.addMenu}
        </Button>
      </div>

      {menus.length === 0 ? (
        <EmptyState title={t.noMenus.title} description={t.noMenus.hint} />
      ) : (
        menus.map((menu) => (
          <MenuCard
            key={menu.id}
            menu={menu}
            onChange={(next) => update(menu.id, () => next)}
            onSuggest={() => onChange(setSuggestedMenu(menus, menu.id))}
            onRemove={() => onChange(menus.filter((m) => m.id !== menu.id))}
          />
        ))
      )}
    </div>
  );
}

function MenuCard({
  menu,
  onChange,
  onSuggest,
  onRemove,
}: {
  menu: MenuTemplateEntry;
  onChange: (menu: MenuTemplateEntry) => void;
  onSuggest: () => void;
  onRemove: () => void;
}) {
  const setMeal = (mealId: string, change: (meal: Meal) => Meal) =>
    onChange({ ...menu, meals: menu.meals.map((m) => (m.id === mealId ? change(m) : m)) });

  return (
    <section
      aria-label={menu.name || t.menuName}
      className="border-border-subtle bg-surface flex flex-col gap-4 rounded-xl border p-4 sm:p-5"
    >
      <header className="flex flex-wrap items-center gap-2">
        <Input
          value={menu.name}
          onChange={(event) => onChange({ ...menu, name: event.target.value })}
          aria-label={t.menuName}
          placeholder={t.menuName}
          className="h-10 min-w-0 flex-1 basis-48 text-[14px]"
        />
        <NativeSelect
          aria-label={t.dayType}
          value={menu.dayType}
          onChange={(event) => {
            // Al cambiar de tipo de día, el menú deja de ser el sugerido del tipo anterior.
            onChange({ ...menu, dayType: event.target.value as DayType, suggested: false });
          }}
          className="border-border-emphasis bg-background h-10 text-[14px]"
        >
          {DAY_TYPES.map((dayType) => (
            <option key={dayType} value={dayType}>
              {t.dayTypes[dayType]}
            </option>
          ))}
        </NativeSelect>
        <RemoveButton label={t.removeMenu} onClick={onRemove} />
      </header>

      <label className="flex min-h-8 w-fit cursor-pointer items-center gap-2.5 text-[13px]">
        <Switch
          checked={menu.suggested}
          onCheckedChange={(checked) =>
            checked ? onSuggest() : onChange({ ...menu, suggested: false })
          }
          aria-label={t.suggested}
        />
        {t.suggested}
      </label>

      <div>
        <p className="text-text-subtle tracking-label mb-2 text-[11px] uppercase">{t.macros}</p>
        <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-4">
          <NumberField
            label={t.protein}
            step="any"
            value={menu.macros.proteinG}
            onChange={(v) => onChange({ ...menu, macros: { ...menu.macros, proteinG: v ?? 0 } })}
          />
          <NumberField
            label={t.carbs}
            step="any"
            value={menu.macros.carbsG}
            onChange={(v) => onChange({ ...menu, macros: { ...menu.macros, carbsG: v ?? 0 } })}
          />
          <NumberField
            label={t.fat}
            step="any"
            value={menu.macros.fatG}
            onChange={(v) => onChange({ ...menu, macros: { ...menu.macros, fatG: v ?? 0 } })}
          />
          <p className="text-text-muted pb-2 text-[13px]">
            <span className="text-text-primary font-semibold">
              {formatInteger(derivedKcal(menu.macros))}
            </span>{" "}
            {t.kcal}
          </p>
        </div>
      </div>

      {menu.meals.length === 0 ? (
        <p className="text-text-subtle text-[13px]">{t.noMeals}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {menu.meals.map((meal) => (
            <div key={meal.id} className="bg-surface-raised flex flex-col gap-2 rounded-lg p-3">
              <div className="flex items-center gap-1">
                <Input
                  value={meal.name}
                  onChange={(event) =>
                    setMeal(meal.id, (m) => ({ ...m, name: event.target.value }))
                  }
                  aria-label={t.mealName}
                  placeholder={t.mealPlaceholder}
                  className="h-9 min-w-0 flex-1 text-[14px] font-semibold"
                />
                <RemoveButton
                  label={t.removeMeal}
                  onClick={() =>
                    onChange({ ...menu, meals: menu.meals.filter((m) => m.id !== meal.id) })
                  }
                />
              </div>
              {meal.items.map((item) => (
                <div key={item.id} className="flex items-end gap-2">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <Label className="sr-only">{t.itemName}</Label>
                    <Input
                      value={item.name}
                      onChange={(event) =>
                        setMeal(meal.id, (m) => ({
                          ...m,
                          items: m.items.map((i) =>
                            i.id === item.id ? { ...i, name: event.target.value } : i,
                          ),
                        }))
                      }
                      aria-label={t.itemName}
                      placeholder={t.itemPlaceholder}
                      className="h-10 text-[14px]"
                    />
                  </div>
                  <NumberField
                    label={t.grams}
                    step="any"
                    value={item.grams}
                    className="w-24 shrink-0"
                    onChange={(v) =>
                      setMeal(meal.id, (m) => ({
                        ...m,
                        items: m.items.map((i) => (i.id === item.id ? { ...i, grams: v ?? 0 } : i)),
                      }))
                    }
                  />
                  <RemoveButton
                    label={t.removeItem}
                    onClick={() =>
                      setMeal(meal.id, (m) => ({
                        ...m,
                        items: m.items.filter((i) => i.id !== item.id),
                      }))
                    }
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={() =>
                  setMeal(meal.id, (m) => ({
                    ...m,
                    items: [...m.items, { id: newId(), name: "", grams: 0 }],
                  }))
                }
              >
                {t.addItem}
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="self-start"
          onClick={() =>
            onChange({ ...menu, meals: [...menu.meals, { id: newId(), name: "", items: [] }] })
          }
        >
          {t.addMeal}
        </Button>
        <Textarea
          value={menu.note}
          onChange={(event) => onChange({ ...menu, note: event.target.value })}
          aria-label={t.note}
          placeholder={t.note}
          rows={2}
        />
      </div>
    </section>
  );
}
