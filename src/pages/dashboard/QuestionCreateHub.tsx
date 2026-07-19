import { useSearchParams } from "react-router-dom";
import CreateModeToggle, { CreateMode } from "@/components/dashboard/CreateModeToggle";
import QuestionCreate from "./QuestionCreate";
import AutoQuestionCreate from "./AutoQuestionCreate";
import Packages from "./Packages";

export default function QuestionCreateHub() {
  const [params, setParams] = useSearchParams();
  const raw = (params.get("mode") as CreateMode) || "auto";
  const mode: CreateMode = ["auto", "manual", "ready"].includes(raw) ? raw : "auto";

  // If "add_to_paper" query is present, always show manual (existing flow depends on it).
  const forceManual = params.get("add_to_paper") === "true";
  const activeMode: CreateMode = forceManual ? "manual" : mode;

  const setMode = (m: CreateMode) => {
    const next = new URLSearchParams(params);
    next.set("mode", m);
    next.delete("add_to_paper");
    setParams(next, { replace: true });
  };

  return (
    <div>
      {!forceManual && <CreateModeToggle mode={activeMode} onChange={setMode} />}
      {activeMode === "auto" && <AutoQuestionCreate />}
      {activeMode === "manual" && <QuestionCreate />}
      {activeMode === "ready" && <Packages />}
    </div>
  );
}
