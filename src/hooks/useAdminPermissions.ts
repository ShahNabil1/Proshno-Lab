import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AdminPermission {
  class_id: number;
  subject_id: number;
}

/**
 * Fetches the current admin's subject-level permissions.
 * If `permissions` is empty, the admin has full access (super admin).
 * Use `hasFullAccess` to check, or `filterByPermission` to filter arrays.
 */
export function useAdminPermissions() {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<AdminPermission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    supabase
      .from("user_permissions")
      .select("class_id, subject_id")
      .eq("user_id", user.id)
      .then(({ data }) => {
        setPermissions(data || []);
        setLoading(false);
      });
  }, [user]);

  const hasFullAccess = permissions.length === 0;

  /** Check if a specific class_id is permitted */
  const isClassAllowed = (classId: number) =>
    hasFullAccess || permissions.some((p) => p.class_id === classId);

  /** Check if a specific class_id + subject_id combo is permitted */
  const isSubjectAllowed = (classId: number, subjectId: number) =>
    hasFullAccess || permissions.some((p) => p.class_id === classId && p.subject_id === subjectId);

  /** Filter an array of classes to only permitted ones */
  const filterClasses = <T extends { id: number }>(classes: T[]): T[] =>
    hasFullAccess ? classes : classes.filter((c) => permissions.some((p) => p.class_id === c.id));

  /** Filter an array of subjects to only permitted ones */
  const filterSubjects = <T extends { id: number; class_id: number }>(subjects: T[]): T[] =>
    hasFullAccess ? subjects : subjects.filter((s) => permissions.some((p) => p.class_id === s.class_id && p.subject_id === s.id));

  return {
    permissions,
    loading,
    hasFullAccess,
    isClassAllowed,
    isSubjectAllowed,
    filterClasses,
    filterSubjects,
  };
}
