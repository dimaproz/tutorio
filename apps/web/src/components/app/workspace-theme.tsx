'use client';

import { useEffect } from 'react';

interface WorkspaceThemeProps {
  primaryColor: string;
  secondaryColor: string;
  children: React.ReactNode;
}

export function WorkspaceTheme({ primaryColor, secondaryColor, children }: WorkspaceThemeProps) {
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--workspace-primary', primaryColor);
    root.style.setProperty('--workspace-secondary', secondaryColor);

    return () => {
      root.style.removeProperty('--workspace-primary');
      root.style.removeProperty('--workspace-secondary');
    };
  }, [primaryColor, secondaryColor]);

  return children;
}
