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
    <div className="reference-badges flex flex-wrap justify-end gap-1.5">
      {boards.map((r, i) => (
        <Badge
          key={`b-${i}`}
          title={`${r.board}${r.year ? ` • ${r.year}` : ""}`}
          className={`reference-badge ${/বোর্ড|বো\.?/i.test(r.board) ? "reference-badge--board" : "reference-badge--school"}`}
        >
          <span aria-hidden className="reference-badge__dot" />
          {r.board}{r.year ? ` '${r.year}` : ""}
        </Badge>
      ))}
      {unis.map((r, i) => (
        <Badge key={`u-${i}`} title={`${r.name} • ${r.year}`} className="reference-badge reference-badge--school">
          <span aria-hidden className="reference-badge__dot" />
          {r.name} '{r.year}
        </Badge>
      ))}
    </div>
  );
}
