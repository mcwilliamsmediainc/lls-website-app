import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import { BrainInjectionForm, type Question } from "../components/BrainInjectionForm";

interface OnboardingInfo {
  businessName: string;
  status: string;
  alreadySubmitted: boolean;
  questions: Question[];
}

export function Onboarding() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<OnboardingInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    api
      .get<OnboardingInfo>(`/onboarding/${token}`)
      .then(setInfo)
      .catch((e) => setError(e instanceof Error ? e.message : "This link is not valid"));
  }, [token]);

  async function submit(answers: Record<string, string>) {
    setSubmitting(true);
    try {
      await api.post(`/onboarding/${token}`, answers);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (error) {
    return <CenteredCard><p className="text-rust">{error}</p></CenteredCard>;
  }
  if (!info) {
    return <CenteredCard><p className="text-slate">Loading…</p></CenteredCard>;
  }
  if (done || info.alreadySubmitted) {
    return (
      <CenteredCard>
        <h1 className="text-xl font-extrabold text-navy mb-2">Thank you</h1>
        <p className="text-slate">Your answers have been received. There is nothing more to do.</p>
      </CenteredCard>
    );
  }

  return (
    <div className="min-h-full bg-offwhite py-10 px-4">
      <div className="mx-auto max-w-2xl bg-white rounded-xl border border-sand p-8 shadow-sm">
        <h1 className="text-2xl font-extrabold text-navy">A few questions for {info.businessName}</h1>
        <p className="text-sm text-slate mt-1 mb-6">
          These help us tell your story accurately. Answer in your own words. There are no wrong answers.
        </p>
        <BrainInjectionForm questions={info.questions} onSubmit={submit} submitting={submitting} />
      </div>
    </div>
  );
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full flex items-center justify-center bg-offwhite p-6">
      <div className="bg-white rounded-xl border border-sand p-8 shadow-sm max-w-md text-center">{children}</div>
    </div>
  );
}
