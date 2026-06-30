export default function Card({ children, className = '' }) {
  return (
    <section className={`rounded-lg border border-slate-100 bg-white p-4 shadow-sm ${className}`}>
      {children}
    </section>
  );
}
