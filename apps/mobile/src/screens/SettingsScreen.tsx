import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Button, Card, Muted, Title } from '../components';
import { useAuth } from '../context/auth';
import { colors, spacing } from '../theme';

export function SettingsScreen() {
  const { user, signOut } = useAuth();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing(4), gap: spacing(3) }}
    >
      <Title>Settings</Title>

      <Card>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: colors.brand,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing(2),
          }}
        >
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>
            {user?.profile?.firstName?.[0] ?? 'A'}
            {user?.profile?.lastName?.[0] ?? ''}
          </Text>
        </View>
        <Text style={{ fontWeight: '700', fontSize: 16, color: colors.text }}>
          {user?.profile?.firstName} {user?.profile?.lastName}
        </Text>
        <Muted>{user?.email}</Muted>
        <Muted>Plan: {user?.planTier ?? 'FREE'}</Muted>
      </Card>

      <Card>
        <Text style={{ fontWeight: '600', color: colors.text, marginBottom: spacing(1) }}>
          Manage your account
        </Text>
        <Muted>
          Profile details, subscription, language, theme, data export, and account deletion are
          managed in the AKILI web app under Settings.
        </Muted>
      </Card>

      <Card>
        <Text style={{ fontWeight: '600', color: colors.text, marginBottom: spacing(1) }}>
          In crisis?
        </Text>
        <Muted>
          AKILI is not an emergency service. Call Befrienders Kenya on +254 722 178 177 — free,
          confidential, 24/7.
        </Muted>
      </Card>

      <Button title="Sign out" variant="danger" onPress={() => void signOut()} />
    </ScrollView>
  );
}
