import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";
import type { Student } from "../types";
import StudentsPanel from "./StudentsPanel";
import SchedulePanel from "./SchedulePanel";

type Section = "schedule" | "students";

type DashboardProps = {
  session: Session;
  onSignOut: () => Promise<void>;
};

export default function Dashboard({ session, onSignOut }: DashboardProps) {
  const [section, setSection] = useState<Section>("schedule");
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStudents = async () => {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("students")
      .select("*")
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setStudents((data ?? []) as Student[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadStudents();
  }, [session.user.id]);

  return (
    <div className="app-shell">
      <header className="header">
        <div>
          <h1>Emploi du temps</h1>
          <p className="muted">
            Gérez vos cours, vos étudiants et leur progression.
          </p>
        </div>
        <button type="button" className="secondary" onClick={onSignOut}>
          Se déconnecter
        </button>
      </header>

      <div className="tabs">
        <button
          type="button"
          className={`tab ${section === "schedule" ? "tab--active" : ""}`}
          onClick={() => setSection("schedule")}
        >
          Emploi du temps
        </button>
        <button
          type="button"
          className={`tab ${section === "students" ? "tab--active" : ""}`}
          onClick={() => setSection("students")}
        >
          Étudiants
        </button>
      </div>

      {error && <div className="alert">{error}</div>}

      {section === "schedule" ? (
        <SchedulePanel
          userId={session.user.id}
          students={students}
          reloadStudents={loadStudents}
          loadingStudents={loading}
        />
      ) : (
        <StudentsPanel
          userId={session.user.id}
          students={students}
          reloadStudents={loadStudents}
          loading={loading}
        />
      )}
    </div>
  );
}
