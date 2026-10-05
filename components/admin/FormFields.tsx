"use client";

/**
 * react-hook-form + zod form field wrappers over shadcn/ui controls.
 */
import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

function FieldShell({
  label,
  hint,
  error,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <Label>{label}</Label>}
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

interface FieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label?: string;
  hint?: string;
  placeholder?: string;
  className?: string;
}

export function TextField<T extends FieldValues>({
  control,
  name,
  label,
  hint,
  placeholder,
  className,
  type = "text",
  ...rest
}: FieldProps<T> & { type?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FieldShell label={label} hint={hint} error={fieldState.error?.message} className={className}>
          <Input
            {...rest}
            type={type}
            placeholder={placeholder}
            value={field.value ?? ""}
            onChange={(e) =>
              field.onChange(
                type === "number" ? Number(e.target.value) : e.target.value
              )
            }
          />
        </FieldShell>
      )}
    />
  );
}

export function TextAreaField<T extends FieldValues>({
  control,
  name,
  label,
  hint,
  placeholder,
  className,
  rows = 4,
}: FieldProps<T> & { rows?: number }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FieldShell label={label} hint={hint} error={fieldState.error?.message} className={className}>
          <Textarea
            rows={rows}
            placeholder={placeholder}
            value={field.value ?? ""}
            onChange={field.onChange}
          />
        </FieldShell>
      )}
    />
  );
}

export function SelectField<T extends FieldValues>({
  control,
  name,
  label,
  hint,
  placeholder,
  className,
  options,
}: FieldProps<T> & { options: { value: string; label: string }[] }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FieldShell label={label} hint={hint} error={fieldState.error?.message} className={className}>
          <Select value={field.value ?? ""} onValueChange={field.onChange}>
            <SelectTrigger>
              <SelectValue placeholder={placeholder ?? "Select…"} />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldShell>
      )}
    />
  );
}

export function SwitchField<T extends FieldValues>({
  control,
  name,
  label,
  hint,
  className,
}: FieldProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <div className={cn("flex items-center justify-between gap-4", className)}>
          <div className="space-y-0.5">
            {label && <Label>{label}</Label>}
            {fieldState.error?.message ? (
              <p className="text-xs text-destructive">{fieldState.error.message}</p>
            ) : hint ? (
              <p className="text-xs text-muted-foreground">{hint}</p>
            ) : null}
          </div>
          <Switch checked={!!field.value} onCheckedChange={field.onChange} />
        </div>
      )}
    />
  );
}
