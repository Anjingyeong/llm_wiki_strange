type WikiNavIconName = 'task' | 'document' | 'chevron';

type WikiNavIconProps = {
  readonly name: WikiNavIconName;
  readonly expanded?: boolean;
};

export function WikiNavIcon({ name, expanded = false }: WikiNavIconProps) {
  if (name === 'task') {
    return (
      <svg aria-hidden="true" fill="none" focusable="false" viewBox="0 0 24 24">
        <path d="M4 6.5h16M4 12h16M4 17.5h10" />
        <circle cx="18" cy="17.5" r="2" />
      </svg>
    );
  }

  if (name === 'document') {
    return (
      <svg aria-hidden="true" fill="none" focusable="false" viewBox="0 0 24 24">
        <path d="M7 3.5h7l4 4V20.5H7z" />
        <path d="M14 3.5v4h4M10 12h5M10 16h5" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      className={expanded ? 'navChevron expanded' : 'navChevron'}
      fill="none"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
