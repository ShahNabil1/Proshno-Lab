import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import CreateModeToggle, { type CreateMode } from "@/components/dashboard/CreateModeToggle";
import QuestionCreate from "./QuestionCreate";
import AutoQuestionCreate from "./AutoQuestionCreate";
import Packages from "./Packages";

export default function QuestionCreateHub() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [manualQuestionListOpen, setManualQuestionListOpen] = useState(false);
  const raw = (params.get("mode") as CreateMode) || "auto";
  const mode: CreateMode = ["manual", "auto", "ready"].includes(raw) ? raw : "auto";

  // If "add_to_paper" query is present, always show manual (existing flow depends on it).
  const forceManual = params.get("add_to_paper") === "true";
  const activeMode: CreateMode = forceManual ? "manual" : mode;

  const setMode = (nextMode: CreateMode) => {
    // Entering manual mode from the create hub always starts a brand-new set.
    // Preview → browser Back still restores the current draft because this
    // handler is not involved in that history navigation.
    if (nextMode === "manual" && activeMode !== "manual") {
      sessionStorage.removeItem("questionCreateDraft");
      sessionStorage.removeItem("questionCreateDraft:v2:manual");
    }
    // Explicit navigation pushes a real history entry, so browser Back from
    // ?mode=manual reliably returns to the clean create hub URL.
    navigate(`/dashboard/create?mode=${nextMode}`);
  };

  return (
    <div className="space-y-4">
      {!forceManual && !(activeMode === "manual" && manualQuestionListOpen) && (
        <CreateModeToggle mode={activeMode} onChange={setMode} />
      )}
      {activeMode === "manual" && <QuestionCreate onQuestionListChange={setManualQuestionListOpen} />}
      {activeMode === "auto" && <AutoQuestionCreate />}
      {activeMode === "ready" && <Packages />}
    </div>
  );
}
