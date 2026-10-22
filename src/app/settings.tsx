import React, { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, ChipGroup, Gap, ListItem, Notice, Row, Screen, SectionTitle, Segmented, Stepper, T, Toggle, tap } from '../components/ui';
import { useApp } from '../store/app';
import { useCycle } from '../store/derived';
import { applyConsentChange, CONSENT_COPY, ConsentKey, DATA_PROMISES, describeSharing, isMinor, needsGuardian, validatePin, withdrawGuardianConsent } from '../engines/privacy';
import { VOICE_COPY } from '../engines/voice';
import { biometricAvailable, clearPin, setPin } from '../lib/secure';
import { shareJson } from '../lib/share';
import { requestPermission, syncNotifications } from '../lib/notifications';
import { useT, useLocalize } from '../i18n';
import { useTheme } from '../theme/useTheme';
import { fonts } from '../theme/tokens';
import { formatShort } from '../lib/dates';
import type { Allergy, DietPref, NotificationStyle, PredictionCaveat, Profile, Settings } from '../data/types';

export default function SettingsScreen() {
  const L = useLocalize();
  const t = useTheme();
  const tr = useT();
  const s = useApp();
  const { status } = useCycle();
  const { settings, profile } = s;
  const [pinStep, setPinStep] = useState<null | 'enter' | 'confirm'>(null);
  const [pin1, setPin1] = useState('');
  const [pin2, setPin2] = useState('');
  const [pinMsg, setPinMsg] = useState('');
  const [bio, setBio] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(0);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    biometricAvailable().then(setBio);
  }, []);

  const upd = async (patch: Partial<Settings>) => {
    await s.updateSettings(patch);
    const next = useApp.getState().settings;
    syncNotifications(next, status).catch(() => {});
  };
  const consent = (key: ConsentKey | 'aiEnabled', v: boolean) => {
    if (key === 'aiCloudConsent' && v && needsGuardian(settings, profile.ageRange)) return router.push('/guardian');
    return s.updateSettings(applyConsentChange(settings, key, v, profile.ageRange));
  };
  const prof = (p: Partial<Profile>) => s.updateProfile(p);
  const inputStyle = { minHeight: 48, borderRadius: 16, borderWidth: 1, borderColor: t.border, backgroundColor: t.surfaceGlass, paddingHorizontal: 14, color: t.text, fontFamily: fonts.sans, fontSize: 15 } as const;

  const savePin = async () => {
    if (pinStep === 'enter') {
      const err = validatePin(pin1);
      if (err) return setPinMsg(err);
      setPinMsg('');
      setPinStep('confirm');
      return;
    }
    if (pin1 !== pin2) {
      setPinMsg('PINs didn’t match. Try again.');
      setPin2('');
      return;
    }
    await setPin(pin1);
    await s.updateSettings({ appLock: 'pin' });
    s.setUnlocked(true);
    setPinStep(null);
    setPin1('');
    setPin2('');
    setPinMsg('App lock is on.');
    tap('success');
  };

  return (
    <Screen title={tr('settings.title')} eyebrow="Your space, your rules">
      {/* Profile */}
      <SectionTitle>Profile</SectionTitle>
      <Card>
        <T v="label">Preferred name</T>
        <Gap h={6} />
        <TextInput value={profile.name} onChangeText={(name) => prof({ name: name.slice(0, 40) })} placeholder={L('Optional')} placeholderTextColor={t.textSoft} style={inputStyle} accessibilityLabel="Preferred name" />
        <Gap h={14} />
        <T v="label">Typical cycle length</T>
        <Gap h={6} />
        <Stepper label="Typical cycle length" value={profile.typicalCycleLength} min={15} max={60} format={(v) => `${v} days`} onChange={(v) => prof({ typicalCycleLength: v })} />
        <Gap h={14} />
        <T v="label">Things that affect predictions</T>
        <Gap h={6} />
        <ChipGroup
          multi
          options={[
            { value: 'hormonal_contraception', label: 'Hormonal contraception' },
            { value: 'postpartum', label: 'Postpartum' },
            { value: 'breastfeeding', label: 'Breastfeeding' },
            { value: 'pcos', label: 'PCOS' },
            { value: 'perimenopause', label: 'Perimenopause' },
          ]}
          value={profile.caveats}
          onChange={(v) => prof({ caveats: v as PredictionCaveat[] })}
        />
        <Gap h={14} />
        <T v="label">Eating style</T>
        <Gap h={6} />
        <ChipGroup options={[{ value: 'none', label: 'Any' }, { value: 'halal', label: 'Halal' }, { value: 'vegetarian', label: 'Vegetarian' }, { value: 'vegan', label: 'Vegan' }, { value: 'pescatarian', label: 'Pescatarian' }]} value={profile.diet} onChange={(v) => prof({ diet: v as DietPref })} />
        <Gap h={10} />
        <ChipGroup multi options={[{ value: 'nuts', label: 'No nuts' }, { value: 'dairy', label: 'No dairy' }, { value: 'eggs', label: 'No eggs' }, { value: 'gluten', label: 'No gluten' }, { value: 'fish', label: 'No fish' }, { value: 'soy', label: 'No soy' }]} value={profile.allergies} onChange={(v) => prof({ allergies: v as Allergy[] })} />
      </Card>

      {/* Language & accessibility */}
      <SectionTitle>Language & accessibility</SectionTitle>
      <Card>
        <T v="label">Language</T>
        <Gap h={6} />
        <Segmented options={[{ value: 'en', label: 'English' }, { value: 'bn', label: 'বাংলা' }]} value={settings.language} onChange={(v) => upd({ language: v })} />
        <T v="small" soft style={{ marginTop: 6 }}>
          Bangla covers main screens and Petal’s core replies; more is being translated.
        </T>
        <Gap h={14} />
        <T v="label">Appearance</T>
        <Gap h={6} />
        <Segmented options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} value={settings.theme} onChange={(v) => upd({ theme: v })} />
        <Toggle label="Reduce motion" detail="Turns off blooming and sliding animations. We also follow your phone’s setting." value={settings.reduceMotion} onChange={(v) => upd({ reduceMotion: v })} />
        <Toggle label="Soft haptics" value={settings.haptics} onChange={(v) => upd({ haptics: v })} />
        <T v="small" soft>
          Text size follows your phone’s font size setting.
        </T>
      </Card>

      {/* Notifications */}
      <SectionTitle>Gentle reminders</SectionTitle>
      <Card>
        <ChipGroup
          options={[{ value: 'discreet', label: 'Discreet' }, { value: 'gentle', label: 'Gentle' }, { value: 'minimal', label: 'Minimal' }, { value: 'none', label: 'Off' }]}
          value={settings.notificationStyle}
          onChange={async (v) => {
            if (v !== 'none') await requestPermission();
            upd({ notificationStyle: v as NotificationStyle });
          }}
        />
        <Gap h={12} />
        <T v="label">Daily check-in reminder</T>
        <Gap h={6} />
        <ChipGroup
          options={[{ value: 'off', label: 'None' }, { value: '09:00', label: '9:00' }, { value: '13:00', label: '13:00' }, { value: '20:00', label: '20:00' }]}
          value={settings.checkinReminderTime ?? 'off'}
          onChange={async (v) => {
            if (v !== 'off') await requestPermission();
            upd({ checkinReminderTime: v === 'off' ? null : (v as string) });
          }}
        />
        <Gap h={12} />
        <T v="label">Quiet hours</T>
        <Gap h={6} />
        <ChipGroup
          options={[{ value: '22:00-08:00', label: '22:00–08:00' }, { value: '21:00-09:00', label: '21:00–09:00' }, { value: '00:00-07:00', label: '00:00–07:00' }]}
          value={`${settings.quietHoursStart}-${settings.quietHoursEnd}`}
          onChange={(v) => {
            const [a, b] = (v as string).split('-');
            upd({ quietHoursStart: a, quietHoursEnd: b });
          }}
        />
        <Toggle label="Period heads-up" detail="Only when your prediction is reasonably confident" value={settings.periodHeadsUp} onChange={(v) => upd({ periodHeadsUp: v })} />
        <T v="small" soft>
          Reminders never say you’re feeling something you haven’t told us. Discreet wording never mentions periods or moods.
        </T>
      </Card>

      {/* AI & privacy */}
      <SectionTitle>Petal AI & privacy</SectionTitle>
      <Card>
        <Toggle label="Petal AI companion" detail="Turn off to hide Petal completely" value={settings.aiEnabled} onChange={(v) => consent('aiEnabled', v)} />
        {settings.aiEnabled && (
          <>
            {(Object.keys(CONSENT_COPY) as ConsentKey[]).map((k) => (
              <Toggle key={k} label={CONSENT_COPY[k].title} detail={CONSENT_COPY[k].detail} value={settings[k]} onChange={(v) => consent(k, v)} />
            ))}
            {isMinor(profile.ageRange) && settings.aiCloudConsent && !settings.guardianConsent && (
              <Notice tone="warn" action="Ask a parent or guardian" onAction={() => router.push('/guardian')}>
                You told us you’re under 18, so cloud AI is paused until a parent or guardian agrees.
              </Notice>
            )}
            {settings.guardianConsent && (
              <Notice tone="calm" action="Withdraw agreement" onAction={() => s.updateSettings(withdrawGuardianConsent(settings))}>
                {`${L('Cloud AI agreed by')} ${settings.guardianConsent.name} (${L(settings.guardianConsent.relation)}), ${formatShort(settings.guardianConsent.at.slice(0, 10))}.`}
              </Notice>
            )}
            {settings.aiCloudConsent && (
              <>
                <Gap h={6} />
                <T v="label">AI service address</T>
                <Gap h={6} />
                <TextInput value={settings.aiEndpoint} onChangeText={(v) => s.updateSettings({ aiEndpoint: v.trim() })} placeholder="https://your-petal-backend.example" autoCapitalize="none" autoCorrect={false} placeholderTextColor={t.textSoft} style={inputStyle} accessibilityLabel="AI service address" />
                <T v="small" soft style={{ marginTop: 4 }}>
                  {settings.aiEndpoint ? 'Messages go to this protected backend only.' : 'No backend set yet, so Petal still answers on your phone.'}
                </T>
              </>
            )}
            <Gap h={10} />
            <T v="label">Reply length</T>
            <Gap h={6} />
            <Segmented options={[{ value: 'short', label: 'Short' }, { value: 'medium', label: 'Medium' }, { value: 'long', label: 'Detailed' }]} value={settings.aiResponseLength} onChange={(v) => upd({ aiResponseLength: v })} />
            <Toggle label="Read replies aloud" value={settings.aiSpeak} onChange={(v) => upd({ aiSpeak: v })} />
            <Card tint={t.lavender} style={{ marginTop: 6 }}>
              <T v="label">What’s shared right now</T>
              {describeSharing(settings).map((x) => (
                <T key={x} v="small">
                  • {x}
                </T>
              ))}
            </Card>
          </>
        )}
        <Toggle label={VOICE_COPY.networkToggle} detail={VOICE_COPY.networkDetail} value={settings.voiceAllowNetwork} onChange={(v) => upd({ voiceAllowNetwork: v })} />
      </Card>

      {/* Security */}
      <SectionTitle>App lock</SectionTitle>
      <Card>
        <Segmented
          options={[
            { value: 'off', label: 'Off' },
            { value: 'pin', label: 'PIN' },
            ...(bio ? [{ value: 'biometric' as const, label: 'Biometric' }] : []),
          ]}
          value={settings.appLock}
          onChange={async (v) => {
            if (v === 'off') {
              await clearPin();
              await s.updateSettings({ appLock: 'off' });
              setPinMsg('App lock is off.');
            } else if (v === 'pin' || settings.appLock === 'off') {
              setPinStep('enter');
              setPinMsg(v === 'biometric' ? 'Set a backup PIN first.' : '');
            } else {
              await s.updateSettings({ appLock: 'biometric' });
            }
          }}
        />
        {pinStep && (
          <View style={{ marginTop: 12 }}>
            <T v="label">{pinStep === 'enter' ? 'Choose a 4–6 digit PIN' : 'Enter it again'}</T>
            <Gap h={6} />
            <TextInput
              value={pinStep === 'enter' ? pin1 : pin2}
              onChangeText={(v) => (pinStep === 'enter' ? setPin1(v.replace(/\D/g, '').slice(0, 6)) : setPin2(v.replace(/\D/g, '').slice(0, 6)))}
              keyboardType="number-pad"
              secureTextEntry
              style={inputStyle}
              accessibilityLabel="PIN"
            />
            <Row style={{ gap: 8, marginTop: 10 }}>
              <Button small title={pinStep === 'enter' ? 'Next' : 'Turn on lock'} onPress={savePin} />
              <Button small kind="ghost" title="Cancel" onPress={() => { setPinStep(null); setPin1(''); setPin2(''); }} />
            </Row>
          </View>
        )}
        {pinMsg ? (
          <T v="small" muted style={{ marginTop: 8 }} accessibilityLiveRegion="polite">
            {pinMsg}
          </T>
        ) : null}
        {settings.appLock === 'pin' && bio && !pinStep && (
          <Button small kind="soft" title="Also allow fingerprint / face" onPress={() => s.updateSettings({ appLock: 'biometric' })} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
        )}
      </Card>

      {/* Data */}
      <SectionTitle>Your data</SectionTitle>
      <Card>
        <T v="small" muted>
          {s.encrypted ? 'Stored on this phone in an encrypted database. No account, no cloud copy.' : 'Web preview: stored in this browser only, without encryption. Use the Android app for encrypted storage.'}
        </T>
        <ListItem icon="📄" title="Health summary (PDF)" detail="For your clinician" onPress={() => router.push('/export')} />
        <ListItem
          icon="⬇️"
          title="Export all my data"
          detail="A complete JSON copy you can keep"
          onPress={async () => {
            await shareJson(s.exportAll(), `petal-pulse-export-${new Date().toISOString().slice(0, 10)}.json`);
            setMsg('Export ready.');
          }}
        />
        {profile.isDemo ? (
          <ListItem icon="✿" title="Leave demo mode" detail="Clears the synthetic data and starts fresh" onPress={async () => { await s.exitDemo(); router.replace('/welcome'); }} />
        ) : (
          <ListItem icon="✿" title="Try the demo" detail="Replaces your data with a fictional user’s. Export first if needed." onPress={() => setConfirmDelete(-1)} />
        )}
        {confirmDelete === -1 && (
          <Notice tone="warn" title="Load demo data?">
            <T v="small">This permanently replaces everything on this phone with synthetic sample data.</T>
            <Row style={{ gap: 8, marginTop: 8 }}>
              <Button small title="Load demo" onPress={async () => { await s.loadDemo(); setConfirmDelete(0); router.replace('/(tabs)'); }} />
              <Button small kind="ghost" title="Cancel" onPress={() => setConfirmDelete(0)} />
            </Row>
          </Notice>
        )}
        <Gap h={10} />
        {confirmDelete <= 0 ? (
          <Button kind="ghost" title="Delete everything" onPress={() => setConfirmDelete(1)} accessibilityHint="Starts a two-step permanent deletion" />
        ) : (
          <Notice tone="danger" title="Permanently delete all data?">
            <T v="small" color={t.danger}>
              This erases your cycles, logs, journal, chats, settings, PIN and the encryption key from this phone. It cannot be undone.
            </T>
            <Row style={{ gap: 8, marginTop: 10 }}>
              <Button
                small
                kind="danger"
                title="Yes, delete forever"
                onPress={async () => {
                  await clearPin();
                  await s.deleteEverything();
                  router.replace('/welcome');
                }}
              />
              <Button small kind="ghost" title="Keep my data" onPress={() => setConfirmDelete(0)} />
            </Row>
          </Notice>
        )}
        {msg ? <T v="small" muted>{msg}</T> : null}
      </Card>

      <SectionTitle>Our promises</SectionTitle>
      <Card tint={t.blush}>
        {DATA_PROMISES.map((p) => (
          <T key={p} v="small" style={{ paddingVertical: 2 }}>
            ✿ {p}
          </T>
        ))}
      </Card>
      <Gap h={12} />
      <T v="small" soft>
        Petal & Pulse supports wellbeing and self-understanding. It is not a medical device, does not diagnose, and is not a method of contraception. Version 0.1.0 (Stage 1).
      </T>
    </Screen>
  );
}
