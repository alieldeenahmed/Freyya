export default function Footer() {
  return (
    <footer className="border-t border-secondary/40 px-6 py-10 sm:px-10">
      <div className="flex flex-col gap-4 text-sm text-text/70 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-serif text-lg text-text">Freyya</p>
        <p>Formulated with intention. Nothing else.</p>
        <p>&copy; {new Date().getFullYear()} Freyya</p>
      </div>
    </footer>
  );
}
