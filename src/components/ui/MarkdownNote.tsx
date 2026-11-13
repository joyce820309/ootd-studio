import type { ReactNode } from 'react'

type NoteBlock =
  | { kind: 'paragraph'; lines: string[] }
  | { kind: 'unordered' | 'ordered'; lines: string[] }

function listKind(line: string): NoteBlock['kind'] | null {
  if (/^\s*[-*]\s+/.test(line)) return 'unordered'
  if (/^\s*\d+\s+/.test(line)) return 'ordered'
  return null
}

function listText(line: string, kind: NoteBlock['kind']) {
  return kind === 'unordered'
    ? line.replace(/^\s*[-*]\s+/, '')
    : line.replace(/^\s*\d+\s+/, '')
}

function renderInline(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  const pattern = /(\*\*.+?\*\*|__.+?__)/g
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text))) {
    if (match.index > cursor) parts.push(text.slice(cursor, match.index))
    parts.push(<strong key={`${match.index}-${match[0]}`}>{match[0].slice(2, -2)}</strong>)
    cursor = match.index + match[0].length
  }

  if (cursor < text.length) parts.push(text.slice(cursor))
  return parts
}

function parseBlocks(value: string): NoteBlock[] {
  const lines = value.replace(/\r\n?/g, '\n').split('\n')
  const blocks: NoteBlock[] = []

  for (let index = 0; index < lines.length;) {
    if (!lines[index].trim()) {
      index += 1
      continue
    }

    const kind = listKind(lines[index])
    if (kind) {
      const items: string[] = []
      while (index < lines.length && listKind(lines[index]) === kind) {
        items.push(listText(lines[index], kind))
        index += 1
      }
      blocks.push({ kind, lines: items })
      continue
    }

    const paragraph: string[] = []
    while (index < lines.length && lines[index].trim() && !listKind(lines[index])) {
      paragraph.push(lines[index])
      index += 1
    }
    blocks.push({ kind: 'paragraph', lines: paragraph })
  }

  return blocks
}

export function MarkdownNote({ value, className = '' }: { value: string; className?: string }) {
  if (!value) return null

  return (
    <div className={`markdown-note min-w-0 space-y-1.5 break-words [overflow-wrap:anywhere] ${className}`}>
      {parseBlocks(value).map((block, blockIndex) => {
        if (block.kind === 'paragraph') {
          return (
            <p key={`p-${blockIndex}`} className="m-0">
              {block.lines.map((line, lineIndex) => (
                <span key={lineIndex}>
                  {lineIndex > 0 && <br />}
                  {renderInline(line)}
                </span>
              ))}
            </p>
          )
        }

        const List = block.kind === 'ordered' ? 'ol' : 'ul'
        return (
          <List key={`${block.kind}-${blockIndex}`} className={`m-0 space-y-0.5 pl-5 ${block.kind === 'ordered' ? 'list-decimal' : 'list-disc'}`}>
            {block.lines.map((line, lineIndex) => <li key={lineIndex}>{renderInline(line)}</li>)}
          </List>
        )
      })}
    </div>
  )
}

export function MarkdownNoteField({
  id,
  value,
  onChange,
  rows = 3,
  placeholder,
  className = '',
}: {
  id: string
  value: string
  onChange: (value: string) => void
  rows?: number
  placeholder?: string
  className?: string
}) {
  const helpId = `${id}-markdown-help`

  return (
    <div className="markdown-note-field min-w-0 space-y-1.5">
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        placeholder={placeholder}
        aria-describedby={helpId}
        className={className}
      />
      <p id={helpId} className="m-0 text-xs leading-5 text-ink-2">
        Enter 換行；支援 <strong>粗體</strong>（**文字**）、- 項目、1 有序項目。
      </p>
    </div>
  )
}