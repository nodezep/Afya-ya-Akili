'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Spinner } from '@/components/ui';

interface Template {
  id: string;
  type: string;
  name: string;
  description: string;
  _count: { questions: number };
}

interface FullTemplate extends Template {
  questions: Array<{
    id: string;
    order: number;
    text: string;
    options: Array<{ label: string; value: number }>;
  }>;
}

interface SubmitResult {
  totalScore: number;
  severity: string;
  guidance: string;
  assessmentName: string;
}

interface LatestResult {
  type: string;
  name: string;
  isDue: boolean;
  latest: { totalScore: number; severity: string; createdAt: string } | null;
}

export default function AssessmentsPage() {
  const queryClient = useQueryClient();
  const [active, setActive] = useState<FullTemplate | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<SubmitResult | null>(null);

  const { data: templates, isLoading } = useQuery({
    queryKey: ['assessments', 'templates'],
    queryFn: () => api<Template[]>('/assessments/templates'),
  });

  const { data: latest } = useQuery({
    queryKey: ['assessments', 'latest'],
    queryFn: () => api<LatestResult[]>('/assessments/results/latest'),
  });

  const start = async (type: string) => {
    setResult(null);
    setAnswers({});
    const template = await api<FullTemplate>(`/assessments/templates/${type}`);
    setActive(template);
  };

  const submit = useMutation({
    mutationFn: () =>
      api<SubmitResult>('/assessments/submit', {
        method: 'POST',
        body: JSON.stringify({
          type: active!.type,
          answers: active!.questions.map((q) => ({ questionId: q.id, value: answers[q.id] })),
        }),
      }),
    onSuccess: (data) => {
      setResult(data);
      setActive(null);
      void queryClient.invalidateQueries({ queryKey: ['assessments'] });
    },
  });

  const allAnswered = active?.questions.every((q) => answers[q.id] !== undefined) ?? false;

  if (isLoading) return <Spinner />;

  // ---------------- Taking an assessment ----------------
  if (active) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{active.name}</h1>
          <p className="mt-1 text-sm text-slate-500">{active.description}</p>
        </div>
        {active.questions.map((question, index) => (
          <Card key={question.id}>
            <CardContent>
              <p className="font-medium">
                {index + 1}. {question.text}
              </p>
              <div className="mt-3 grid gap-2">
                {question.options.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setAnswers((a) => ({ ...a, [question.id]: option.value }))}
                    className={cn(
                      'rounded-lg border px-4 py-2 text-left text-sm transition',
                      answers[question.id] === option.value
                        ? 'border-brand-600 bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200'
                        : 'border-slate-200 hover:border-brand-300 dark:border-slate-700',
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
        <div className="flex justify-between">
          <Button variant="ghost" onClick={() => setActive(null)}>
            Cancel
          </Button>
          <Button disabled={!allAnswered} loading={submit.isPending} onClick={() => submit.mutate()}>
            Submit ({Object.keys(answers).length}/{active.questions.length})
          </Button>
        </div>
      </div>
    );
  }

  // ---------------- Listing ----------------
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mental health assessments</h1>
        <p className="text-sm text-slate-500">
          Clinically validated screeners. Results are guidance, not a diagnosis.
        </p>
      </div>

      {result && (
        <Card className="border-brand-500">
          <CardHeader className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-brand-600" />
            <CardTitle>{result.assessmentName} — result</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {result.totalScore}{' '}
              <Badge variant="info" className="ml-2 align-middle capitalize">
                {result.severity}
              </Badge>
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {result.guidance}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {templates?.map((template) => {
          const status = latest?.find((l) => l.type === template.type);
          return (
            <Card key={template.id}>
              <CardContent>
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold">{template.name}</h3>
                  {status?.isDue && <Badge variant="warning">Due</Badge>}
                </div>
                <p className="mt-1 text-sm text-slate-500">{template.description}</p>
                {status?.latest && (
                  <p className="mt-2 text-xs text-slate-400">
                    Last: {status.latest.totalScore} ({status.latest.severity}) on{' '}
                    {formatDate(status.latest.createdAt)}
                  </p>
                )}
                <Button size="sm" className="mt-4" onClick={() => void start(template.type)}>
                  {status?.latest ? 'Retake' : 'Start'} · {template._count.questions} questions
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
