import React from 'react';
import { Linking, View } from 'react-native';
import { Button, Card, Gap, Notice, Screen, SectionTitle, T } from '../components/ui';
import { CRISIS_RESOURCES } from '../engines/safety';

const URGENT = [
  'Sudden, severe pain in your lower belly or pelvis',
  'Fainting, or feeling like you might faint, with pain or bleeding',
  'Soaking through a pad or tampon every hour for several hours',
  'Severe one-sided pelvic pain when pregnancy is possible',
  'Pelvic pain with a high fever',
];
const APPOINTMENT = [
  'Period pain that stops you doing everyday things',
  'Pain that is getting worse over time',
  'Periods that suddenly change, or bleeding between periods or after sex',
  'Cycles often shorter than 24 days or longer than 38 days',
  'Feeling very low, anxious or irritable before periods in a way that affects your life',
];

export default function Support() {
  return (
    <Screen title="When to seek care" eyebrow="You deserve support">
      <Notice tone="danger" title="Get emergency help (call 999) for">
        <View style={{ marginTop: 4 }}>
          {URGENT.map((u) => (
            <T key={u} v="small">
              • {u}
            </T>
          ))}
        </View>
      </Notice>
      <Gap h={10} />
      <Button kind="danger" title="Call 999" onPress={() => Linking.openURL('tel:999')} />

      <SectionTitle>Book a visit with a health professional for</SectionTitle>
      <Card>
        {APPOINTMENT.map((u) => (
          <T key={u} v="body" style={{ paddingVertical: 3 }}>
            • {u}
          </T>
        ))}
        <T v="small" muted style={{ marginTop: 8 }}>
          Severe period pain is not something you simply have to endure. Your Pain Passport can help you explain what’s happening.
        </T>
      </Card>

      <SectionTitle>If you’re struggling emotionally</SectionTitle>
      <View style={{ gap: 10 }}>
        {CRISIS_RESOURCES.map((r) => (
          <Card key={r.label}>
            <T v="h3">{r.label}</T>
            <T v="small" muted>
              {r.detail}
            </T>
            <Gap h={8} />
            {'tel' in r && r.tel ? (
              <Button small kind="soft" title={`Call ${r.tel}`} onPress={() => Linking.openURL(`tel:${r.tel}`)} />
            ) : 'url' in r && r.url ? (
              <Button small kind="soft" title="Open website" onPress={() => Linking.openURL(r.url as string)} />
            ) : null}
          </Card>
        ))}
      </View>
      <Gap h={14} />
      <T v="small" soft>
        Petal & Pulse and Petal AI are not a medical service and can’t respond to emergencies. Support numbers should be checked for your country.
      </T>
    </Screen>
  );
}
