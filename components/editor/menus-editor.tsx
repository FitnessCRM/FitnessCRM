"use client";

import { XIcon } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { EmptyState } from "@/components/ui/states";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  createFoodItem,
  DAY_TYPES,
  emptyMacrosDraft,
  foodItemContribution,
  macrosFromDraft,
  mealSubtotal,
  setFoodItemGrams,
  setSuggestedMenu,
  type DayType,
  type Food,
  type FoodItem,
  type MacrosDraft,
  type Meal,
  type MenuEntryDraft,
} from "@/lib/domain";
import { es } from "@/lib/i18n/es";
import { FoodCreateDialog } from "./food-create-dialog";
import { FoodItemField } from "./food-item-field";
import { KcalField } from "./kcal-field";
import { MenuTally } from "./menu-tally";
import { NumberField } from "./number-field";
import { nutrientLine } from "./nutrient-line";

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

/** La fila a la que va el alimento que se crea sin salir del menú. */
interface CreatingFood {
  menuId: string;
  mealId: string;
  itemId: string;
  name: string;
}

/**
 * Menús de una plantilla: varios por tipo de día, uno sugerido por tipo, con sus kcal y macros
 * declaradas y su jerarquía comida → alimento. Controlado, como el de rutina: el editor del plan de
 * un cliente lo monta igual. Trabaja con borradores: un menú nuevo nace sin kcal ni macros y quien
 * lo monta no puede guardarlo hasta que `fromMenuDrafts` lo dé por completo (§5).
 *
 * Los alimentos salen de tu biblioteca o del catálogo común, o se escriben a mano; lo único que lee
 * datos es su campo, y crear un alimento sin salir del menú. Lo que suman es un apoyo: avisa y no
 * rellena ni bloquea nada (I30).
 */
export function MenusEditor({
  menus,
  onChange,
}: {
  menus: MenuEntryDraft[];
  onChange: (menus: MenuEntryDraft[]) => void;
}) {
  const [creating, setCreating] = useState<CreatingFood | null>(null);
  const update = (menuId: string, change: (menu: MenuEntryDraft) => MenuEntryDraft) =>
    onChange(menus.map((menu) => (menu.id === menuId ? change(menu) : menu)));

  // El alimento recién creado pasa a la fila desde la que se creó, con sus gramos y su id (I29).
  const linkCreated = (food: Food) => {
    if (!creating) return;
    const { menuId, mealId, itemId } = creating;
    update(menuId, (menu) => ({
      ...menu,
      meals: menu.meals.map((meal) =>
        meal.id !== mealId
          ? meal
          : {
              ...meal,
              items: meal.items.map((item) =>
                item.id === itemId ? createFoodItem(food, item.grams, () => item.id) : item,
              ),
            },
      ),
    }));
    setCreating(null);
  };

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
        macros: emptyMacrosDraft(),
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
            onCreateFood={(mealId, itemId, name) =>
              setCreating({ menuId: menu.id, mealId, itemId, name })
            }
          />
        ))
      )}

      {creating ? (
        <FoodCreateDialog
          name={creating.name}
          onCreated={linkCreated}
          onOpenChange={(open) => {
            if (!open) setCreating(null);
          }}
        />
      ) : null}
    </div>
  );
}

