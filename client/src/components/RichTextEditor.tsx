import React, { useRef, useEffect, useCallback } from 'react';
import { Box } from '@mui/material';

// ── Plain-text ↔ HTML conversion ─────────────────────────────────────────────

const escHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const applyInline = (s: string) =>
  s.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/_(.*?)_/g, '<em>$1</em>');

/** Convert stored plain text → contentEditable HTML */
const plainToHtml = (text: string): string => {
  if (!text) return '';
  // Already HTML (from a previous save after using the editor)
  if (/<(strong|em|b|i|ul|ol|li|div|br)\b/i.test(text)) return text;

  const lines = text.split('\n');
  const out: string[] = [];
  let inUl = false;
  let inOl = false;

  const closeUl = () => { if (inUl) { out.push('</ul>'); inUl = false; } };
  const closeOl = () => { if (inOl) { out.push('</ol>'); inOl = false; } };

  for (const raw of lines) {
    const line = applyInline(escHtml(raw));
    const bulletMatch = raw.match(/^[•*-]\s+(.*)/);
    const numMatch    = raw.match(/^\d+\.\s+(.*)/);

    if (bulletMatch) {
      closeOl();
      if (!inUl) { out.push('<ul>'); inUl = true; }
      out.push(`<li>${applyInline(escHtml(bulletMatch[1]))}</li>`);
    } else if (numMatch) {
      closeUl();
      if (!inOl) { out.push('<ol>'); inOl = true; }
      out.push(`<li>${applyInline(escHtml(numMatch[1]))}</li>`);
    } else {
      closeUl();
      closeOl();
      out.push(`<div>${line || '<br>'}</div>`);
    }
  }
  closeUl();
  closeOl();
  return out.join('');
};

/** Convert contentEditable HTML → stored plain text */
const htmlToPlain = (html: string): string => {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  let olIdx = 0;

  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
    const el  = node as Element;
    const tag = el.tagName?.toLowerCase() ?? '';
    const kids = () => Array.from(node.childNodes).map(walk).join('');

    if (tag === 'br')                    return '';
    if (tag === 'strong' || tag === 'b') return `**${kids()}**`;
    if (tag === 'em'     || tag === 'i') return `_${kids()}_`;
    if (tag === 'ol')  { olIdx = 0;      return kids(); }
    if (tag === 'ul')                    return kids();
    if (tag === 'li') {
      const par = el.parentElement?.tagName?.toLowerCase();
      const prefix = par === 'ol' ? `${++olIdx}. ` : '• ';
      // nested list items keep their own prefix; outer newline is added by parent walk
      const content = Array.from(node.childNodes).map(walk).join('');
      return `${prefix}${content.trim()}\n`;
    }
    if (tag === 'div' || tag === 'p') return kids() + '\n';
    return kids();
  };

  return walk(tmp).replace(/\n$/, '');
};

// ── Toolbar button ────────────────────────────────────────────────────────────
const Btn: React.FC<{
  icon: string;
  label: string;
  onMouseDown: (e: React.MouseEvent) => void;
  active?: boolean;
}> = ({ icon, label, onMouseDown, active }) => (
  <Box
    component="button"
    type="button"
    onMouseDown={onMouseDown}
    sx={{
      display: 'flex', alignItems: 'center', gap: '0.3rem',
      px: '0.625rem', py: '0.3rem', borderRadius: '0.375rem',
      border: '1px solid', cursor: 'pointer',
      fontSize: '0.8125rem', fontWeight: 500,
      borderColor: active ? '#4F46E5' : '#E5E7EB',
      background:  active ? 'rgba(79,70,229,0.08)' : '#fff',
      color:       active ? '#4F46E5' : '#374151',
      '&:hover': { background: '#F3F4F6', borderColor: '#D1D5DB' },
    }}
  >
    <i className={`fas ${icon}`} style={{ fontSize: '0.7rem' }} />
    {label}
  </Box>
);

