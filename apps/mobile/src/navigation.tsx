import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useAuth } from './context/auth';
import { colors } from './theme';
import { AppointmentsScreen } from './screens/AppointmentsScreen';
import { ChatScreen } from './screens/ChatScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { JournalScreen } from './screens/JournalScreen';
import { LoginScreen } from './screens/LoginScreen';
import { MeditationsScreen } from './screens/MeditationsScreen';
import { MoodScreen } from './screens/MoodScreen';
import { RegisterScreen } from './screens/RegisterScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { TherapistsScreen } from './screens/TherapistsScreen';
import { ExploreScreen } from './screens/ExploreScreen';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Chat: undefined;
  Mood: undefined;
  Explore: undefined;
  Settings: undefined;
};

export type ExploreStackParamList = {
  ExploreHome: undefined;
  Journal: undefined;
  Meditations: undefined;
  Therapists: undefined;
  Appointments: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();
const ExploreStack = createNativeStackNavigator<ExploreStackParamList>();

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{label}</Text>
  );
}

function ExploreNavigator() {
  return (
    <ExploreStack.Navigator screenOptions={{ headerTintColor: colors.brandDark }}>
      <ExploreStack.Screen name="ExploreHome" component={ExploreScreen} options={{ title: 'Explore' }} />
      <ExploreStack.Screen name="Journal" component={JournalScreen} options={{ title: 'Journal' }} />
      <ExploreStack.Screen name="Meditations" component={MeditationsScreen} options={{ title: 'Meditate' }} />
      <ExploreStack.Screen name="Therapists" component={TherapistsScreen} options={{ title: 'Therapists' }} />
      <ExploreStack.Screen name="Appointments" component={AppointmentsScreen} options={{ title: 'Appointments' }} />
    </ExploreStack.Navigator>
  );
}

export function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  if (!user) {
    return (
      <AuthStack.Navigator screenOptions={{ headerShown: false }}>
        <AuthStack.Screen name="Login" component={LoginScreen} />
        <AuthStack.Screen name="Register" component={RegisterScreen} />
      </AuthStack.Navigator>
    );
  }

  return (
    <Tabs.Navigator
      screenOptions={{
        headerTintColor: colors.brandDark,
        tabBarActiveTintColor: colors.brand,
      }}
    >
      <Tabs.Screen
        name="Home"
        component={DashboardScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="🏠" focused={focused} /> }}
      />
      <Tabs.Screen
        name="Chat"
        component={ChatScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="💬" focused={focused} /> }}
      />
      <Tabs.Screen
        name="Mood"
        component={MoodScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="❤️" focused={focused} /> }}
      />
      <Tabs.Screen
        name="Explore"
        component={ExploreNavigator}
        options={{ headerShown: false, tabBarIcon: ({ focused }) => <TabIcon label="🧭" focused={focused} /> }}
      />
      <Tabs.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="⚙️" focused={focused} /> }}
      />
    </Tabs.Navigator>
  );
}
