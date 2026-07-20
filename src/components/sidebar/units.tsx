import { useEffect, useState } from "react";
import { jobTypeClass } from "@/components/overview/actionplan";
import { Badge } from "@/components/shadcn/badge";
import { Button } from "@/components/shadcn/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/shadcn/card";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/shadcn/field";
import { InputGroup, InputGroupInput } from "@/components/shadcn/input-group";
import { RadioGroup, RadioGroupItem } from "@/components/shadcn/radio-group";
import { ScrollArea } from "@/components/shadcn/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/shadcn/tooltip";
import { utilities } from "@/gn-data/utility";
import {
  clockLabel,
  formatEconomyOrderLabel,
  newEconomyOrderId,
  type EconomyOrder,
  type PlanResult,
  type StartConfig,
} from "@/lib/calculateFastestWayToGoal";

const asteroidUtility = utilities.find((x) => x.name === "Asteroid");
const ASTEROID_COST_KRIS = asteroidUtility?.cost.kris ?? 10_000;

export type UnitsProps = {
  canUse: boolean;
  hasObservatorium: boolean;
  economyOrders: EconomyOrder[];
  plan: PlanResult | null;
  startCfg: StartConfig;
  defaultTick: number;
  maxExtractorsAtTech: number;
  onAddOrder: (order: EconomyOrder) => void;
  onRemoveOrder: (id: string) => void;
};

