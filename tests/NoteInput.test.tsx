import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NoteInput from '@/features/notes/components/NoteInput';
import { useState } from 'react';

describe('NoteInput', () => {
  it('does not show AI button when no noteId and empty content', () => {
    const onAdd = vi.fn();
    render(<NoteInput onAdd={onAdd} />);
    expect(screen.queryByRole('button', { name: 'AI 摘要' })).toBeNull();
  });

  it('shows AI button when content is non-empty', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<NoteInput onAdd={onAdd} />);

    const textarea = screen.getAllByRole('textbox')[0];
    await user.type(textarea, 'Hello world');
    expect(screen.getByRole('button', { name: /AI 摘要/ })).toBeInTheDocument();
  });

  it('hides AI button again when content is cleared and noteId is undefined', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<NoteInput onAdd={onAdd} />);

    const textarea = screen.getAllByRole('textbox')[0];
    await user.type(textarea, 'temporary content');
    expect(screen.getByRole('button', { name: /AI 摘要/ })).toBeInTheDocument();

    await user.clear(textarea);
    expect(screen.queryByRole('button', { name: 'AI 摘要' })).toBeNull();
  });

  it('shows AI button disabled when noteId is undefined but content exists', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<NoteInput onAdd={onAdd} />);

    const textarea = screen.getAllByRole('textbox')[0];
    await user.type(textarea, 'some content');

    const aiBtn = screen.getByRole('button', { name: /AI 摘要/ });
    expect(aiBtn).toBeInTheDocument();
    expect(aiBtn).toBeDisabled();
  });

  it('shows AI button when noteId exists even with empty content', () => {
    const onAdd = vi.fn();
    render(<NoteInput onAdd={onAdd} noteId={123} />);
    const aiBtn = screen.getByRole('button', { name: /AI 摘要/ });
    expect(aiBtn).toBeInTheDocument();
    expect(aiBtn).not.toBeDisabled();
  });

  it('clicking AI button triggers generateSummary when noteId exists', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    const spy = vi
      .spyOn((window as any).electronAPI, 'generateSummary')
      .mockResolvedValue({ success: true, summary: 'ok' });

    render(<NoteInput onAdd={onAdd} noteId={7} />);

    const textarea = screen.getAllByRole('textbox')[0];
    await user.clear(textarea);
    await user.type(textarea, 'abc');

    const aiBtn = await screen.findByRole('button', { name: /AI 摘要/ });
    await user.click(aiBtn);

    expect(spy).toHaveBeenCalledWith({ id: 7, content: 'abc' });
  });

  it('new note flow: starts without noteId, shows disabled AI button with content, then enabled after save assigns id', async () => {
    const user = userEvent.setup();

    const Wrapper = () => {
      const [id, setId] = useState<number | undefined>(undefined);
      const handleAdd = vi.fn().mockImplementation(async () => {
        // simulate backend creating note and parent receiving id
        setId(101);
      });
      return (
        <NoteInput noteId={id} onAdd={handleAdd} onRefresh={vi.fn()} />
      );
    };

    render(<Wrapper />);

    const textarea = screen.getAllByRole('textbox')[0];
    await user.type(textarea, 'hello');

    // AI button visible but disabled because noteId is undefined
    const aiBtn = screen.getByRole('button', { name: /AI 摘要/ });
    expect(aiBtn).toBeDisabled();

    // Save, which updates parent to provide a noteId
    await user.click(screen.getByRole('button', { name: /儲存/ }));

    // After re-render with noteId, AI button becomes enabled
    await screen.findByRole('button', { name: /AI 摘要/ });
    expect(screen.getByRole('button', { name: /AI 摘要/ })).not.toBeDisabled();
  });

  it('after save (has noteId) the AI button stays visible and enabled even if content is cleared, and clicking calls generateSummary', async () => {
    const user = userEvent.setup();

    const spy = vi
      .spyOn((window as any).electronAPI, 'generateSummary')
      .mockResolvedValue({ success: true, summary: 'ok' });

    const Wrapper = () => {
      const [id, setId] = useState<number | undefined>(undefined);
      const handleAdd = vi.fn().mockImplementation(async () => {
        setId(202); // simulate backend returning id
      });
      return (
        <NoteInput noteId={id} onAdd={handleAdd} onRefresh={vi.fn()} />
      );
    };

    render(<Wrapper />);

    const textarea = screen.getAllByRole('textbox')[0];
    await user.type(textarea, 'note to save');

    // Save; NoteInput clears content and parent provides noteId
    await user.click(screen.getByRole('button', { name: /儲存/ }));

    // After save: content cleared, but button remains visible and enabled because noteId exists
    const aiBtn = await screen.findByRole('button', { name: /AI 摘要/ });
    expect(aiBtn).toBeInTheDocument();
    expect(aiBtn).not.toBeDisabled();

    // Clicking calls generateSummary with id and current (cleared) content
    await user.click(aiBtn);
    expect(spy).toHaveBeenCalledWith({ id: 202, content: '' });
  });

  it('submits content/tags/type via onAdd and resets inputs', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const onRefresh = vi.fn();
    render(<NoteInput onAdd={onAdd} onRefresh={onRefresh} />);

    // Default type is text
    const textarea = screen.getAllByRole('textbox')[0];
    await user.type(textarea, 'New note');

    const tagsInput = screen.getByPlaceholderText('輸入標籤（用逗號分隔）');
    await user.type(tagsInput, 'tag1,tag2');

    await user.click(screen.getByRole('button', { name: /儲存/ }));

    expect(onAdd).toHaveBeenCalledWith('New note', 'tag1,tag2', 'text');
    expect(onRefresh).toHaveBeenCalled();

    // Inputs should be cleared after submit
    expect((textarea as HTMLTextAreaElement).value).toBe('');
    expect((tagsInput as HTMLInputElement).value).toBe('');
  });

  // URL type toggle not required for current UI; handled automatically by content detection.
});
