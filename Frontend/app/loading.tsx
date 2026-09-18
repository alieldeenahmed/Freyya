export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="flex flex-1 items-center justify-center px-6 py-24"
    >
      <div className="skeleton h-px w-24" />
    </div>
  );
}
