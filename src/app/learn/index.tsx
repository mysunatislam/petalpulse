import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Card, Gap, Row, Screen, T } from '../../components/ui';
import { useApp } from '../../store/app';
import { ARTICLES, articleText } from '../../content/library';
import { REVIEW_COPY, reviewStatus } from '../../content/reviews';
import { useLocalize } from '../../i18n';
import { useTheme } from '../../theme/useTheme';

export default function Learn() {
  const t = useTheme();
  const L = useLocalize();
  const lang = useApp((s) => s.settings.language);
  return (
    <Screen title="Learn" eyebrow="Short guides with sources">
      <T v="body" muted>
        {REVIEW_COPY.explain}
      </T>
      <Gap h={14} />
      <View style={{ gap: 10 }}>
        {ARTICLES.map((a) => {
          const text = articleText(a, lang);
          const st = reviewStatus(a);
          return (
            <Card key={a.id} onPress={() => router.push(`/learn/${a.id}`)} accessibilityLabel={`${text.title}. ${L(st.state === 'reviewed' ? REVIEW_COPY.reviewedBy : REVIEW_COPY.awaiting)}`}>
              <Row style={{ gap: 12, alignItems: 'flex-start' }}>
                <T style={{ fontSize: 24 }}>{a.icon}</T>
                <View style={{ flex: 1 }}>
                  <T v="h3">{text.title}</T>
                  <T v="small" muted style={{ marginTop: 2 }}>
                    {text.summary}
                  </T>
                  <T v="small" color={st.state === 'reviewed' ? t.primaryText : t.textSoft} style={{ marginTop: 6 }}>
                    {st.state === 'reviewed' ? `✓ ${L(REVIEW_COPY.reviewedBy)} ${st.review.reviewer}` : `○ ${L(st.state === 'changed' ? REVIEW_COPY.changed : REVIEW_COPY.awaiting)}`}
                  </T>
                </View>
              </Row>
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}
