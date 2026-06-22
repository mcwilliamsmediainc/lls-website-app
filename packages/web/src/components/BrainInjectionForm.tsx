import { useState } from "react";

export interface Question {
  key: string;
  label: string;
}

/**
 * The public Brain Injection form body. Used by the Onboarding page (no login).
 * Posts answers to /onboarding/:token.
 */
export function BrainInjectionForm({
  questions,
  onSubmit,
  submitting,
}: {
  questions: Question[];
  onSubmit: (answers: Record<string, string>) => void;
  submitting: boolean;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  function update(key: string, value: string) {
    setAnswers((a) => ({ ...a, [key]: value }));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(answers);
      }}
      className="space-y-6"
    >
      {questions.map((q, i) => (
        <div key={q.key}>
          <label className="block text-sm font-semibold text-navy mb-1">
            {i + 1}. {q.label}
          </label>
          <textarea
            value={answers[q.key] ?? ""}
            onChange={(e) => update(q.key, e.target.value)}
            rows={4}
            className="w-full rounded border border-sand bg-white p-3 text-sm text-slate focus:border-rust focus:outline-none"
          />
        </div>
      ))}
      <div>
        <label className="block text-sm font-semibold text-navy mb-1">Anything else you want us to know?</label>
        <textarea
          value={answers.additionalNotes ?? ""}
          onChange={(e) => update("additionalNotes", e.target.value)}
          rows={3}
          className="w-full rounded border border-sand bg-white p-3 text-sm text-slate focus:border-rust focus:outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-rust px-5 py-2.5 text-white font-semibold text-sm hover:bg-rust/90 disabled:opacity-60"
      >
        {submitting ? "Sending…" : "Submit"}
      </button>
    </form>
  );
}
