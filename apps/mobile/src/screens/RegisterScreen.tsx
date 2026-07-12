import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Button, Input, Muted, Title } from '../components';
import { useAuth } from '../context/auth';
import { api } from '../lib/api';
import { colors, spacing } from '../theme';
import type { AuthStackParamList } from '../navigation';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export function RegisterScreen({ navigation }: Props) {
  const { signIn } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await api<{ tokens: { accessToken: string; refreshToken: string } }>(
        '/auth/register',
        {
          method: 'POST',
          body: JSON.stringify({ firstName, lastName, email, password }),
          skipAuth: true,
        },
      );
      await signIn(result.tokens);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: spacing(6) }}>
        <View style={{ gap: spacing(3) }}>
          <Title>Create your account</Title>
          <Muted>Free forever plan. No card required.</Muted>
          {error && <Text style={{ color: colors.danger }}>{error}</Text>}
          <Input placeholder="First name" value={firstName} onChangeText={setFirstName} />
          <Input placeholder="Last name" value={lastName} onChangeText={setLastName} />
          <Input
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Input
            placeholder="Password (8+ chars, mixed case, number)"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <Button title="Create account" onPress={submit} loading={loading} />
          <Button title="I already have an account" variant="outline" onPress={() => navigation.goBack()} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
