'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, CheckCircle2, ChevronLeft } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Badge, Button, Card, CardContent, EmptyState, Spinner } from '@/components/ui';

interface Course {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: string;
  isPremium: boolean;
  _count: { lessons: number; enrollments: number };
}

interface CourseDetail {
  id: string;
  title: string;
  description: string;
  lessons: Array<{ id: string; order: number; title: string; durationMin: number }>;
}

interface Lesson {
  id: string;
  title: string;
  contentMd: string;
  completed: boolean;
  course: { title: string; slug: string };
}

interface MyCourse {
  course: { id: string; title: string; slug: string };
  progress: { completedLessons: number; totalLessons: number; percent: number };
}

export default function LearningPage() {
  const queryClient = useQueryClient();
  const [openCourse, setOpenCourse] = useState<CourseDetail | null>(null);
  const [openLesson, setOpenLesson] = useState<Lesson | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: courses, isLoading } = useQuery({
    queryKey: ['learning', 'courses'],
    queryFn: () => api<{ items: Course[] }>('/learning/courses?limit=50').then((r) => r.items),
  });

  const { data: myCourses } = useQuery({
    queryKey: ['learning', 'my-courses'],
    queryFn: () => api<MyCourse[]>('/learning/my-courses'),
  });

  const enroll = useMutation({
    mutationFn: (courseId: string) => api(`/learning/courses/${courseId}/enroll`, { method: 'POST' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['learning'] }),
  });

  const completeLesson = useMutation({
    mutationFn: (lessonId: string) => api(`/learning/lessons/${lessonId}/complete`, { method: 'POST' }),
    onSuccess: () => {
      setOpenLesson((l) => (l ? { ...l, completed: true } : l));
      void queryClient.invalidateQueries({ queryKey: ['learning', 'my-courses'] });
    },
  });

  const viewCourse = async (slug: string, courseId: string) => {
    setError(null);
    enroll.mutate(courseId);
    const detail = await api<CourseDetail>(`/learning/courses/${slug}`);
    setOpenCourse(detail);
  };

  const viewLesson = async (lessonId: string) => {
    setError(null);
    try {
      const lesson = await api<Lesson>(`/learning/lessons/${lessonId}`);
      setOpenLesson(lesson);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  // ---------------- Lesson reader ----------------
  if (openLesson) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <button
          onClick={() => setOpenLesson(null)}
          className="flex items-center gap-1 text-sm text-brand-600 hover:underline"
        >
          <ChevronLeft className="h-4 w-4" /> Back to {openLesson.course.title}
        </button>
        <article className="space-y-4">
          {openLesson.contentMd.split('\n').map((line, i) => {
            if (line.startsWith('# ')) return <h1 key={i} className="text-2xl font-bold">{line.slice(2)}</h1>;
            if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-semibold">{line.slice(3)}</h2>;
            if (line.startsWith('- ')) return <li key={i} className="ml-5 list-disc text-slate-600 dark:text-slate-300">{line.slice(2)}</li>;
            if (!line.trim()) return null;
            return <p key={i} className="leading-relaxed text-slate-600 dark:text-slate-300">{line.replace(/\*\*(.+?)\*\*/g, '$1')}</p>;
          })}
        </article>
        <Button
          onClick={() => completeLesson.mutate(openLesson.id)}
          disabled={openLesson.completed}
          loading={completeLesson.isPending}
        >
          <CheckCircle2 className="h-4 w-4" />
          {openLesson.completed ? 'Completed' : 'Mark as complete'}
        </Button>
      </div>
    );
  }

  // ---------------- Course detail ----------------
  if (openCourse) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <button
          onClick={() => setOpenCourse(null)}
          className="flex items-center gap-1 text-sm text-brand-600 hover:underline"
        >
          <ChevronLeft className="h-4 w-4" /> All courses
        </button>
        <div>
          <h1 className="text-2xl font-bold">{openCourse.title}</h1>
          <p className="mt-1 text-slate-500">{openCourse.description}</p>
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="space-y-2">
          {openCourse.lessons.map((lesson) => (
            <Card key={lesson.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <p className="font-medium">
                    {lesson.order}. {lesson.title}
                  </p>
                  <p className="text-xs text-slate-400">{lesson.durationMin} min read</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => void viewLesson(lesson.id)}>
                  Open
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // ---------------- Catalogue ----------------
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Learning center</h1>
        <p className="text-sm text-slate-500">Short, practical courses grounded in CBT and sleep science.</p>
      </div>

      {myCourses && myCourses.length > 0 && (
        <div>
          <h2 className="mb-3 font-semibold">Continue learning</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {myCourses.map((mine) => (
              <Card key={mine.course.id}>
                <CardContent>
                  <p className="font-medium">{mine.course.title}</p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-brand-600 transition-all"
                      style={{ width: `${mine.progress.percent}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {mine.progress.completedLessons}/{mine.progress.totalLessons} lessons ·{' '}
                    {mine.progress.percent}%
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <Spinner />
      ) : courses && courses.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <Card key={course.id} className="flex flex-col">
              <CardContent className="flex flex-1 flex-col">
                <div className="flex items-start justify-between">
                  <Badge className="capitalize">{course.category}</Badge>
                  {course.isPremium && <Badge variant="warning">Premium</Badge>}
                </div>
                <h3 className="mt-3 font-semibold">{course.title}</h3>
                <p className="mt-1 flex-1 text-sm text-slate-500">{course.description}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <BookOpen className="h-3.5 w-3.5" />
                    {course._count.lessons} lessons
                  </span>
                  <Button size="sm" onClick={() => void viewCourse(course.slug, course.id)}>
                    Start course
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="No courses published yet" />
      )}
    </div>
  );
}
