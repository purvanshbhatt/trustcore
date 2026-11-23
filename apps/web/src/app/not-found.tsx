import Link from 'next/link';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center p-6 space-y-4">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 text-amber-400">
        <ShieldAlert className="h-7 w-7" />
      </div>
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-white">Page Not Found</h2>
        <p className="text-xs text-zinc-400 max-w-sm">
          The requested security audit route or report ID does not exist or has been archived.
        </p>
      </div>
      <Link
        href="/"
        className="inline-flex items-center space-x-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition shadow"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Return to Overview Hub</span>
      </Link>
    </div>
  );
}
