import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { ScheduleAssignment, Student, TimeSlot } from "../types";

const DAY_LABELS = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
  "Dimanche"
];

type SchedulePanelProps = {
  userId: string;
  students: Student[];
  reloadStudents: () => Promise<void>;
  loadingStudents: boolean;
};

export default function SchedulePanel({
  userId,
  students,
  reloadStudents,
  loadingStudents
}: SchedulePanelProps) {
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [assignments, setAssignments] = useState<ScheduleAssignment[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingSlot, setSavingSlot] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [startTime, setStartTime] = useState("08:00");
  const [duration, setDuration] = useState(60);
  const [subject, setSubject] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<Record<string, string>>(
    {}
  );

  const loadTimeSlots = async () => {
    setLoading(true);
    setMessage(null);
    const { data, error } = await supabase
      .from("time_slots")
      .select("*")
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });

    if (error) {
      setMessage(error.message);
    } else {
      setTimeSlots((data ?? []) as TimeSlot[]);
    }
    setLoading(false);
  };

  const loadAssignments = async () => {
    const { data, error } = await supabase
      .from("schedule_assignments")
      .select("id, time_slot_id, student_id, students(full_name)");

    if (error) {
      setMessage(error.message);
    } else {
      setAssignments((data ?? []) as ScheduleAssignment[]);
    }
  };

  useEffect(() => {
    loadTimeSlots();
    loadAssignments();
  }, [userId]);

  const assignmentsBySlot = useMemo(() => {
    return assignments.reduce<Record<string, ScheduleAssignment[]>>(
      (acc, assignment) => {
        acc[assignment.time_slot_id] = acc[assignment.time_slot_id] || [];
        acc[assignment.time_slot_id].push(assignment);
        return acc;
      },
      {}
    );
  }, [assignments]);

  const handleCreateSlot = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);

    if (!subject.trim()) {
      setMessage("La matière est obligatoire.");
      return;
    }

    setSavingSlot(true);
    const { error } = await supabase.from("time_slots").insert({
      owner_id: userId,
      day_of_week: dayOfWeek,
      start_time: startTime,
      duration_minutes: duration,
      subject: subject.trim()
    });

    if (error) {
      setMessage(error.message);
    } else {
      setSubject("");
      setStartTime("08:00");
      setDuration(60);
      setDayOfWeek(0);
      await loadTimeSlots();
    }

    setSavingSlot(false);
  };

  const handleDeleteSlot = async (slotId: string) => {
    setMessage(null);
    const { error } = await supabase.from("time_slots").delete().eq("id", slotId);

    if (error) {
      setMessage(error.message);
      return;
    }

    await loadTimeSlots();
    await loadAssignments();
  };

  const handleAssignStudent = async (slotId: string) => {
    const studentId = selectedStudents[slotId];
    if (!studentId) {
      setMessage("Sélectionne un étudiant.");
      return;
    }

    setAssigning(true);
    setMessage(null);

    const { error } = await supabase.from("schedule_assignments").insert({
      owner_id: userId,
      time_slot_id: slotId,
      student_id: studentId
    });

    if (error) {
      setMessage(error.message);
    } else {
      setSelectedStudents((prev) => ({ ...prev, [slotId]: "" }));
      await loadAssignments();
    }

    setAssigning(false);
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    setMessage(null);
    const { error } = await supabase
      .from("schedule_assignments")
      .delete()
      .eq("id", assignmentId);

    if (error) {
      setMessage(error.message);
      return;
    }

    await loadAssignments();
  };

  const formatAssignmentName = (assignment: ScheduleAssignment) => {
    if (!assignment.students) return "Étudiant";
    if (Array.isArray(assignment.students)) {
      return assignment.students[0]?.full_name ?? "Étudiant";
    }
    return assignment.students.full_name ?? "Étudiant";
  };

  const rowHeight = 48;
  const minutesFromTime = (value: string) => {
    const [hours, minutes] = value.split(":");
    const h = Number(hours ?? 0);
    const m = Number(minutes ?? 0);
    return h * 60 + m;
  };

  const minutesToTime = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const timeBounds = timeSlots.reduce(
    (acc, slot) => {
      const startMinutes = minutesFromTime(slot.start_time);
      const endMinutes = startMinutes + slot.duration_minutes;
      return {
        min: Math.min(acc.min, startMinutes),
        max: Math.max(acc.max, endMinutes)
      };
    },
    { min: 8 * 60, max: 20 * 60 }
  );

  const startMinutes = Math.floor(timeBounds.min / 30) * 30;
  const endMinutes = Math.ceil(timeBounds.max / 30) * 30;
  const timeLabels: number[] = [];
  for (let t = startMinutes; t <= endMinutes; t += 30) {
    timeLabels.push(t);
  }

  return (
    <div className="schedule-layout">
      <section className="panel schedule-form">
        <h2>Ajouter un créneau</h2>
        <p className="panel-subtitle">
          Créez un créneau hebdomadaire (jour, heure, durée, matière).
        </p>

        <form onSubmit={handleCreateSlot} className="stack schedule-form-grid">
          <label className="field">
            <span>Jour</span>
            <select
              value={dayOfWeek}
              onChange={(event) => setDayOfWeek(Number(event.target.value))}
            >
              {DAY_LABELS.map((label, index) => (
                <option key={label} value={index}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Heure de début</span>
            <input
              type="time"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Durée (minutes)</span>
            <input
              type="number"
              min={15}
              max={300}
              value={duration}
              onChange={(event) => setDuration(Number(event.target.value))}
            />
          </label>
          <label className="field">
            <span>Matière</span>
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Ex: Mathématiques"
            />
          </label>

          {message && <div className="message">{message}</div>}

          <button type="submit" className="primary" disabled={savingSlot}>
            {savingSlot ? "Enregistrement..." : "Ajouter le créneau"}
          </button>
        </form>
      </section>

      <section className="panel schedule-board">
        <div className="panel-header">
          <div>
            <h2>Emploi du temps</h2>
            <p className="panel-subtitle">Vue hebdomadaire par heures.</p>
          </div>
          <span className="pill">{timeSlots.length}</span>
        </div>

        {loading ? (
          <p>Chargement...</p>
        ) : (
          <div className="timetable">
            <div className="timetable-header">
              <div className="timetable-corner">Heures</div>
              {DAY_LABELS.map((label, index) => (
                <div key={label} className="timetable-day">
                  <span>{label}</span>
                  <span className="day-count">
                    {timeSlots.filter((slot) => slot.day_of_week === index).length}
                  </span>
                </div>
              ))}
            </div>

            <div className="timetable-body">
              <div className="timetable-times">
              {timeLabels.map((label) => (
                  <div key={label} className="timetable-time">
                    {label % 60 === 0 ? minutesToTime(label) : ""}
                  </div>
                ))}
              </div>

              {DAY_LABELS.map((label, index) => {
                const slots = timeSlots.filter(
                  (slot) => slot.day_of_week === index
                );
                return (
                  <div
                    key={label}
                    className="timetable-column"
                    style={{
                      minHeight: `${(timeLabels.length - 1) * rowHeight}px`
                    }}
                  >
                    {slots.length === 0 ? (
                      <div className="timetable-empty">Aucun cours.</div>
                    ) : (
                      slots.map((slot) => {
                        const slotStart = minutesFromTime(slot.start_time);
                        const top =
                          ((slotStart - startMinutes) / 30) * rowHeight;
                        const height =
                          (slot.duration_minutes / 30) * rowHeight;
                        const assignedNames =
                          assignmentsBySlot[slot.id]
                            ?.map((assignment) =>
                              formatAssignmentName(assignment)
                            )
                            .join(", ") ?? "";

                        return (
                      <div
                            key={slot.id}
                            className="slot-card slot-card--timetable"
                        style={{ top: `${top}px`, height: `${height}px` }}
                          >
                            <div className="slot-header">
                              <div>
                                <p className="slot-title">{slot.subject}</p>
                                <p className="muted small">
                                  {slot.start_time} • {slot.duration_minutes} min
                                </p>
                              </div>
                              <button
                                type="button"
                                className="link danger"
                                onClick={() => handleDeleteSlot(slot.id)}
                              >
                                Supprimer
                              </button>
                            </div>

                            <div className="slot-assignments">
                              <p className="muted small">Assignés</p>
                              <p className="muted small">
                                {assignedNames || "Aucun étudiant."}
                              </p>
                              {assignmentsBySlot[slot.id]?.map((assignment) => (
                                <button
                                  key={assignment.id}
                                  type="button"
                                  className="link danger small"
                                  onClick={() =>
                                    handleDeleteAssignment(assignment.id)
                                  }
                                >
                                  Retirer {formatAssignmentName(assignment)}
                                </button>
                              ))}
                            </div>

                            <div className="slot-actions">
                              <select
                                value={selectedStudents[slot.id] ?? ""}
                                onChange={(event) =>
                                  setSelectedStudents((prev) => ({
                                    ...prev,
                                    [slot.id]: event.target.value
                                  }))
                                }
                                disabled={loadingStudents || students.length === 0}
                              >
                                <option value="">
                                  {loadingStudents
                                    ? "Chargement..."
                                    : "Choisir un étudiant"}
                                </option>
                                {students.map((student) => (
                                  <option key={student.id} value={student.id}>
                                    {student.full_name}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                className="secondary"
                                onClick={() => handleAssignStudent(slot.id)}
                                disabled={
                                  assigning ||
                                  loadingStudents ||
                                  students.length === 0
                                }
                              >
                                Assigner
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!loading && timeSlots.length > 0 && students.length === 0 && (
          <div className="alert">
            Ajoute au moins un étudiant pour pouvoir assigner les créneaux.
          </div>
        )}
      </section>

      {students.length === 0 && !loadingStudents && (
        <section className="panel">
          <h2>Étudiants</h2>
          <p className="muted">
            Aucun étudiant disponible. Ajoute-en un pour organiser tes cours.
          </p>
          <button type="button" className="secondary" onClick={reloadStudents}>
            Rafraîchir
          </button>
        </section>
      )}
    </div>
  );
}
