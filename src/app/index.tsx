import { Redirect } from 'expo-router';
import { useApp } from '../store/app';

export default function Index() {
  const onboarded = useApp((s) => !!s.profile.onboardedAt);
  return <Redirect href={onboarded ? '/(tabs)' : '/welcome'} />;
}