export function Units({
  canUse,
  hasObservatorium,
  economyOrders,
  plan,
  startCfg,
  defaultTick,
  maxExtractorsAtTech,
  onAddOrder,
  onRemoveOrder,
}: UnitsProps) {
  const [asteroidCount, setAsteroidCount] = useState(1);
  const [asteroidTick, setAsteroidTick] = useState(0);
  const [extractorCount, setExtractorCount] = useState(1);
  const [extractorResource, setExtractorResource] = useState<"met" | "kris">("met");
  const [extractorTick, setExtractorTick] = useState(0);

  useEffect(() => {
    setAsteroidTick(defaultTick);
    setExtractorTick(defaultTick);
  }, [defaultTick]);

  useEffect(() => {
    if (canUse && maxExtractorsAtTech > 0) {
      setExtractorCount(maxExtractorsAtTech);
    }
  }, [canUse, maxExtractorsAtTech]);

  const addAsteroidOrder = () => {
    const count = Math.max(1, Math.floor(asteroidCount) || 1);
    const atTick = Math.max(0, Math.floor(asteroidTick) || 0);
    onAddOrder({
      id: newEconomyOrderId(),
      kind: "asteroids",
      count,
      atTick,
    });
  };

  const addExtractorOrder = () => {
    const count = Math.max(1, Math.floor(extractorCount) || 1);
    const atTick = Math.max(0, Math.floor(extractorTick) || 0);
    onAddOrder({
      id: newEconomyOrderId(),
      kind: "extractors",
      count,
      resource: extractorResource,
      atTick,
    });
  };

  if (!canUse) {
    return (
      <div className="flex flex-1 items-start p-4">
        <p className="text-sm text-muted-foreground">
          Noch gesperrt — füge zuerst{" "}
          <span className="font-medium text-foreground">Extraktor</span> im Tech-Plan hinzu.
          {hasObservatorium ? "" : " Observatorium wird für Asteroiden-Scans benötigt."}
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="flex flex-col gap-3 p-3">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Asteroiden scannen</CardTitle>
            <CardDescription className="tabular-nums">
              Vorschlag T{defaultTick}
              {plan ? ` · ${clockLabel(startCfg, defaultTick)}` : ""} ·{" "}{ASTEROID_COST_KRIS.toLocaleString("de-DE")} Kris
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="gap-3">
              <div className="flex flex-wrap items-end gap-2">
                <Field className="w-24">
                  <FieldLabel htmlFor="asteroid-count">Anzahl</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="asteroid-count"
                      type="number"
                      min={1}
                      value={asteroidCount}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (!Number.isFinite(n)) return;
                        setAsteroidCount(Math.max(1, Math.floor(n)));
                      }}
                      className="tabular-nums"
                    />
                  </InputGroup>
                </Field>
                <Field className="w-24">
                  <FieldLabel htmlFor="asteroid-tick">Ab Tick</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="asteroid-tick"
                      type="number"
                      min={0}
                      value={asteroidTick}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (!Number.isFinite(n)) return;
                        setAsteroidTick(Math.max(0, Math.floor(n)));
                      }}
                      className="tabular-nums"
                    />
                  </InputGroup>
                </Field>
                <Button type="button" variant="secondary" size="sm" onClick={addAsteroidOrder}>
                  Hinzufügen
                </Button>
              </div>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Extraktoren bauen</CardTitle>
            <CardDescription className="tabular-nums">
              Max. nach Tech: {maxExtractorsAtTech} · Asteroiden-Slots
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="gap-3">
              <div className="flex flex-wrap items-end gap-2">
                <Field className="w-24">
                  <FieldLabel htmlFor="extractor-count">Anzahl</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="extractor-count"
                      type="number"
                      min={1}
                      value={extractorCount}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (!Number.isFinite(n)) return;
                        setExtractorCount(Math.max(1, Math.floor(n)));
                      }}
                      className="tabular-nums"
                    />
                  </InputGroup>
                </Field>
                <Field className="w-24">
                  <FieldLabel htmlFor="extractor-tick">Ab Tick</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="extractor-tick"
                      type="number"
                      min={0}
                      value={extractorTick}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (!Number.isFinite(n)) return;
                        setExtractorTick(Math.max(0, Math.floor(n)));
                      }}
                      className="tabular-nums"
                    />
                  </InputGroup>
                </Field>
              </div>
              <FieldSet className="gap-1.5">
                <FieldLegend variant="label">Typ</FieldLegend>
                <RadioGroup
                  value={extractorResource}
                  onValueChange={(value) => {
                    if (value === "met" || value === "kris") {
                      setExtractorResource(value);
                    }
                  }}
                  className="flex w-auto flex-row gap-3"
                >
                  <Field orientation="horizontal" className="w-auto">
                    <RadioGroupItem value="met" id="extractor-res-met" />
                    <FieldLabel htmlFor="extractor-res-met" className="font-normal">
                      Metall
                    </FieldLabel>
                  </Field>
                  <Field orientation="horizontal" className="w-auto">
                    <RadioGroupItem value="kris" id="extractor-res-kris" />
                    <FieldLabel htmlFor="extractor-res-kris" className="font-normal">
                      Kristall
                    </FieldLabel>
                  </Field>
                </RadioGroup>
              </FieldSet>
              <Button type="button" variant="secondary" size="sm" onClick={addExtractorOrder}>
                Hinzufügen
              </Button>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader className="border-b">
            <CardTitle>Geplant</CardTitle>
            <CardAction>
              <Badge variant="secondary">{economyOrders.length}</Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="p-0">
            {economyOrders.length === 0 ? (
              <p className="px-3 py-3 text-sm text-muted-foreground">Noch keine Economy-Aktionen.</p>
            ) : (
              <ul className="divide-y divide-border">
                {economyOrders.map((order) => {
                  const fin = plan?.economyOrderFinishTicks[order.id];
                  return (
                    <li
                      key={order.id}
                      className="flex items-start justify-between gap-2 px-3 py-2 text-sm"
                    >
                      <span className="min-w-0">
                        <span className={jobTypeClass("economy")}>
                          {formatEconomyOrderLabel(order)}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground tabular-nums">
                          ab T{order.atTick}
                          {plan ? ` · ${clockLabel(startCfg, order.atTick)}` : ""}
                          {fin !== undefined ? ` · fertig T${fin}` : " · offen"}
                        </span>
                      </span>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => onRemoveOrder(order.id)}
                            />
                          }
                        >
                          ×
                        </TooltipTrigger>
                        <TooltipContent>Entfernen</TooltipContent>
                      </Tooltip>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
