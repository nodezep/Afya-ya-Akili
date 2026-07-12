'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth, useLocale, useTheme } from '@/providers/app-providers';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ErrorState,
  Input,
  Label,
  Spinner,
} from '@/components/ui';

interface Profile {
  firstName: string;
  lastName: string;
  bio?: string | null;
  city?: string | null;
  country: string;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
}

interface Preferences {
  locale: string;
  theme: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  moodReminderTime?: string | null;
}

export default function SettingsPage() {
  const { refresh, signOut } = useAuth();
  const { setTheme } = useTheme();
  const { setLocale } = useLocale();
  const queryClient = useQueryClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const profileQuery = useQuery({
    queryKey: ['settings', 'profile'],
    queryFn: () => api<Profile>('/users/me/profile'),
  });
  const prefsQuery = useQuery({
    queryKey: ['settings', 'preferences'],
    queryFn: () => api<Preferences>('/users/me/preferences'),
  });

  useEffect(() => {
    if (profileQuery.data && !profile) setProfile(profileQuery.data);
  }, [profileQuery.data, profile]);
  useEffect(() => {
    if (prefsQuery.data && !prefs) setPrefs(prefsQuery.data);
  }, [prefsQuery.data, prefs]);

  const saveProfile = useMutation({
    mutationFn: (data: Partial<Profile>) =>
      api('/users/me/profile', { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => {
      setSaved('Profile saved');
      void refresh();
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (err) => setError((err as Error).message),
  });

  const savePrefs = useMutation({
    mutationFn: (data: Partial<Preferences>) =>
      api('/users/me/preferences', { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: (_, variables) => {
      setSaved('Preferences saved');
      if (variables.theme) setTheme(variables.theme as 'light' | 'dark' | 'system');
      if (variables.locale) setLocale(variables.locale as 'en' | 'sw');
    },
    onError: (err) => setError((err as Error).message),
  });

  const changePassword = useMutation({
    mutationFn: () =>
      api('/auth/change-password', { method: 'POST', body: JSON.stringify(passwords) }),
    onSuccess: () => {
      setSaved('Password changed — other sessions were signed out');
      setPasswords({ currentPassword: '', newPassword: '' });
    },
    onError: (err) => setError((err as Error).message),
  });

  const exportData = async () => {
    const data = await api('/users/me/export');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'akili-data-export.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const deleteAccount = useMutation({
    mutationFn: () => api('/users/me', { method: 'DELETE' }),
    onSuccess: () => void signOut().then(() => (window.location.href = '/')),
  });

  if (profileQuery.isLoading || prefsQuery.isLoading || !profile || !prefs) return <Spinner />;

  const submitProfile = (e: FormEvent) => {
    e.preventDefault();
    setSaved(null);
    setError(null);
    saveProfile.mutate({
      firstName: profile.firstName,
      lastName: profile.lastName,
      bio: profile.bio ?? undefined,
      city: profile.city ?? undefined,
      emergencyContactName: profile.emergencyContactName ?? undefined,
      emergencyContactPhone: profile.emergencyContactPhone ?? undefined,
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      {saved && (
        <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
          {saved}
        </div>
      )}
      {error && <ErrorState message={error} />}

      {/* Profile */}
      <Card>
        <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submitProfile} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>First name</Label>
                <Input
                  value={profile.firstName}
                  onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                />
              </div>
              <div>
                <Label>Last name</Label>
                <Input
                  value={profile.lastName}
                  onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>City</Label>
              <Input
                value={profile.city ?? ''}
                onChange={(e) => setProfile({ ...profile, city: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Emergency contact name</Label>
                <Input
                  value={profile.emergencyContactName ?? ''}
                  onChange={(e) => setProfile({ ...profile, emergencyContactName: e.target.value })}
                />
              </div>
              <div>
                <Label>Emergency contact phone</Label>
                <Input
                  value={profile.emergencyContactPhone ?? ''}
                  onChange={(e) => setProfile({ ...profile, emergencyContactPhone: e.target.value })}
                />
              </div>
            </div>
            <Button type="submit" loading={saveProfile.isPending}>Save profile</Button>
          </form>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card>
        <CardHeader><CardTitle>Preferences</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Language</Label>
              <select
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                value={prefs.locale}
                onChange={(e) => {
                  setPrefs({ ...prefs, locale: e.target.value });
                  savePrefs.mutate({ locale: e.target.value });
                }}
              >
                <option value="en">English</option>
                <option value="sw">Kiswahili</option>
              </select>
            </div>
            <div>
              <Label>Theme</Label>
              <select
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                value={prefs.theme}
                onChange={(e) => {
                  setPrefs({ ...prefs, theme: e.target.value });
                  savePrefs.mutate({ theme: e.target.value });
                }}
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            {(
              [
                ['emailNotifications', 'Email notifications'],
                ['pushNotifications', 'Push notifications'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand-600"
                  checked={prefs[key]}
                  onChange={(e) => {
                    setPrefs({ ...prefs, [key]: e.target.checked });
                    savePrefs.mutate({ [key]: e.target.checked });
                  }}
                />
                {label}
              </label>
            ))}
          </div>
          <div>
            <Label>Daily mood reminder (HH:mm)</Label>
            <Input
              type="time"
              className="max-w-40"
              value={prefs.moodReminderTime ?? ''}
              onChange={(e) => {
                setPrefs({ ...prefs, moodReminderTime: e.target.value });
                savePrefs.mutate({ moodReminderTime: e.target.value });
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader><CardTitle>Security</CardTitle></CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSaved(null);
              setError(null);
              changePassword.mutate();
            }}
            className="space-y-4"
          >
            <div>
              <Label>Current password</Label>
              <Input
                type="password"
                required
                value={passwords.currentPassword}
                onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
              />
            </div>
            <div>
              <Label>New password</Label>
              <Input
                type="password"
                required
                minLength={8}
                value={passwords.newPassword}
                onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
              />
            </div>
            <Button type="submit" variant="outline" loading={changePassword.isPending}>
              Change password
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Data & danger zone */}
      <Card>
        <CardHeader><CardTitle>Your data</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Export my data</p>
              <p className="text-xs text-slate-500">Download everything AKILI stores about you as JSON.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void exportData()}>
              Export
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <div>
              <p className="text-sm font-medium text-rose-600">Delete my account</p>
              <p className="text-xs text-slate-500">
                Permanently anonymises your account. This cannot be undone.
              </p>
            </div>
            <Button
              variant="danger"
              size="sm"
              loading={deleteAccount.isPending}
              onClick={() => {
                if (window.confirm('Delete your account permanently? This cannot be undone.')) {
                  deleteAccount.mutate();
                }
              }}
            >
              Delete account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
