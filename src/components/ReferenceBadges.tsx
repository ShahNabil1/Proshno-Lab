import { Badge } from "@/components/ui/badge";

interface ReferenceBadgesProps {
  boardRefs?: Array<{ board: string; year: string }> | null;
  uniRefs?: Array<{ name: string; year: string }> | null;
}

export default function ReferenceBadges({ boardRefs, uniRefs }: ReferenceBadgesProps) {
  const boards = Array.isArray(boardRefs) ? boardRefs : [];
  const unis = Array.isArray(uniRefs) ? uniRefs : [];

  if (boards.length === 0 && unis.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {boards.map((r, i) => (
        <Badge key={`b-${i}`} className="bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200 dark:bg-amber-900 dark:text-amber-100 dark:border-amber-700 text-[11px] font-medium">
          {r.board} '{r.year}
        </Badge>
      ))}
      {unis.map((r, i) => (
        <Badge key={`u-${i}`} className="bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200 dark:bg-amber-900 dark:text-amber-100 dark:border-amber-700 text-[11px] font-medium">
          {r.name} '{r.year}
        </Badge>
      ))}
    </div>
  );
}
