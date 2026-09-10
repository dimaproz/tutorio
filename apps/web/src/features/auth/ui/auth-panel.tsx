import type { ReactNode } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface AuthPanelProps {
  title: string;
  description: string;
  footer: ReactNode;
  children: ReactNode;
}

export function AuthPanel({ title, description, footer, children }: AuthPanelProps) {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
      <CardFooter className="justify-center text-center">{footer}</CardFooter>
    </Card>
  );
}