// ── Component ─────────────────────────────────────────────────────────────────
interface RichTextEditorProps {
  value: string;
  onChange: (plain: string) => void;
  placeholder?: string;
  minHeight?: number;
  extraToolbar?: React.ReactNode;
  sx?: object;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Write something…',
  minHeight = 120,
  extraToolbar,
  sx = {},
}) => {
  const editorRef  = useRef<HTMLDivElement>(null);
  const isFocused  = useRef(false);
  const lastPlain  = useRef('');

  // ── Sync parent → editor when not focused ───────────────────────────────────
  useEffect(() => {
    if (isFocused.current || value === lastPlain.current) return;
    lastPlain.current = value;
    const html = plainToHtml(value);
    const el = editorRef.current;
    if (el && el.innerHTML !== html) el.innerHTML = html;
  }, [value]);

  // ── Emit plain-text to parent ────────────────────────────────────────────────
  const emit = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const plain = htmlToPlain(el.innerHTML);
    if (plain === lastPlain.current) return;
    lastPlain.current = plain;
    onChange(plain);
  }, [onChange]);

  // ── Exec helpers (onMouseDown preserves selection/focus) ────────────────────
  const cmd = (command: string, value?: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    emit();
  };

  // ── Tab key: indent/unindent list items ─────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      document.execCommand(e.shiftKey ? 'outdent' : 'indent', false);
      emit();
    }
  };

  return (
    <Box sx={{ ...sx }}>
      {/* ── Toolbar ── */}
      <Box sx={{ display: 'flex', gap: '0.4rem', mb: '0.625rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <Btn icon="fa-bold"            label="Bold"       onMouseDown={cmd('bold')} />
        <Btn icon="fa-italic"          label="Italic"     onMouseDown={cmd('italic')} />
        <Btn icon="fa-list-ul"         label="• Bullet"   onMouseDown={cmd('insertUnorderedList')} />
        <Btn icon="fa-list-ol"         label="1. Number"  onMouseDown={cmd('insertOrderedList')} />

        {extraToolbar}
      </Box>

      {/* ── Editor ── */}
      <Box
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onFocus={() => { isFocused.current = true; }}
        onBlur={() => { isFocused.current = false; emit(); }}
        onInput={emit}
        onKeyDown={handleKeyDown}
        sx={{
          minHeight,
          border: '1px solid #E5E7EB',
          borderRadius: '0.5rem',
          p: '0.75rem 1rem',
          outline: 'none',
          fontSize: '0.9375rem',
          lineHeight: 1.7,
          color: '#1F2937',
          cursor: 'text',
          wordBreak: 'break-word',
          // Placeholder
          '&:not(:focus)[data-placeholder]:empty::before': {
            content: 'attr(data-placeholder)',
            color: '#9CA3AF',
            pointerEvents: 'none',
            display: 'block',
            whiteSpace: 'pre-line',
          },
          '&:focus': {
            borderColor: '#4F46E5',
            boxShadow: '0 0 0 2px rgba(79,70,229,0.12)',
          },
          // Actual list styling
          '& ul': { paddingLeft: '1.5rem', marginTop: '0.25rem', marginBottom: '0.25rem', listStyleType: 'disc' },
          '& ol': { paddingLeft: '1.5rem', marginTop: '0.25rem', marginBottom: '0.25rem', listStyleType: 'decimal' },
          '& li': { marginBottom: '0.125rem' },
          '& ul ul': { listStyleType: 'circle' },
          '& ul ul ul': { listStyleType: 'square' },
          // Inline formatting
          '& strong, & b': { fontWeight: 700 },
          '& em, & i': { fontStyle: 'italic' },
          // Divs / paragraphs
          '& div': { minHeight: '1.4em' },
        }}
      />
      <Box sx={{ mt: '0.375rem', fontSize: '0.75rem', color: '#9CA3AF' }}>
        Tip: Enter continues a list · Tab to indent · Shift+Tab to outdent list items
      </Box>
    </Box>
  );
};

export default RichTextEditor;
