import React from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { Button, Card, Gap, Notice, Screen, SectionTitle, T } from '../../components/ui';
import { useApp } from '../../store/app';
import { ARTICLES, articleText } from '../../content/library';
import { REVIEW_COPY, reviewStatus } from '../../content/reviews';
import { formatLong } from '../../lib/dates';
import { useLocalize } from '../../i18n';
import { useTheme } from '../../theme/useTheme';

export default function ArticleScreen() {
  const t = useTheme();
  const L = useLocalize();
  const { id } = useLocalSearchParams<{ id: string }>();
  const lang = useApp((s) => s.settings.language);
  const a = ARTICLES.find((x) => x.id === id);
  if (!a) {
    return (
      <Screen title="Learn">
        <T v="body">This guide isn’t available.</T>
      </Screen>
    );
  }
  const text = articleText(a, lang);
  const st = reviewStatus(a);
  return (
    <Screen title={text.title} eyebrow="Learn">
      <T v="serifItalic" muted>
        {text.summary}
      </T>
      <Gap h={12} />
      {st.state === 'reviewed' ? (
        <Notice tone="calm">{`${L(REVIEW_COPY.reviewedBy)} ${st.review.reviewer}, ${st.review.credential}, ${formatLong(st.review.date)}`}</Notice>
      ) : (
        <Notice tone="info">{st.state === 'changed' ? REVIEW_COPY.changed : REVIEW_COPY.awaiting}</Notice>
      )}
      {text.sections.map((sec) => (
        <React.Fragment key={sec.heading}>
          <SectionTitle>{sec.heading}</SectionTitle>
          <T v="body">{sec.body}</T>
        </React.Fragment>
      ))}
      <SectionTitle>Sources</SectionTitle>
      <Card tint={t.lavender}>
        {a.sources.map((s) => (
          <T key={s} v="small" style={{ marginBottom: 4 }}>
            • {s}
          </T>
        ))}
        <T v="small" soft style={{ marginTop: 6 }}>
          {`Last updated ${formatLong(a.updated)}`}
        </T>
      </Card>
      <Gap h={14} />
      <T v="small" muted>
        This is general information, not a diagnosis. If something worries you, a health professional can look at your situation.
      </T>
      <Gap h={10} />
      <Button kind="secondary" title="When to seek care" onPress={() => router.push('/support')} />
    </Screen>
  );
}
