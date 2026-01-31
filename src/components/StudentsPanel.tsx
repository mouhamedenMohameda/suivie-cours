import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type {
  ProgressRecord,
  Student,
  StudentAiChat,
  StudentAiMessage
} from "../types";

type StudentsPanelProps = {
  userId: string;
  students: Student[];
  loading: boolean;
  reloadStudents: () => Promise<void>;
};

export default function StudentsPanel({
  userId,
  students,
  loading,
  reloadStudents
}: StudentsPanelProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [amountDue, setAmountDue] = useState("0");
  const [alertThreshold, setAlertThreshold] = useState("0");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<StudentAiMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sessionNotes, setSessionNotes] = useState<ProgressRecord[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [noteSubject, setNoteSubject] = useState("");
  const [noteDate, setNoteDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [noteContent, setNoteContent] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editContent, setEditContent] = useState("");
  const [allowedWeekdays, setAllowedWeekdays] = useState<number[]>([]);
  const [allowedDates, setAllowedDates] = useState<string[]>([]);
  const [allowedSubjects, setAllowedSubjects] = useState<string[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileSection, setMobileSection] = useState<
    "list" | "chat" | "notes" | "create"
  >("list");
  const [billingSaving, setBillingSaving] = useState(false);
  const [billingMessage, setBillingMessage] = useState<string | null>(null);

  const mobileSectionLabel =
    mobileSection === "list"
      ? "Liste des étudiants"
      : mobileSection === "chat"
        ? "Chat IA"
        : mobileSection === "notes"
          ? "Notes de séance"
          : "Créer un étudiant";

  const selectedStudent = useMemo(
    () => students.find((student) => student.id === selectedStudentId) ?? null,
    [students, selectedStudentId]
  );

  const billingAlert =
    selectedStudent &&
    selectedStudent.alert_threshold > 0 &&
    selectedStudent.amount_due > selectedStudent.alert_threshold;

  const groupedNotes = useMemo(() => {
    return sessionNotes.reduce<Record<string, ProgressRecord[]>>(
      (acc, record) => {
        const key = record.subject || "Autre";
        acc[key] = acc[key] || [];
        acc[key].push(record);
        return acc;
      },
      {}
    );
  }, [sessionNotes]);

  const dateLabel = (value: string) =>
    new Date(value).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric"
    });

  const buildAllowedDates = (weekdays: number[], rangeDays = 120) => {
    const dates: string[] = [];
    const today = new Date();
    for (let i = 0; i <= rangeDays; i += 1) {
      const candidate = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + i
      );
      const day = candidate.getDay();
      if (weekdays.includes(day)) {
        dates.push(candidate.toISOString().slice(0, 10));
      }
    }
    return dates;
  };

  useEffect(() => {
    if (!selectedStudentId && students.length > 0) {
      setSelectedStudentId(students[0].id);
    }
  }, [students, selectedStudentId]);

  useEffect(() => {
    if (!selectedStudent) return;
    setBillingMessage(null);
  }, [selectedStudent]);

  useEffect(() => {
    if (allowedDates.length === 0) {
      setNoteDate("");
      return;
    }
    if (!noteDate || !allowedDates.includes(noteDate)) {
      setNoteDate(allowedDates[0]);
    }
  }, [allowedDates, noteDate]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);

    if (!fullName.trim()) {
      setMessage("Le nom est obligatoire.");
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("students").insert({
      owner_id: userId,
      full_name: fullName.trim(),
      email: email.trim() || null,
      notes: notes.trim() || null,
      amount_due: Number(amountDue) || 0,
      alert_threshold: Number(alertThreshold) || 0
    });

    if (error) {
      setMessage(error.message);
    } else {
      setFullName("");
      setEmail("");
      setNotes("");
      setAmountDue("0");
      setAlertThreshold("0");
      await reloadStudents();
    }

    setSaving(false);
  };

  const handleDelete = async (studentId: string) => {
    setMessage(null);
    const { error } = await supabase
      .from("students")
      .delete()
      .eq("id", studentId);

    if (error) {
      setMessage(error.message);
      return;
    }

    await reloadStudents();
    if (selectedStudentId === studentId) {
      setSelectedStudentId(null);
      setChatId(null);
      setMessages([]);
    }
  };

  const handleUpdateBilling = async () => {
    if (!selectedStudent) return;
    setBillingSaving(true);
    setBillingMessage(null);

    const { error } = await supabase
      .from("students")
      .update({
        amount_due: Number(amountDue) || 0,
        alert_threshold: Number(alertThreshold) || 0
      })
      .eq("id", selectedStudent.id);

    if (error) {
      setBillingMessage(error.message);
    } else {
      await reloadStudents();
      setBillingMessage("Montants mis à jour.");
    }

    setBillingSaving(false);
  };

  const ensureChat = async (studentId: string) => {
    const { data, error } = await supabase
      .from("student_ai_chats")
      .select("id, student_id, created_at")
      .eq("student_id", studentId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data?.id) {
      return data as StudentAiChat;
    }

    const { data: created, error: insertError } = await supabase
      .from("student_ai_chats")
      .insert({
        owner_id: userId,
        student_id: studentId
      })
      .select("id, student_id, created_at")
      .single();

    if (insertError) {
      throw insertError;
    }

    return created as StudentAiChat;
  };

  const loadMessages = async (activeChatId: string) => {
    const { data, error } = await supabase
      .from("student_ai_messages")
      .select("id, chat_id, role, content, created_at")
      .eq("chat_id", activeChatId)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    setMessages((data ?? []) as StudentAiMessage[]);
  };

  const loadSessionNotes = async (studentId: string) => {
    setNotesLoading(true);
    setNotesError(null);

    const { data, error } = await supabase
      .from("progress_records")
      .select("id, student_id, subject, notes, record_date, created_at")
      .eq("student_id", studentId)
      .order("record_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      setNotesError(error.message);
    } else {
      setSessionNotes((data ?? []) as ProgressRecord[]);
    }

    setNotesLoading(false);
  };

  const loadAllowedWeekdays = async (studentId: string) => {
    const { data, error } = await supabase
      .from("schedule_assignments")
      .select("time_slots(day_of_week, subject)")
      .eq("student_id", studentId);

    if (error) {
      setNotesError(error.message);
      setAllowedWeekdays([]);
      setAllowedDates([]);
      return { days: [] as number[], dates: [] as string[], subjects: [] as string[] };
    }

    const slots = (data ?? []).flatMap((row) => row.time_slots ?? []);
    const days = Array.from(
      new Set(
        slots
          .map((slot) => slot.day_of_week)
          .filter((value): value is number => typeof value === "number")
      )
    ).sort();

    const subjects = Array.from(
      new Set(
        slots
          .map((slot) => slot.subject)
          .filter(
            (value): value is string =>
              typeof value === "string" && value.trim().length > 0
          )
      )
    ).sort((a, b) => a.localeCompare(b, "fr-FR"));

    const jsWeekdays = days.map((day) => (day + 1) % 7);
    const dates = buildAllowedDates(jsWeekdays);
    setAllowedWeekdays(jsWeekdays);
    setAllowedDates(dates);
    setAllowedSubjects(subjects);
    return { days: jsWeekdays, dates, subjects };
  };

  useEffect(() => {
    if (!selectedStudentId) return;
    let mounted = true;

    const loadChat = async () => {
      setChatLoading(true);
      setChatError(null);

      try {
        const chat = await ensureChat(selectedStudentId);
        if (!mounted) return;
        setChatId(chat.id);
        await loadMessages(chat.id);
      } catch (error) {
        if (!mounted) return;
        const message =
          error instanceof Error
            ? error.message
            : "Impossible de charger le chat.";
        setChatError(message);
      } finally {
        if (mounted) {
          setChatLoading(false);
        }
      }
    };

    const loadNotes = async () => {
      await loadSessionNotes(selectedStudentId);
      const { dates, subjects } = await loadAllowedWeekdays(selectedStudentId);
      if (!mounted) return;
      setNoteSubject(subjects[0] ?? "");
      setNoteContent("");
      setNoteDate(dates[0] ?? "");
      setEditingNoteId(null);
    };

    loadChat();
    loadNotes();

    return () => {
      mounted = false;
    };
  }, [selectedStudentId]);

  const handleSendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedStudent || !chatInput.trim()) {
      return;
    }

    setSending(true);
    setChatError(null);
    const content = chatInput.trim();
    setChatInput("");

    try {
      const activeChat =
        chatId ?? (await ensureChat(selectedStudent.id)).id;
      setChatId(activeChat);

      const { data: userMessage, error: insertError } = await supabase
        .from("student_ai_messages")
        .insert({
          owner_id: userId,
          chat_id: activeChat,
          role: "user",
          content
        })
        .select("id, chat_id, role, content, created_at")
        .single();

      if (insertError) {
        throw insertError;
      }

      const baseMessages = [
        ...messages,
        {
          id: userMessage.id,
          chat_id: activeChat,
          role: "user" as const,
          content,
          created_at: userMessage.created_at
        }
      ];
      setMessages(baseMessages);

      const { data: aiData, error: aiError } = await supabase.functions.invoke(
        "student-chat",
        {
          body: {
            studentName: selectedStudent.full_name,
            studentNotes: selectedStudent.notes,
            messages: baseMessages.map((message) => ({
              role: message.role,
              content: message.content
            }))
          }
        }
      );

      if (aiError) {
        throw aiError;
      }

      const reply = aiData?.reply?.trim();
      if (!reply) {
        throw new Error("Réponse IA vide.");
      }

      const { data: assistantMessage, error: assistantError } = await supabase
        .from("student_ai_messages")
        .insert({
          owner_id: userId,
          chat_id: activeChat,
          role: "assistant",
          content: reply
        })
        .select("id, chat_id, role, content, created_at")
        .single();

      if (assistantError) {
        throw assistantError;
      }

      setMessages((prev) => [
        ...prev,
        assistantMessage as StudentAiMessage
      ]);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Impossible d'envoyer le message.";
      setChatError(message);
    } finally {
      setSending(false);
    }
  };

  const handleCreateNote = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedStudent) return;
    if (!noteSubject.trim() || !noteContent.trim()) {
      setNotesError("La matière et la note sont obligatoires.");
      return;
    }
    if (allowedSubjects.length > 0 && !allowedSubjects.includes(noteSubject)) {
      setNotesError("La matière doit correspondre à un créneau de l'étudiant.");
      return;
    }
    if (allowedWeekdays.length === 0) {
      setNotesError("Ajoute un créneau pour choisir une date valide.");
      return;
    }
    if (!allowedDates.includes(noteDate)) {
      setNotesError(
        "La date doit correspondre à un jour de séance de l'étudiant."
      );
      return;
    }

    setSavingNote(true);
    setNotesError(null);

    const { error } = await supabase.from("progress_records").insert({
      owner_id: userId,
      student_id: selectedStudent.id,
      subject: noteSubject.trim(),
      notes: noteContent.trim(),
      record_date: noteDate
    });

    if (error) {
      setNotesError(error.message);
    } else {
      setNoteSubject("");
      setNoteContent("");
      setNoteDate(new Date().toISOString().slice(0, 10));
      await loadSessionNotes(selectedStudent.id);
    }

    setSavingNote(false);
  };

  const handleStartEdit = (record: ProgressRecord) => {
    setEditingNoteId(record.id);
    setEditSubject(record.subject);
    setEditDate(record.record_date);
    setEditContent(record.notes ?? "");
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditSubject("");
    setEditDate("");
    setEditContent("");
  };

  const handleSaveEdit = async () => {
    if (!editingNoteId || !selectedStudent) return;
    if (!editSubject.trim() || !editContent.trim()) {
      setNotesError("La matière et la note sont obligatoires.");
      return;
    }
    if (allowedSubjects.length > 0 && !allowedSubjects.includes(editSubject)) {
      setNotesError("La matière doit correspondre à un créneau de l'étudiant.");
      return;
    }
    if (allowedWeekdays.length === 0) {
      setNotesError("Ajoute un créneau pour choisir une date valide.");
      return;
    }
    if (!allowedDates.includes(editDate)) {
      setNotesError(
        "La date doit correspondre à un jour de séance de l'étudiant."
      );
      return;
    }

    setSavingNote(true);
    setNotesError(null);

    const { error } = await supabase
      .from("progress_records")
      .update({
        subject: editSubject.trim(),
        notes: editContent.trim(),
        record_date: editDate
      })
      .eq("id", editingNoteId);

    if (error) {
      setNotesError(error.message);
    } else {
      await loadSessionNotes(selectedStudent.id);
      handleCancelEdit();
    }

    setSavingNote(false);
  };

  return (
    <div className="students-layout">
      <div className="mobile-topbar">
        <button
          type="button"
          className="secondary"
          onClick={() => setMenuOpen((prev) => !prev)}
        >
          Menu
        </button>
        <span className="mobile-topbar-label">{mobileSectionLabel}</span>
        {menuOpen && (
          <div className="mobile-menu-panel">
            <button
              type="button"
              onClick={() => {
                setMobileSection("list");
                setMenuOpen(false);
              }}
            >
              Liste des étudiants
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileSection("chat");
                setMenuOpen(false);
              }}
            >
              Chat IA
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileSection("notes");
                setMenuOpen(false);
              }}
            >
              Notes de séance
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileSection("create");
                setMenuOpen(false);
              }}
            >
              Créer un étudiant
            </button>
          </div>
        )}
      </div>

      <section
        className={`panel students-sidebar ${
          mobileSection === "list" || mobileSection === "create" ? "is-active" : ""
        }`}
        id="students-list-section"
      >
        <div className="panel-header">
          <div>
            <h2>Étudiants</h2>
            <p className="panel-subtitle">
              Ajoute, organise et échange avec tes étudiants.
            </p>
          </div>
          <span className="pill">{students.length}</span>
        </div>

        <div
          className={`students-block ${
            mobileSection === "list" ? "is-active" : ""
          }`}
        >
        <div className="student-highlight">
          <div>
            <p className="muted small">Étudiant sélectionné</p>
            <p className="list-title">
              {selectedStudent?.full_name ?? "Aucun"}
            </p>
            {selectedStudent?.email && (
              <p className="muted small">{selectedStudent.email}</p>
            )}
          </div>
          <div className="student-highlight-tag">1 chat IA</div>
        </div>

        {selectedStudent && (
          <div className={`billing-card ${billingAlert ? "billing-alert" : ""}`}>
            <div>
              <p className="muted small">Montant restant à régler</p>
              <p className="list-title">
                {Number(selectedStudent.amount_due || 0).toLocaleString("fr-FR")}
              </p>
              {billingAlert && (
                <span className="billing-alert-text">
                  Seuil dépassé
                </span>
              )}
            </div>
            <div className="billing-form">
              <label className="field">
                <span>Montant dû</span>
                <input
                  type="number"
                  min={0}
                  value={amountDue}
                  onChange={(event) => setAmountDue(event.target.value)}
                />
              </label>
              <label className="field">
                <span>Seuil d'alerte</span>
                <input
                  type="number"
                  min={0}
                  value={alertThreshold}
                  onChange={(event) => setAlertThreshold(event.target.value)}
                />
              </label>
              <button
                type="button"
                className="secondary"
                onClick={handleUpdateBilling}
                disabled={billingSaving}
              >
                {billingSaving ? "Mise à jour..." : "Mettre à jour"}
              </button>
              {billingMessage && (
                <span className="muted small">{billingMessage}</span>
              )}
            </div>
          </div>
        )}

        <div className="divider" />

        <div className="panel-header">
          <h3>Liste des étudiants</h3>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              const element = document.getElementById("student-create-form");
              element?.scrollIntoView({ behavior: "smooth", block: "start" });
              setMobileSection("create");
            }}
          >
            Créer
          </button>
        </div>
          {loading ? (
            <p>Chargement...</p>
          ) : students.length === 0 ? (
            <p className="muted">Aucun étudiant pour le moment.</p>
          ) : (
            <div className="student-list">
              {students.map((student) => (
                <div
                  key={student.id}
                  className={`student-item ${
                    selectedStudentId === student.id ? "student-item--active" : ""
                  }`}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setSelectedStudentId(student.id);
                    setMobileSection("list");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      setSelectedStudentId(student.id);
                      setMobileSection("list");
                    }
                  }}
                >
                  <div className="student-meta">
                    <div className="student-avatar">
                      {student.full_name.trim().slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <p className="list-title">{student.full_name}</p>
                      {student.email && (
                        <p className="muted small">{student.email}</p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="link danger"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDelete(student.id);
                    }}
                  >
                    Supprimer
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="divider" />

        <div
          id="students-create-section"
          className={`students-block ${
            mobileSection === "create" ? "is-active" : ""
          }`}
        >
          <h3>Créer un étudiant</h3>
          <p className="muted">
            Créez un profil étudiant pour l'associer ensuite à l'emploi du temps.
          </p>

          <form onSubmit={handleCreate} className="stack">
          <label className="field">
            <span>Nom complet</span>
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Ex: Sarah Diallo"
            />
          </label>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="sarah@email.com"
            />
          </label>
          <label className="field">
            <span>Notes</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Niveau, objectifs, remarques..."
              rows={3}
            />
          </label>

          <label className="field">
            <span>Montant dû</span>
            <input
              type="number"
              min={0}
              value={amountDue}
              onChange={(event) => setAmountDue(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Seuil d'alerte</span>
            <input
              type="number"
              min={0}
              value={alertThreshold}
              onChange={(event) => setAlertThreshold(event.target.value)}
            />
          </label>

          {message && <div className="message">{message}</div>}

          <button type="submit" className="primary" disabled={saving}>
            {saving ? "Enregistrement..." : "Ajouter l'étudiant"}
          </button>
          </form>
        </div>
      </section>

      <section
        className={`panel students-chat ${
          mobileSection === "chat" || mobileSection === "notes" ? "is-active" : ""
        }`}
        id="students-chat-section"
      >
        {!selectedStudent ? (
          <p className="muted">Sélectionne un étudiant pour commencer.</p>
        ) : (
          <div className="chat-shell">
            <div
              className={`chat-section students-block ${
                mobileSection === "chat" ? "is-active" : ""
              }`}
            >
              <div className="panel-header">
                <div>
                  <h2>Chat IA</h2>
                  <p className="muted">
                    Discutez de la progression et demandez des cours personnalisés.
                  </p>
                </div>
              </div>
              <div className="chat-header">
                <div>
                  <p className="list-title">{selectedStudent.full_name}</p>
                  {selectedStudent.notes && (
                    <p className="muted small">{selectedStudent.notes}</p>
                  )}
                </div>
                <span className="pill">1 chat</span>
              </div>

              {chatError && <div className="alert">{chatError}</div>}

              {chatLoading ? (
                <p>Chargement du chat...</p>
              ) : (
                <div className="chat-messages">
                  {messages.length === 0 ? (
                    <p className="muted">
                      Aucun message pour le moment. Commence la discussion.
                    </p>
                  ) : (
                    messages.map((item) => (
                      <div
                        key={item.id}
                        className={`chat-bubble ${
                          item.role === "assistant"
                            ? "chat-bubble--assistant"
                            : "chat-bubble--user"
                        }`}
                      >
                        <p>{item.content}</p>
                        <span className="muted small">
                          {new Date(item.created_at).toLocaleString("fr-FR")}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              <form className="chat-input" onSubmit={handleSendMessage}>
                <input
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  placeholder="Ex: propose un cours sur les équations..."
                  disabled={sending}
                />
                <button type="submit" className="primary" disabled={sending}>
                  {sending ? "Envoi..." : "Envoyer"}
                </button>
              </form>
            </div>

            <div
              className={`notes-section students-block ${
                mobileSection === "notes" ? "is-active" : ""
              }`}
              id="students-notes-section"
            >
              <div className="panel-header">
                <div>
                  <h3>Notes de séance</h3>
                  <p className="muted">
                    Remarques par cours, classées par matière.
                  </p>
                </div>
              </div>

              <form className="notes-form" onSubmit={handleCreateNote}>
                <label className="field">
                  <span>Matière</span>
                  <select
                    value={noteSubject}
                    onChange={(event) => setNoteSubject(event.target.value)}
                    disabled={allowedSubjects.length === 0}
                  >
                    {allowedSubjects.length === 0 ? (
                      <option value="">Ajoute un créneau</option>
                    ) : (
                      allowedSubjects.map((subject) => (
                        <option key={subject} value={subject}>
                          {subject}
                        </option>
                      ))
                    )}
                  </select>
                  {allowedSubjects.length === 0 && (
                    <span className="muted small">
                      Ajoute un créneau pour proposer des matières.
                    </span>
                  )}
                </label>
                <label className="field">
                  <span>Date</span>
                  <select
                    value={noteDate}
                    onChange={(event) => setNoteDate(event.target.value)}
                    disabled={allowedWeekdays.length === 0}
                  >
                    {allowedDates.length === 0 ? (
                      <option value="">Ajoute un créneau</option>
                    ) : (
                      allowedDates.map((date) => (
                        <option key={date} value={date}>
                          {dateLabel(date)}
                        </option>
                      ))
                    )}
                  </select>
                  {allowedWeekdays.length === 0 && (
                    <span className="muted small">
                      Ajoute un créneau pour proposer des dates.
                    </span>
                  )}
                </label>
                <label className="field notes-form-full">
                  <span>Note</span>
                  <textarea
                    value={noteContent}
                    onChange={(event) => setNoteContent(event.target.value)}
                    placeholder="Ce qui a été vu, compris, et ce qui reste à développer."
                    rows={3}
                  />
                </label>

                {notesError && <div className="alert">{notesError}</div>}

                <button type="submit" className="primary" disabled={savingNote}>
                  {savingNote ? "Enregistrement..." : "Ajouter la note"}
                </button>
              </form>

              {notesLoading ? (
                <p>Chargement des notes...</p>
              ) : sessionNotes.length === 0 ? (
                <p className="muted">Aucune note pour le moment.</p>
              ) : (
                <div className="notes-list">
                  {Object.entries(groupedNotes).map(([subject, records]) => (
                    <div key={subject} className="notes-group">
                      <div className="notes-group-header">
                        <h4>{subject}</h4>
                        <span className="pill">{records.length}</span>
                      </div>
                      <div className="notes-items">
                        {records.map((record) => (
                          <div key={record.id} className="note-card">
                            {editingNoteId === record.id ? (
                              <div className="note-edit">
                                <label className="field">
                                  <span>Matière</span>
                                  <select
                                    value={
                                      allowedSubjects.includes(editSubject)
                                        ? editSubject
                                        : allowedSubjects[0] ?? editSubject
                                    }
                                    onChange={(event) =>
                                      setEditSubject(event.target.value)
                                    }
                                    disabled={allowedSubjects.length === 0}
                                  >
                                    {allowedSubjects.length === 0 ? (
                                      <option value={editSubject}>
                                        Ajoute un créneau
                                      </option>
                                    ) : (
                                      [editSubject, ...allowedSubjects]
                                        .filter(
                                          (value, index, array) =>
                                            value &&
                                            array.indexOf(value) === index
                                        )
                                        .map((subject) => (
                                          <option key={subject} value={subject}>
                                            {subject}
                                          </option>
                                        ))
                                    )}
                                  </select>
                                  {allowedSubjects.length === 0 && (
                                    <span className="muted small">
                                      Ajoute un créneau pour proposer des matières.
                                    </span>
                                  )}
                                </label>
                                <label className="field">
                                  <span>Date</span>
                                  <select
                                    value={
                                      allowedDates.length === 0
                                        ? editDate
                                        : allowedDates.includes(editDate)
                                          ? editDate
                                          : allowedDates[0] ?? editDate
                                    }
                                    onChange={(event) =>
                                      setEditDate(event.target.value)
                                    }
                                    disabled={allowedWeekdays.length === 0}
                                  >
                                    {allowedDates.length === 0 ? (
                                      <option value={editDate}>
                                        Ajoute un créneau
                                      </option>
                                    ) : (
                                      [editDate, ...allowedDates]
                                        .filter(
                                          (value, index, array) =>
                                            value &&
                                            array.indexOf(value) === index
                                        )
                                        .map((date) => (
                                          <option key={date} value={date}>
                                            {dateLabel(date)}
                                          </option>
                                        ))
                                    )}
                                  </select>
                                  {allowedWeekdays.length === 0 && (
                                    <span className="muted small">
                                      Ajoute un créneau pour proposer des dates.
                                    </span>
                                  )}
                                </label>
                                <label className="field">
                                  <span>Note</span>
                                  <textarea
                                    value={editContent}
                                    onChange={(event) =>
                                      setEditContent(event.target.value)
                                    }
                                    rows={3}
                                  />
                                </label>
                                <div className="note-actions">
                                  <button
                                    type="button"
                                    className="secondary"
                                    onClick={handleCancelEdit}
                                  >
                                    Annuler
                                  </button>
                                  <button
                                    type="button"
                                    className="primary"
                                    onClick={handleSaveEdit}
                                    disabled={savingNote}
                                  >
                                    Enregistrer
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="note-meta">
                                  <span className="note-date">
                                    {new Date(
                                      record.record_date
                                    ).toLocaleDateString("fr-FR")}
                                  </span>
                                  <button
                                    type="button"
                                    className="link"
                                    onClick={() => handleStartEdit(record)}
                                  >
                                    Modifier
                                  </button>
                                </div>
                                <p className="note-content">
                                  {record.notes ?? ""}
                                </p>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
