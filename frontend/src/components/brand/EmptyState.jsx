export function EmptyState({ icon: Icon, title, description, children }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center py-16 text-center animate-fade-up">
      {Icon && (
        <span className="mb-4 flex size-12 items-center justify-center rounded-full border border-line bg-surface text-ink-2">
          <Icon strokeWidth={1.5} className="size-5" />
        </span>
      )}
      <h2 className="text-xl">{title}</h2>
      {description && <p className="mt-2 text-ink-2">{description}</p>}
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}
