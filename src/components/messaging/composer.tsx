import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type ComposerProps = {
  onSend: (body: string) => Promise<void> | void
  disabled?: boolean
  placeholder?: string
  maxLength?: number
}

/**
 * Message composer.
 *
 * Enter sends the message, Shift+Enter inserts a newline. The send button is
 * disabled while a request is in flight so a message can never be submitted
 * twice by accident.
 */
export function Composer({
  onSend,
  disabled = false,
  placeholder = 'اكتب رسالتك…',
  maxLength = 4000,
}: ComposerProps) {
  const [value, setValue] = useState('')
  const [sending, setSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const submit = async () => {
    const body = value.trim()
    if (!body || sending || disabled) return

    setSending(true)
    try {
      await onSend(body)
      setValue('')
      textareaRef.current?.focus()
    } finally {
      setSending(false)
    }
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    void submit()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void submit()
    }
  }

  const remaining = maxLength - value.length

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-2 rounded-2xl border border-line bg-surface-2/60 p-2 transition-colors focus-within:border-gold/45"
    >
      <div className="relative flex-1">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          maxLength={maxLength}
          disabled={disabled}
          placeholder={placeholder}
          aria-label="نص الرسالة"
          className="max-h-40 min-h-11 w-full resize-none bg-transparent px-3 py-2.5 text-sm leading-relaxed text-ink placeholder:text-ink-3 focus:outline-none disabled:opacity-60"
        />
        {remaining < 200 ? (
          <span className="tabular pointer-events-none absolute bottom-1.5 end-2 text-[10px] text-ink-3">
            {remaining}
          </span>
        ) : null}
      </div>

      <Button
        type="submit"
        size="icon"
        variant="primary"
        loading={sending}
        disabled={disabled || value.trim().length === 0}
        aria-label="إرسال الرسالة"
        className="size-11 shrink-0"
      >
        {!sending ? <Send className="size-4" aria-hidden="true" /> : null}
      </Button>
    </form>
  )
}
