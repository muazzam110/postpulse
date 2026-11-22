export function PageHeader({ title, description }) {
  return (
    <div className="mb-8 animate-fade-up">
      <h1 className="text-[26px] leading-8 md:text-[32px] md:leading-[38px]">{title}</h1>
      {description && <p className="mt-2 max-w-prose text-ink-2">{description}</p>}
    </div>
  );
}