function MenuCard({
  menu,
  onChange,
  onSuggest,
  onRemove,
  onCreateFood,
}: {
  menu: MenuEntryDraft;
  onChange: (menu: MenuEntryDraft) => void;
  onSuggest: () => void;
  onRemove: () => void;
  onCreateFood: (mealId: string, itemId: string, name: string) => void;
}) {
  const setMeal = (mealId: string, change: (meal: Meal) => Meal) =>
    onChange({ ...menu, meals: menu.meals.map((m) => (m.id === mealId ? change(m) : m)) });
  const setItem = (mealId: string, itemId: string, change: (item: FoodItem) => FoodItem) =>
    setMeal(mealId, (m) => ({
      ...m,
      items: m.items.map((i) => (i.id === itemId ? change(i) : i)),
    }));
  const setMacros = (change: Partial<MacrosDraft>) =>
    onChange({ ...menu, macros: { ...menu.macros, ...change } });
  // Escrito pero no válido («2.000», «0»): se dice qué pasa; vacío solo cuenta como incompleto.
  const kcal = menu.macros.kcal;
  const kcalInvalid = kcal !== null && !(Number.isInteger(kcal) && kcal > 0);
  const incomplete = macrosFromDraft(menu.macros) === null;

  // Por debajo de `xl` el panel va fijo arriba, encima de las comidas: lo que recibe el foco con
  // el teclado no puede quedar tapado por él. Se baja la página lo justo para verlo. Desde `xl` el
  // panel está a la derecha y no se cruzan.
  const tallyRef = useRef<HTMLElement>(null);
  const keepClearOfTally = (event: React.FocusEvent<HTMLElement>) => {
    const tally = tallyRef.current?.getBoundingClientRect();
    const field = event.target.getBoundingClientRect();
    if (!tally || field.right <= tally.left || field.left >= tally.right) return;
    const gap = 8;
    if (field.top < tally.bottom + gap && field.bottom > tally.top) {
      window.scrollBy({ top: field.top - tally.bottom - gap });
    }
  };

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
          <KcalField
            id={`kcal-${menu.id}`}
            label={t.kcal}
            value={menu.macros.kcal}
            invalid={kcalInvalid}
            onChange={(kcal) => setMacros({ kcal })}
          />
          <NumberField
            label={t.protein}
            step="any"
            showZero
            value={menu.macros.proteinG}
            onChange={(proteinG) => setMacros({ proteinG })}
          />
          <NumberField
            label={t.carbs}
            step="any"
            showZero
            value={menu.macros.carbsG}
            onChange={(carbsG) => setMacros({ carbsG })}
          />
          <NumberField
            label={t.fat}
            step="any"
            showZero
            value={menu.macros.fatG}
            onChange={(fatG) => setMacros({ fatG })}
          />
        </div>
        {kcalInvalid ? (
          <p role="alert" className="text-danger mt-2 text-xs">
            {es.common.kcalInvalid}
          </p>
        ) : incomplete ? (
          <p className="text-text-subtle mt-2 text-xs">{t.macrosIncomplete}</p>
        ) : null}
      </div>

      {/* Comidas y «Lo que llevas». Desde `xl`, el panel a la derecha; por debajo, arriba y en 2×2:
          es la referencia contra la que se escribe, así que se ve mientras se añaden alimentos.
          Fijo en los dos casos mientras se recorren las comidas de este menú. */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start xl:gap-5">
        <MenuTally
          ref={tallyRef}
          macros={menu.macros}
          meals={menu.meals}
          className="sticky top-2 z-10 xl:col-start-2 xl:row-start-1"
        />
        <div
          onFocus={keepClearOfTally}
          className="flex min-w-0 flex-col gap-4 xl:col-start-1 xl:row-start-1"
        >
          {menu.meals.length === 0 ? (
            <p className="text-text-subtle text-[13px]">{t.noMeals}</p>
          ) : (
            menu.meals.map((meal) => (
              <MealBlock
                key={meal.id}
                meal={meal}
                onName={(name) => setMeal(meal.id, (m) => ({ ...m, name }))}
                onRemove={() =>
                  onChange({ ...menu, meals: menu.meals.filter((m) => m.id !== meal.id) })
                }
                onItem={(itemId, change) => setItem(meal.id, itemId, change)}
                onRemoveItem={(itemId) =>
                  setMeal(meal.id, (m) => ({ ...m, items: m.items.filter((i) => i.id !== itemId) }))
                }
                onAddItem={() =>
                  setMeal(meal.id, (m) => ({
                    ...m,
                    items: [...m.items, { id: newId(), name: "", grams: 0 }],
                  }))
                }
                onCreateFood={(itemId, name) => onCreateFood(meal.id, itemId, name)}
              />
            ))
          )}
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
        </div>
      </div>

      <Textarea
        value={menu.note}
        onChange={(event) => onChange({ ...menu, note: event.target.value })}
        aria-label={t.note}
        placeholder={t.note}
        rows={2}
      />
    </section>
  );
}

