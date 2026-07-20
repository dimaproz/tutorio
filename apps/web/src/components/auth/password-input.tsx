'use client';

import { useState } from 'react';
import { EyeIcon, EyeOffIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';

type PasswordInputProps = Omit<React.ComponentProps<typeof InputGroupInput>, 'type'>;

export function PasswordInput(props: PasswordInputProps) {
  const t = useTranslations('auth.login');
  const [visible, setVisible] = useState(false);

  return (
    <InputGroup>
      <InputGroupInput type={visible ? 'text' : 'password'} {...props} />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={visible ? t('hidePassword') : t('showPassword')}
          aria-pressed={visible}
          onClick={() => setVisible((value) => !value)}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}
