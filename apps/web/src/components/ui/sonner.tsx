'use client';

import { useTheme } from 'next-themes';
import { Toaster as Sonner, type ToasterProps } from 'sonner';
import { CheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from 'lucide-react';

// The Studio toast is an ink pill in both themes: a painted surface with its
// own foreground, a green check disc for success and a quiet close control.
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      position="bottom-center"
      closeButton
      icons={{
        success: (
          <span className="flex size-7 items-center justify-center rounded-pill bg-success text-white">
            <CheckIcon className="size-4" strokeWidth={2.5} />
          </span>
        ),
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          '--normal-bg': 'var(--ink)',
          '--normal-text': 'var(--ink-foreground)',
          '--normal-border': 'var(--ink)',
          '--border-radius': 'var(--radius-tile)',
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            'cn-toast w-auto! max-w-[calc(100vw-32px)]! gap-3! rounded-tile! py-3! pr-3.5! pl-3! shadow-toast!',
          title: 'text-sm! leading-5! font-medium!',
          description: 'text-[13px]! text-ink-muted!',
          icon: 'm-0! size-7! flex! items-center! justify-center!',
          // The close control sits on the trailing edge like the reference, not
          // on the corner badge sonner draws by default.
          closeButton:
            'static! order-last! ml-1! size-6! translate-none! border-0! bg-transparent! text-ink-muted! transition-colors duration-150 hover:bg-white/10! hover:text-ink-foreground!',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