/** Una comida: su nombre, lo que suma y sus alimentos. */
function MealBlock({
  meal,
  onName,
  onRemove,
  onItem,
  onRemoveItem,
  onAddItem,
  onCreateFood,
}: {
  meal: Meal;
  onName: (name: string) => void;
  onRemove: () => void;
  onItem: (itemId: string, change: (item: FoodItem) => FoodItem) => void;
  onRemoveItem: (itemId: string) => void;
  onAddItem: () => void;
  onCreateFood: (itemId: string, name: string) => void;
}) {
  // El subtotal solo cuando algo suma: una comida de texto libre no aporta nada que contar.
  const adds = meal.items.some((item) => item.composition && item.grams > 0);

  return (
    <div className="bg-surface-raised flex flex-col gap-2.5 rounded-lg p-3">
      <div className="flex items-center gap-1">
        <Input
          value={meal.name}
          onChange={(event) => onName(event.target.value)}
          aria-label={t.mealName}
          placeholder={t.mealPlaceholder}
          className="h-9 min-w-0 flex-1 text-[14px] font-semibold"
        />
        <RemoveButton label={t.removeMeal} onClick={onRemove} />
      </div>
      {adds ? (
        <p className="text-text-muted -mt-1 pl-0.5 text-xs tabular-nums">
          {t.mealSubtotal} {nutrientLine(mealSubtotal(meal))}
        </p>
      ) : null}
      {meal.items.map((item) => (
        <ItemRow
          key={item.id}
          item={item}
          onChange={(next) => onItem(item.id, () => next)}
          onGrams={(grams) => onItem(item.id, (i) => setFoodItemGrams(i, grams))}
          onRemove={() => onRemoveItem(item.id)}
          onCreate={(name) => onCreateFood(item.id, name)}
        />
      ))}
      <Button type="button" variant="ghost" size="sm" className="self-start" onClick={onAddItem}>
        {t.addItem}
      </Button>
    </div>
  );
}

/**
 * Un alimento del menú y, debajo, lo que aporta o, si es texto libre, que no suma y el acceso a
 * guardarlo en Alimentos. En móvil el nombre ocupa su propia línea y los gramos bajan a la siguiente.
 */
function ItemRow({
  item,
  onChange,
  onGrams,
  onRemove,
  onCreate,
}: {
  item: FoodItem;
  onChange: (item: FoodItem) => void;
  onGrams: (grams: number) => void;
  onRemove: () => void;
  onCreate: (name: string) => void;
}) {
  const infoId = `food-item-info-${item.id}`;
  const contribution = foodItemContribution(item);
  const name = item.name.trim();

  return (
    <div data-food-row className="flex flex-col gap-1">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
          <FoodItemField item={item} onChange={onChange} onCreate={onCreate} describedBy={infoId} />
        </div>
        <NumberField
          label={t.grams}
          step="any"
          value={item.grams}
          className="w-24 shrink-0"
          onChange={(v) => onGrams(v ?? 0)}
        />
        <RemoveButton label={t.removeItem} onClick={onRemove} />
      </div>
      <div id={infoId} className="flex flex-wrap items-center gap-x-3 pl-0.5 text-xs">
        {contribution ? (
          <span className="text-text-muted tabular-nums">
            {item.grams > 0 ? nutrientLine(contribution) : t.item.noGrams}
          </span>
        ) : name === "" ? (
          <span className="text-text-subtle">{t.item.empty}</span>
        ) : (
          <>
            <span className="text-text-subtle">{t.item.freeText}</span>
            <button
              type="button"
              onClick={() => onCreate(name)}
              className="text-accent-hover hover:text-accent-emphasis focus-visible:ring-ring/50 min-h-8 rounded-sm underline underline-offset-4 outline-none focus-visible:ring-[3px]"
            >
              {t.item.saveToLibrary}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
