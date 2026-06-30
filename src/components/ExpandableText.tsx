import { useState } from 'react';

type ExpandableTextProps = {
  readonly text: string;
  readonly maxLength?: number;
};

export function ExpandableText({ text, maxLength = 120 }: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > maxLength;
  const visibleText = !expanded && isLong ? text.slice(0, maxLength) : text;

  const handleToggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    // Prevent the parent card/button from triggering navigation
    event.stopPropagation();
    setExpanded((v) => !v);
  };

  return (
    <div className="expandable-text">
      <p>
        {visibleText}
        {!expanded && isLong ? '\u2026' : ''}
      </p>
      {isLong && (
        <button
          type="button"
          className="expandable-text-button"
          onClick={handleToggle}
        >
          {expanded ? '접기' : '더보기'}
        </button>
      )}
    </div>
  );
}
