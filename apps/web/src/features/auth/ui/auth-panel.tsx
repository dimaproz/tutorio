import type { ReactNode } from 'react';

interface AuthPanelProps {
  title: string;
  description: string;
  footer: ReactNode;
  children: ReactNode;
}

/** The heading, form and footer link of an authentication screen. */
export function AuthPanel({ title, description, footer, children }: AuthPanelProps) {
  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <div className="flex flex-col gap-2 md:gap-2.5">
        <h1 className="text-[30px] leading-[34px] font-semibold tracking-[-0.03em] md:text-[40px] md:leading-[44px] md:tracking-[-0.035em]">
          {title}
        </h1>
        <p className="text-[15px] leading-[22px] text-muted-foreground md:text-base md:leading-6">
          {description}
        </p>
      </div>
      {children}
      <div className="text-center text-sm leading-5 text-muted-foreground">{footer}</div>
    </div>
  );
}
