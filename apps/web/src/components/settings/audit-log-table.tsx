'use client';

import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { ScrollTextIcon } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import type { AuditActionDto, AuditLogResponse } from '@tutorio/validation';
import { DataTable } from '@/components/app/data-table';
import { ListPagination } from '@/components/app/list-controls';
import { ListSkeleton, QueryErrorAlert } from '@/components/app/page-shell';
import { Badge } from '@/components/ui/badge';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuditLogsQuery } from '@/lib/api/audit';

const ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'RESTORE'] as const;
const ENTITIES = ['STUDENT', 'GROUP', 'ENROLLMENT', 'WORKSPACE'] as const;
const ALL = 'all';

// Actions map to Badge variants — never raw colors.
const ACTION_VARIANT: Record<AuditActionDto, 'default' | 'secondary' | 'destructive' | 'outline'> =
  {
    CREATE: 'default',
    UPDATE: 'secondary',
    DELETE: 'destructive',
    RESTORE: 'outline',
  };

export function AuditLogTable() {
  const t = useTranslations('settings.audit');
  const tAction = useTranslations('auditAction');
  const tEntity = useTranslations('auditEntity');
  const format = useFormatter();

  // Audit filters are local state, not URL state: the settings page is a
  // single owner-facing screen, not a shareable list view.
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<string>(ALL);
  const [entity, setEntity] = useState<string>(ALL);

  const logs = useAuditLogsQuery({
    page,
    action: action === ALL ? undefined : (action as AuditActionDto),
    entity: entity === ALL ? undefined : (entity as (typeof ENTITIES)[number]),
  });

  const columns = useMemo<ColumnDef<AuditLogResponse, unknown>[]>(
    () => [
      {
        id: 'createdAt',
        header: () => t('columns.when'),
        cell: ({ row }) => (
          <time
            dateTime={row.original.createdAt}
            className="tabular text-muted-foreground whitespace-nowrap"
          >
            {format.dateTime(new Date(row.original.createdAt), {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </time>
        ),
      },
      {
        id: 'actor',
        header: () => t('columns.actor'),
        cell: ({ row }) =>
          row.original.actor ? (
            <div className="flex flex-col">
              <span>{row.original.actor.name}</span>
              <span className="text-muted-foreground text-xs">{row.original.actor.email}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">{t('systemActor')}</span>
          ),
      },
      {
        id: 'action',
        header: () => t('columns.action'),
        cell: ({ row }) => (
          <Badge variant={ACTION_VARIANT[row.original.action]}>
            {tAction(row.original.action)}
          </Badge>
        ),
      },
      {
        id: 'entity',
        header: () => t('columns.entity'),
        cell: ({ row }) => <span>{tEntity(row.original.entity)}</span>,
      },
      {
        id: 'changes',
        header: () => t('columns.changes'),
        cell: ({ row }) => <ChangesSummary changes={row.original.changes} />,
      },
    ],
    [t, tAction, tEntity, format],
  );

  const items = logs.data?.items ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-col gap-2">
          <Label htmlFor="audit-action">{t('filterAction')}</Label>
          <Select
            value={action}
            onValueChange={(value) => {
              setAction(value);
              setPage(1);
            }}
          >
            <SelectTrigger id="audit-action" className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={ALL}>{t('filterAll')}</SelectItem>
                {ACTIONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {tAction(value)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="audit-entity">{t('filterEntity')}</Label>
          <Select
            value={entity}
            onValueChange={(value) => {
              setEntity(value);
              setPage(1);
            }}
          >
            <SelectTrigger id="audit-entity" className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={ALL}>{t('filterAll')}</SelectItem>
                {ENTITIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {tEntity(value)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      {logs.isPending ? <ListSkeleton rows={6} /> : null}

      {logs.isError ? (
        <QueryErrorAlert
          error={logs.error}
          title={t('error.title')}
          onRetry={() => void logs.refetch()}
        />
      ) : null}

      {logs.isSuccess && items.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ScrollTextIcon />
            </EmptyMedia>
            <EmptyTitle>{t('empty.title')}</EmptyTitle>
            <EmptyDescription>{t('empty.description')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {items.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <DataTable columns={columns} data={items} caption={t('tableCaption')} />
          </div>
          <ListPagination
            page={page}
            totalPages={logs.data?.totalPages ?? 1}
            onPageChange={setPage}
          />
        </>
      ) : null}
    </div>
  );
}

// Renders a concise localized list of changed field names — never raw JSON.
function ChangesSummary({ changes }: { changes: AuditLogResponse['changes'] }) {
  const t = useTranslations('settings.audit');
  const tField = useTranslations('auditField');
  const fields = changes ? Object.keys(changes.fields) : [];

  if (fields.length === 0) {
    return <span className="text-muted-foreground">{t('noChanges')}</span>;
  }

  // Unknown field names fall back to the raw key rather than throwing.
  const labels = fields.map((field) => (tField.has(field) ? tField(field) : field));

  return <span className="text-sm">{labels.join(', ')}</span>;
}
