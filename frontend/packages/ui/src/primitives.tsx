'use client';

import { Button, Input, Label, TextField } from '@heroui/react';
import type { ComponentProps, ReactNode } from 'react';

type BtnProps = ComponentProps<typeof Button>;

export function PrimaryButton(props: BtnProps) {
  return <Button variant="primary" size="md" {...props} />;
}

export function SecondaryButton(props: BtnProps) {
  return <Button variant="secondary" size="md" {...props} />;
}

export function FieldInput({
  label,
  description,
  className,
  ...props
}: ComponentProps<typeof Input> & {
  label?: string;
  description?: string;
}) {
  if (label) {
    return (
      <TextField className={className}>
        <Label>{label}</Label>
        <Input {...props} />
        {description ? (
          <p className="text-xs text-muted">{description}</p>
        ) : null}
      </TextField>
    );
  }
  return <Input className={className} {...props} />;
}

export function FormActions({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
      {children}
    </div>
  );
}
