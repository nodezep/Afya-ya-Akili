import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Button, Input, Muted, Title } from '../components';
import { useAuth } from '../context/auth';
import { api } from '../lib/api';
import { colors, spacing } from '../theme';
import type { AuthStackParamList } from '../navigation';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await api<{ tokens: { accessToken: string; refreshToken: string } }>(
        '/auth/login',
        { method: 'POST', body: JSON.stringify({ email, password }), skipAuth: true },
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
          <View style={{ alignItems: 'center', marginBottom: spacing(4) }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                backgroundColor: colors.brandDark,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700' }}>A</Text>
            </View>
            <Title>Welcome back</Title>
            <Muted>Sign in to AKILI</Muted>
          </View>

          {error && <Text style={{ color: colors.danger }}>{error}</Text>}
          <Input
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Input placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
          <Button title="Sign in" onPress={submit} loading={loading} />
          <Button
            title="Create an account"
            variant="outline"
            onPress={() => navigation.navigate('Register')}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
