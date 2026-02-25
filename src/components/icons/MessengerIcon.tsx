export default function MessengerIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C5.36 0 0 4.86 0 10.87c0 3.42 1.67 6.47 4.28 8.47V24l4.47-2.45c1.19.33 2.45.51 3.75.51 6.64 0 12-4.86 12-10.87S18.64 0 12 0zm1.19 14.63l-3.06-3.26-5.97 3.26L10.73 8l3.13 3.26L19.71 8l-6.52 6.63z"/>
    </svg>
  );
}
