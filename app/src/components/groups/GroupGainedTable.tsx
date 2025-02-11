"use client";

import { useMemo, useTransition } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ACTIVITIES,
  BOSSES,
  COMPUTED_METRICS,
  DeltaGroupLeaderboardEntry,
  GroupDetails,
  Metric,
  MetricProps,
  PERIODS,
  Period,
  PeriodProps,
  SKILLS,
  isActivity,
  isBoss,
  isMetric,
  isPeriod,
} from "@wise-old-man/utils";
import { Badge } from "../Badge";
import { TableTitle } from "../Table";
import { DataTable } from "../DataTable";
import { MetricIconSmall } from "../Icon";
import { PlayerIdentity } from "../PlayerIdentity";
import { FormattedNumber } from "../FormattedNumber";
import { Tooltip, TooltipContent, TooltipTrigger } from "../Tooltip";
import { formatDatetime, timeago } from "~/utils/dates";
import { TimeRangeFilter } from "~/services/wiseoldman";
import { getPageParam } from "~/utils/params";
import {
  Combobox,
  ComboboxButton,
  ComboboxContent,
  ComboboxInput,
  ComboboxEmpty,
  ComboboxItemsContainer,
  ComboboxItemGroup,
  ComboboxItem,
  ComboboxSeparator,
} from "../Combobox";

import ArrowUpIcon from "~/assets/arrow_up.svg";

interface GroupGainedTableProps {
  metric: Metric;
  timeRange: TimeRangeFilter;
  group: GroupDetails;
  gains: DeltaGroupLeaderboardEntry[];
}

export function GroupGainedTable(props: GroupGainedTableProps) {
  const { group, metric, timeRange, gains } = props;

  const router = useRouter();
  const searchParams = useSearchParams();

  const page = getPageParam(searchParams.get("page")) || 1;
  const columnDefs = useMemo(() => getColumnDefinitions(page, metric), [page, metric]);

  function handleMetricChanged(metric: Metric) {
    const nextParams = new URLSearchParams(searchParams);

    // Reset pagination if params change
    nextParams.delete("page");

    if (metric) {
      nextParams.set("metric", metric);
    } else {
      nextParams.delete("metric");
    }

    router.replace(`/groups/${group.id}/gained?${nextParams.toString()}`, { scroll: false });
  }

  function handlePeriodChanged(newPeriod: Period | "custom") {
    const nextParams = new URLSearchParams(searchParams);

    // Reset pagination if params change
    nextParams.delete("page");

    if (newPeriod === "custom") {
      nextParams.set("dialog", "custom_period");
    } else if (newPeriod) {
      nextParams.set("period", newPeriod);
      nextParams.delete("startDate");
      nextParams.delete("endDate");
    } else {
      nextParams.delete("period");
      nextParams.delete("startDate");
      nextParams.delete("endDate");
    }

    router.replace(`/groups/${group.id}/gained?${nextParams.toString()}`, { scroll: false });
  }

  return (
    <DataTable
      columns={columnDefs}
      data={gains}
      enablePagination
      headerSlot={
        <TableTitle>
          <div className="w-full @container">
            <div className="flex flex-col justify-between gap-y-5 @2xl:flex-row @2xl:items-center">
              <div>
                <h3 className="text-h3 font-medium text-white">Gained</h3>
                <p className="text-body text-gray-200">
                  {"period" in timeRange ? (
                    <>
                      Most {MetricProps[metric].name} {MetricProps[metric].measure} gained in the past{" "}
                      {PeriodProps[timeRange.period].name.toLowerCase()}
                    </>
                  ) : (
                    <>
                      Most {MetricProps[metric].name} {MetricProps[metric].measure} gained during:{" "}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-white underline">custom period</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          Start: {formatDatetime(timeRange.startDate)}
                          <br />
                          End: {formatDatetime(timeRange.endDate)}
                        </TooltipContent>
                      </Tooltip>
                    </>
                  )}
                  &nbsp;
                  {page > 1 ? `(page ${page})` : ""}
                </p>
              </div>
              <div className="flex items-center gap-x-3">
                <PeriodSelect
                  period={"period" in timeRange ? timeRange.period : undefined}
                  onPeriodSelected={handlePeriodChanged}
                />
                <MetricSelect metric={metric} onMetricSelected={handleMetricChanged} />
              </div>
            </div>
          </div>
        </TableTitle>
      }
    />
  );
}

function getColumnDefinitions(page: number, metric: Metric) {
  const columns: ColumnDef<DeltaGroupLeaderboardEntry>[] = [
    {
      id: "rank",
      header: "Rank",
      accessorFn: (_, index) => {
        return index + 1 + (page - 1) * 20;
      },
    },
    {
      accessorKey: "player",
      header: "Player",
      cell: ({ row }) => {
        return (
          <div className="pr-5">
            <PlayerIdentity
              player={row.original.player}
              caption={
                row.original.player.updatedAt
                  ? `Updated ${timeago.format(row.original.player.updatedAt)}`
                  : undefined
              }
            />
          </div>
        );
      },
    },
    {
      accessorKey: "start",
      header: "Start",
      cell: ({ row }) => {
        return <MetricValueCell value={row.original.data.start} metric={metric} />;
      },
    },
    {
      accessorKey: "end",
      header: "End",
      cell: ({ row }) => {
        return <MetricValueCell value={row.original.data.end} metric={metric} />;
      },
    },
    {
      accessorKey: "gained",
      header: "Gained",
      cell: ({ row }) => {
        if (row.original.data.gained <= 0) {
          return <MetricValueCell value={row.original.data.gained} metric={metric} />;
        }

        return <FormattedNumber value={row.original.data.gained} colored />;
      },
    },
    {
      accessorKey: "percent",
      header: "% Gained",
      cell: ({ row }) => {
        const { start, end, gained } = row.original.data;

        const percent = getPercentGained(metric, start, end, gained);

        if (percent <= 0) {
          return "---";
        }

        return (
          <Badge variant="success">
            <ArrowUpIcon className="-ml-1 h-5 w-5" />
            {Math.round(percent * 1000) / 10}%
          </Badge>
        );
      },
    },
  ];

  return columns;
}

