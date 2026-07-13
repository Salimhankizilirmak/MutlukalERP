"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { startBlindCount } from "@/actions/sayim";
import { toast } from "sonner";

interface Props {
  categoryId: string;
  categoryName: string;
}

export default function BlindCountButton({ categoryId, categoryName }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleStart = () => {
    startTransition(async () => {
      const result = await startBlindCount(categoryId);
      if (result.error) {
        toast.error(result.error);
        if (result.id) {
          router.push(`/dashboard/sayim/${result.id}`);
        }
      } else if (result.id) {
        toast.success(`${categoryName} için yeni kör sayım başlatıldı.`);
        router.push(`/dashboard/sayim/${result.id}`);
      }
    });
  };

  return (
    <button
      onClick={handleStart}
      disabled={isPending}
      className="flex items-center gap-1.5 px-3 py-2 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-400 rounded-xl text-xs font-semibold transition-all active:scale-95 disabled:opacity-50"
    >
      {isPending ? (
        <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/><line x1="3" y1="3" x2="21" y2="21"/>
        </svg>
      )}
      Kör Sayım Başlat
    </button>
  );
}
