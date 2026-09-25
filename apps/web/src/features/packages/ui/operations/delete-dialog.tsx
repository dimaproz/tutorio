'use client';

import { useState } from 'react';
import { InfoIcon, LockIcon, Trash2Icon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { PaymentResponse } from '@tutorio/validation';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { AdaptiveDialog } from '@/components/shared/adaptive-dialog';
import { ImpactList } from '@/components/shared/impact-list';
import type { GatewayError } from '@/lib/auth/client';
import { useDeletePackageMutation } from '../../api';
import { deletable } from '../../model/ticket';
import { useErrorToast } from '../form-parts';
import type { OperationProps } from './operation-props';

/**
 * «Видалити пакет?» (board 03, states 07–08): only a package with no
 * charged lesson and no payment disappears (decision 9); otherwise the
 * dialog says why it cannot and offers «Повернути невикористане». The API
 * answers PACKAGE_IN_USE when the ticket was stale, and the dialog turns.
 */
export function DeleteDialog({
  pkg,
  title,
  payments,
  onClose,
  onDone,
  onRefund,
}: OperationProps & { payments: readonly PaymentResponse[]; onRefund: () => void }) {
  const t = useTranslations('packages.dialogs.delete');
  const tDialogs = useTranslations('packages.dialogs');
  const [blocked, setBlocked] = useState(!deletable(pkg, payments));
  const remove = useDeletePackageMutation();
  const showError = useErrorToast();
  const subtitle = tDialogs('subtitle', { name: title, student: pkg.student.fullName });

  const confirm = () =>
    remove.mutate(pkg.id, {
      onSuccess: () => {
        toast.success(t('done', { name: title }));
        onDone();
      },
      onError: (error) => {
        if ((error as GatewayError).code === 'PACKAGE_IN_USE') setBlocked(true);
        else showError(error);
      },
    });

  if (blocked) {
    return (
      <AdaptiveDialog
        open
        onOpenChange={(next) => (next ? undefined : onClose())}
        closeLabel={tDialogs('close')}
        icon={<Trash2Icon />}
        iconClassName="bg-tint-danger text-tint-danger-foreground"
        title={t('blockedTitle')}
        description={subtitle}
        secondary={
          <Button type="button" variant="outline" onClick={onClose}>
            {tDialogs('close')}
          </Button>
        }
        primary={
          <Button type="button" onClick={onRefund}>
            {t('refund')}
          </Button>
        }
      >
        <ImpactList
          items={[
            {
              id: 'blocked',
              icon: <LockIcon />,
              tone: 'warning',
              title:
                pkg.consumedCredits > 0
                  ? t('blockedCharged', { count: pkg.consumedCredits })
                  : t('blockedPaid'),
              text: t('blockedText'),
            },
          ]}
        />
      </AdaptiveDialog>
    );
  }

  return (
    <AdaptiveDialog
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      closeLabel={tDialogs('close')}
      icon={<Trash2Icon />}
      iconClassName="bg-tint-danger text-tint-danger-foreground"
      title={t('title')}
      description={subtitle}
      secondary={
        <Button type="button" variant="outline" onClick={onClose}>
          {tDialogs('cancel')}
        </Button>
      }
      primary={
        <Button type="button" variant="destructive" disabled={remove.isPending} onClick={confirm}>
          {remove.isPending ? <Spinner data-icon="inline-start" /> : null}
          {t('confirm')}
        </Button>
      }
    >
      <ImpactList
        items={[
          {
            id: 'gone',
            icon: <Trash2Icon />,
            tone: 'danger',
            title: t('gone', { name: title }),
            text: t('goneText'),
          },
          { id: 'final', icon: <InfoIcon />, tone: 'neutral', title: t('final') },
        ]}
      />
    </AdaptiveDialog>
  );
}