interface MetricSelectProps {
  metric: Metric;
  onMetricSelected: (metric: Metric) => void;
}

function MetricSelect(props: MetricSelectProps) {
  const { metric, onMetricSelected } = props;

  const [isTransitioning, startTransition] = useTransition();

  return (
    <Combobox
      value={metric}
      onValueChanged={(val) => {
        startTransition(() => {
          if (val === undefined) {
            onMetricSelected(Metric.OVERALL);
          } else if (isMetric(val)) {
            onMetricSelected(val);
          }
        });
      }}
    >
      <ComboboxButton isPending={isTransitioning} className="w-full min-w-[12rem]">
        <div className="flex items-center gap-x-2">
          <MetricIconSmall metric={metric} />
          <span className="line-clamp-1 text-left">{MetricProps[metric].name} </span>
        </div>
      </ComboboxButton>
      <ComboboxContent className="max-h-[16rem]" align="end">
        <ComboboxInput placeholder="Search metrics..." />
        <ComboboxEmpty>No results were found</ComboboxEmpty>
        <ComboboxItemsContainer>
          <ComboboxItemGroup label="Skills">
            {SKILLS.map((skill) => (
              <ComboboxItem key={skill} value={skill}>
                <MetricIconSmall metric={skill} />
                {MetricProps[skill].name}
              </ComboboxItem>
            ))}
          </ComboboxItemGroup>
          <ComboboxSeparator />
          <ComboboxItemGroup label="Bosses">
            {BOSSES.map((boss) => (
              <ComboboxItem key={boss} value={boss}>
                <MetricIconSmall metric={boss} />
                {MetricProps[boss].name}
              </ComboboxItem>
            ))}
          </ComboboxItemGroup>
          <ComboboxSeparator />
          <ComboboxItemGroup label="Activities">
            {ACTIVITIES.map((activity) => (
              <ComboboxItem key={activity} value={activity}>
                <MetricIconSmall metric={activity} />
                {MetricProps[activity].name}
              </ComboboxItem>
            ))}
          </ComboboxItemGroup>
          <ComboboxItemGroup label="Computed">
            {COMPUTED_METRICS.map((computed) => (
              <ComboboxItem key={computed} value={computed}>
                <MetricIconSmall metric={computed} />
                {MetricProps[computed].name}
              </ComboboxItem>
            ))}
          </ComboboxItemGroup>
        </ComboboxItemsContainer>
      </ComboboxContent>
    </Combobox>
  );
}

interface PeriodSelectProps {
  period?: Period;
  onPeriodSelected: (period: Period | "custom") => void;
}

function PeriodSelect(props: PeriodSelectProps) {
  const { period, onPeriodSelected } = props;

  const [isTransitioning, startTransition] = useTransition();

  return (
    <Combobox
      value={period}
      onValueChanged={(val) => {
        startTransition(() => {
          if (val === undefined) {
            onPeriodSelected(Period.WEEK);
          } else if (isPeriod(val) || val === "custom") {
            onPeriodSelected(val);
          }
        });
      }}
    >
      <ComboboxButton className="w-full" isPending={isTransitioning}>
        <div className="flex items-center gap-x-2">
          {period ? PeriodProps[period].name : "Custom period"}
        </div>
      </ComboboxButton>
      <ComboboxContent>
        <ComboboxItemsContainer>
          <ComboboxItemGroup label="Period">
            {PERIODS.map((period) => (
              <ComboboxItem value={period} key={period}>
                {PeriodProps[period].name}
              </ComboboxItem>
            ))}
            <ComboboxItem value="custom">Select custom period...</ComboboxItem>
          </ComboboxItemGroup>
        </ComboboxItemsContainer>
      </ComboboxContent>
    </Combobox>
  );
}

function MetricValueCell(props: { metric: Metric; value: number }) {
  const { metric, value } = props;

  if (isBoss(metric) && MetricProps[metric].minimumValue > value) {
    const { name, minimumValue } = MetricProps[metric];

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span>&lt; {minimumValue}</span>
        </TooltipTrigger>
        <TooltipContent>
          The Hiscores only start showing {name} kills at {minimumValue} kc.
        </TooltipContent>
      </Tooltip>
    );
  }

  if (isActivity(metric) && MetricProps[metric].minimumValue > value) {
    const { name, minimumValue } = MetricProps[metric];

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span>&lt; {minimumValue}</span>
        </TooltipTrigger>
        <TooltipContent>
          The Hiscores only start showing {name} after {minimumValue} score.
        </TooltipContent>
      </Tooltip>
    );
  }

  if (value === -1) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span>---</span>
        </TooltipTrigger>
        <TooltipContent>This player is unranked in {MetricProps[metric].name}.</TooltipContent>
      </Tooltip>
    );
  }

  if (value === 0) {
    return <span>{value}</span>;
  }

  return <FormattedNumber value={value} />;
}

function getPercentGained(metric: Metric, start: number, end: number, gained: number) {
  if (gained === 0) return 0;

  let minimum = 0;
  if (isBoss(metric) || isActivity(metric)) minimum = MetricProps[metric].minimumValue - 1;

  const startVal = Math.max(minimum, start);
  if (startVal === 0) return 1;

  return (end - startVal) / startVal;
}
