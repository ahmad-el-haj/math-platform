import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { AlertCircle, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

const FIELD_BASE =
  'w-full rounded-xl border bg-surface-2/70 px-4 text-sm text-ink placeholder:text-ink-3 ' +
  'transition-[border-color,box-shadow,background-color] duration-200 ' +
  'focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/25 ' +
  'disabled:cursor-not-allowed disabled:opacity-60'

function fieldClasses(invalid: boolean, extra?: string): string {
  return cn(
    FIELD_BASE,
    invalid ? 'border-danger/60 focus:border-danger/70 focus:ring-danger/20' : 'border-line',
    extra,
  )
}

export type FieldWrapperProps = {
  label: string
  htmlFor: string
  error?: string | undefined
  hint?: string | undefined
  required?: boolean | undefined
  children: React.ReactNode
  className?: string | undefined
}

export function FieldWrapper({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: FieldWrapperProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink-2">
        {label}
        {required ? <span className="ms-1 text-gold">*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="flex items-center gap-1.5 text-xs font-medium text-danger" role="alert">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs leading-relaxed text-ink-3">{hint}</p>
      ) : null}
    </div>
  )
}

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  label: string
  error?: string | undefined
  hint?: string | undefined
  containerClassName?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, containerClassName, className, id, required, ...props },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined

  return (
    <FieldWrapper
      label={label}
      htmlFor={inputId}
      error={error}
      hint={hint}
      required={required}
      className={containerClassName}
    >
      <input
        ref={ref}
        id={inputId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={fieldClasses(Boolean(error), cn('h-11', className))}
        {...props}
      />
    </FieldWrapper>
  )
})

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string
  error?: string | undefined
  hint?: string | undefined
  containerClassName?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, containerClassName, className, id, required, rows = 4, ...props },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <FieldWrapper
      label={label}
      htmlFor={inputId}
      error={error}
      hint={hint}
      required={required}
      className={containerClassName}
    >
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        className={fieldClasses(Boolean(error), cn('py-3 leading-relaxed', className))}
        {...props}
      />
    </FieldWrapper>
  )
})

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  error?: string | undefined
  hint?: string | undefined
  containerClassName?: string
  options: { value: string; label: string }[]
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hint, containerClassName, className, id, required, options, placeholder, ...props },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <FieldWrapper
      label={label}
      htmlFor={inputId}
      error={error}
      hint={hint}
      required={required}
      className={containerClassName}
    >
      <div className="relative">
        <select
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={error ? true : undefined}
          className={fieldClasses(Boolean(error), cn('h-11 appearance-none pe-10', className))}
          {...props}
        >
          {placeholder ? <option value="">{placeholder}</option> : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-ink-3"
          aria-hidden="true"
        />
      </div>
    </FieldWrapper>
  )
})

/** A checkbox with a label, used for the publish toggles. */
export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string
  description?: string
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, description, className, id, ...props },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <label
      htmlFor={inputId}
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface-2/50 p-3.5',
        'transition-colors hover:border-line-strong has-[:checked]:border-gold/45 has-[:checked]:bg-gold-soft',
        className,
      )}
    >
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        className="mt-0.5 size-4.5 shrink-0 accent-[var(--c-gold)]"
        {...props}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs leading-relaxed text-ink-3">{description}</span>
        ) : null}
      </span>
    </label>
  )
})
