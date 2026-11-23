import { useId } from "react";
import { isContextSize } from "@/chat/document";

interface ChatContextSettingProps {
  value?: number;
  disabled: boolean;
  onChange: (value: number | undefined) => void;
}

export function ChatContextSetting({ value, disabled, onChange }: ChatContextSettingProps) {
  const id = useId();
  const hintId = `${id}-hint`;

  return (
    <>
      <label htmlFor={id}>Context window (tokens)</label>
      <input id={id} type="number" min={1} step={1}
        value={value ?? ""} placeholder="Server default" disabled={disabled}
        aria-describedby={hintId}
        onChange={event => {
          const input = event.currentTarget;
          if (input.validity.badInput) return;
          if (input.value === "") onChange(undefined);
          else if (isContextSize(input.valueAsNumber)) onChange(input.valueAsNumber);
        }} />
      <p id={hintId} className="chatbot-hint">Leave blank to use the server default. Larger windows give long chats more room and use more memory. Your inference server must support this setting.</p>
    </>
  );
}
