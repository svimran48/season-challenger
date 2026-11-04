import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  api,
  ApiError,
  requestId,
  type MyVoucher,
  type VoucherOffer,
  type WalletActivity,
} from '../../src/api';
import { formatCoins, formatDay } from '../../src/format';
import { RewardMoment } from '../../src/RewardMoment';
import { font, useTheme } from '../../src/theme';
import {
  Button,
  Card,
  MetalCard,
  Chip,
  CountUp,
  Loading,
  Message,
  Screen,
  SectionTitle,
  Segmented,
  Ticket,
} from '../../src/ui';

const ACTIVITY_LABELS: Record<WalletActivity['kind'], string> = {
  sign_up_bonus: 'Welcome bonus',
  promotion: 'Promotion',
  reward: 'Reward',
  contest_entry: 'Tournament entry',
  entry_refund: 'Entry refunded',
  contest_settlement: 'Tournament prize',
  voucher_redemption: 'Voucher',
  voucher_refund: 'Voucher refunded',
};

const REASONS: Record<string, string> = {
  not_verified: 'Verify your ID to redeem',
  under_age: 'Vouchers are for 18+',
  insufficient_winnings: 'Win more coins to redeem',
  limit_reached: 'Monthly limit reached',
  out_of_stock: 'Sold out',
  redemptions_blocked: 'Redemptions paused',
  offer_unavailable: 'Not available',
};

export default function WalletScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const wallet = useQuery({ queryKey: ['wallet'], queryFn: api.wallet });
  const [category, setCategory] = useState<'shop' | 'travel'>('shop');
  const offers = useQuery({ queryKey: ['offers', category], queryFn: () => api.offers(category) });
  const vouchers = useQuery({ queryKey: ['my-vouchers'], queryFn: api.myVouchers });
  const activity = useQuery({ queryKey: ['activity'], queryFn: () => api.activity(10) });
  const idCheck = useQuery({
    queryKey: ['verification'],
    queryFn: api.verificationStatus,
    enabled: wallet.data?.verified === false,
  });
  const idState = idCheck.data?.status;
  const refreshAll = () => qc.invalidateQueries();

  const [claimed, setClaimed] = useState<number>();
  const checkIn = useMutation({
    mutationFn: api.checkIn,
    onSuccess: (result) => {
      if (!result.alreadyCheckedIn) setClaimed(result.coins);
      return refreshAll();
    },
  });

  if (wallet.isError) {
    return (
      <Message
        title="Can't load your wallet"
        body="Start the API with `pnpm dev:api`, then pull to refresh."
      />
    );
  }
  if (!wallet.data) return <Loading />;
  const w = wallet.data;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={wallet.isRefetching} onRefresh={refreshAll} />}
      >
        <MetalCard look="gold">
          <Text style={[styles.label, { color: t.text }]}>Your coins</Text>
          <CountUp value={w.total} style={[styles.total, { color: t.text }]} />
          <View style={styles.split}>
            <View style={styles.half}>
              <Text style={[styles.amount, { color: t.text }]}>
                {w.bonus.toLocaleString('en-US')}
              </Text>
              <Text style={{ color: t.text }}>Bonus coins · entries only</Text>
            </View>
            <View style={styles.half}>
              <Text style={[styles.amount, { color: t.accent }]}>
                {w.winnings.toLocaleString('en-US')}
              </Text>
              <Text style={{ color: t.text }}>Won coins · redeem for vouchers</Text>
            </View>
          </View>
        </MetalCard>

        <Card>
          <View style={styles.rowBetween}>
            <View style={{ flexShrink: 1 }}>
              <Text style={[styles.heading, { color: t.text }]}>Daily reward</Text>
              <Text style={{ color: t.muted, marginTop: 2 }}>
                {w.checkIn.checkedIn
                  ? `Day ${w.checkIn.streak} streak. Come back tomorrow.`
                  : w.checkIn.streak > 0
                    ? `Day ${w.checkIn.streak} streak. Every 7th day pays extra.`
                    : 'Open the app daily. Every 7th day in a row pays extra.'}
              </Text>
            </View>
            {w.checkIn.checkedIn ? (
              <Chip label="Claimed" tone="done" />
            ) : (
              <Button
                label={`Claim ${w.checkIn.nextReward}`}
                busy={checkIn.isPending}
                onPress={() => checkIn.mutate()}
              />
            )}
          </View>
          <Streak days={w.checkIn.streak} checkedIn={w.checkIn.checkedIn} />
        </Card>

        <SectionTitle>Vouchers</SectionTitle>
        <Segmented
          options={[
            { value: 'shop', label: 'Shops' },
            { value: 'travel', label: 'Travel' },
          ]}
          value={category}
          onChange={setCategory}
        />
        {!w.verified ? (
          <Card>
            <Text style={[styles.heading, { color: t.text }]}>
              {idState === 'pending'
                ? 'Your ID is being checked'
                : idState === 'rejected'
                  ? 'Your ID check needs new photos'
                  : 'Verify your ID to redeem'}
            </Text>
            <Text style={{ color: t.muted, marginTop: 4, marginBottom: 12 }}>
              {idState === 'pending'
                ? 'We usually finish within a day. Vouchers unlock once it passes.'
                : idState === 'rejected'
                  ? (idCheck.data?.submission?.rejectionReason ?? 'Please send your ID again.')
                  : 'Vouchers are for players aged 18 and over, one account per person.'}
            </Text>
            <Link href="/verify" asChild>
              <Button
                label={
                  idState === 'pending'
                    ? 'See status'
                    : idState === 'rejected'
                      ? 'Try again'
                      : 'Verify ID'
                }
                kind="secondary"
                onPress={() => undefined}
              />
            </Link>
          </Card>
        ) : null}
        {offers.data?.length === 0 ? (
          <Card>
            <Text style={[styles.heading, { color: t.text }]}>Vouchers are coming soon</Text>
            <Text style={{ color: t.muted, marginTop: 4 }}>
              Keep winning coins: shop and travel partners will appear here.
            </Text>
          </Card>
        ) : null}
        {offers.data?.map((o) => (
          <OfferCard key={o.id} offer={o} onRedeemed={refreshAll} />
        ))}

        {vouchers.data && vouchers.data.length > 0 ? (
          <>
            <SectionTitle>My vouchers</SectionTitle>
            {vouchers.data.map((v) => (
              <VoucherCard key={v.id} voucher={v} />
            ))}
          </>
        ) : null}

        <SectionTitle>Recent activity</SectionTitle>
        <Card>
          {(activity.data ?? []).map((a, i) => (
            <View
              key={a.id}
              style={[
                styles.activity,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: t.border },
              ]}
            >
              <View
                style={[
                  styles.activityIcon,
                  { borderColor: a.bonus + a.winnings >= 0 ? t.accent : t.border },
                ]}
              >
                <Ionicons
                  name={a.bonus + a.winnings >= 0 ? 'arrow-down' : 'arrow-up'}
                  size={15}
                  color={a.bonus + a.winnings >= 0 ? t.accent : t.muted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text }}>{ACTIVITY_LABELS[a.kind]}</Text>
                <Text style={{ color: t.muted, fontSize: 12 }}>{formatDay(a.createdAt)}</Text>
              </View>
              <Text
                style={[
                  styles.activityAmount,
                  { color: a.bonus + a.winnings >= 0 ? t.accent : t.text },
                ]}
              >
                {a.bonus + a.winnings > 0 ? '+' : ''}
                {(a.bonus + a.winnings).toLocaleString('en-US')}
              </Text>
            </View>
          ))}
        </Card>

        <Text style={[styles.footnote, { color: t.muted }]}>
          Coins have no cash value. They are never sold for money or paid out as money. Vouchers are
          discounts at partner shops and travel companies, tied to your account.
        </Text>
      </ScrollView>
      <RewardMoment
        visible={claimed !== undefined}
        coins={claimed}
        title="Daily reward"
        detail="Come back tomorrow. Every 7th day in a row pays extra."
        onClose={() => setClaimed(undefined)}
      />
    </Screen>
  );
}

/** A week of check-ins, with the 7th day marked because it pays extra. */
function Streak({ days, checkedIn }: { days: number; checkedIn: boolean }) {
  const t = useTheme();
  // A streak of 7 that has just been claimed shows a full week, not an empty one.
  const lit = checkedIn && days > 0 ? ((days - 1) % 7) + 1 : days % 7;
  return (
    <View style={styles.streak} accessible accessibilityLabel={`${lit} of 7 days this week`}>
      {Array.from({ length: 7 }, (_, i) => {
        const on = i < lit;
        return (
          <View
            key={i}
            style={[
              styles.day,
              {
                borderColor: on ? t.accent : t.border,
                backgroundColor: on ? t.accent : 'transparent',
              },
            ]}
          >
            {i === 6 ? (
              <Ionicons name="star" size={12} color={on ? t.accentText : t.muted} />
            ) : (
              <Text style={[styles.dayText, { color: on ? t.accentText : t.muted }]}>{i + 1}</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

function OfferCard({ offer, onRedeemed }: { offer: VoucherOffer; onRedeemed: () => void }) {
  const t = useTheme();
  // One id per attempt, so a double tap or retry never charges twice.
  const attempt = useRef(requestId());
  const redeem = useMutation({
    mutationFn: () => api.redeem(offer.id, attempt.current),
    onSuccess: () => {
      attempt.current = requestId();
      onRedeemed();
    },
  });
  const blocked = offer.canRedeem === false;
  const error = redeem.error instanceof ApiError ? redeem.error.message : undefined;
  return (
    <Ticket
      top={
        <>
          <View style={styles.rowBetween}>
            <View style={{ flexShrink: 1, paddingRight: 12 }}>
              <Text style={[styles.partner, { color: t.accent }]}>{offer.partnerName}</Text>
              <Text style={[styles.heading, { color: t.text }]}>{offer.title}</Text>
              <Text style={{ color: t.text, marginTop: 2 }}>{offer.discountText}</Text>
            </View>
            <View style={styles.price}>
              <Text style={[styles.cost, { color: t.accent }]}>
                {offer.costCoins.toLocaleString('en-US')}
              </Text>
              <Text style={{ color: t.muted, fontSize: 12 }}>coins</Text>
            </View>
          </View>
          <Text style={{ color: t.muted, fontSize: 13, marginTop: 8 }}>
            {offer.terms} Valid {offer.validForDays} days.
            {offer.stockLeft !== null ? ` ${offer.stockLeft} left.` : ''}
          </Text>
        </>
      }
      bottom={
        <>
          <Button
            label={
              blocked
                ? (REASONS[offer.reason ?? ''] ?? 'Not available')
                : `Redeem for ${formatCoins(offer.costCoins)}`
            }
            disabled={blocked}
            busy={redeem.isPending}
            onPress={() => redeem.mutate()}
          />
          {error ? <Text style={{ color: t.live, marginTop: 8 }}>{error}</Text> : null}
        </>
      }
    />
  );
}

function VoucherCard({ voucher }: { voucher: MyVoucher }) {
  const t = useTheme();
  const active = voucher.status === 'active';
  return (
    <Ticket
      top={
        <View style={styles.rowBetween}>
          <View style={{ flexShrink: 1, paddingRight: 12 }}>
            <Text style={[styles.partner, { color: t.accent }]}>{voucher.partnerName}</Text>
            <Text style={[styles.heading, { color: t.text }]}>{voucher.title}</Text>
            <Text style={{ color: t.muted, fontSize: 13, marginTop: 2 }}>
              {voucher.discountText}.
            </Text>
          </View>
          <Chip
            label={active ? `Until ${formatDay(voucher.expiresAt)}` : voucher.status}
            tone={active ? 'done' : 'muted'}
          />
        </View>
      }
      bottom={
        <>
          <Text style={[styles.code, { color: t.text, borderColor: t.border, marginTop: 0 }]}>
            {voucher.code}
          </Text>
          {active ? <ShowAtTill voucherId={voucher.id} /> : null}
        </>
      }
    />
  );
}

/**
 * The short code that proves the holder is at the till. A partner needs it as well as the voucher
 * code, so a code passed to someone else is no use on its own.
 */
function ShowAtTill({ voucherId }: { voucherId: string }) {
  const t = useTheme();
  const [left, setLeft] = useState(0);
  const present = useMutation({
    mutationFn: () => api.presentCode(voucherId),
    onSuccess: (code) => setLeft(code.validForSeconds),
  });
  useEffect(() => {
    if (left <= 0) return;
    const timer = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);
  const showing = present.data && left > 0;
  return (
    <View style={{ marginTop: 12 }}>
      {showing ? (
        <>
          <Text
            accessibilityLabel={`Till code ${present.data.code.split('').join(' ')}`}
            style={[styles.code, { color: t.text, borderColor: t.accent }]}
          >
            {present.data.code}
          </Text>
          <Text style={{ color: t.muted, fontSize: 13 }}>
            Tell the cashier this code and your voucher code. Good for {left}s.
          </Text>
        </>
      ) : (
        <>
          <Button
            label="Show at the till"
            kind="secondary"
            busy={present.isPending}
            onPress={() => present.mutate()}
          />
          {present.isError ? (
            <Text accessibilityRole="alert" style={{ color: t.live, marginTop: 8 }}>
              Couldn't get a till code. Check your connection and try again.
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 16, paddingBottom: 32 },
  label: { fontSize: 12, fontFamily: font.title, letterSpacing: 1.6, textTransform: 'uppercase' },
  streak: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  day: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: { fontSize: 12, fontFamily: font.title },
  partner: { fontSize: 12, fontFamily: font.title, letterSpacing: 1, marginBottom: 2 },
  price: { alignItems: 'flex-end' },
  activityIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityAmount: { fontFamily: font.title, fontVariant: ['tabular-nums'] },
  total: { fontSize: 44, fontFamily: font.heavy, marginVertical: 4, fontVariant: ['tabular-nums'] },
  split: { flexDirection: 'row', gap: 16, marginTop: 8 },
  half: { flex: 1, gap: 2 },
  amount: { fontSize: 20, fontFamily: font.display, fontVariant: ['tabular-nums'] },
  heading: { fontSize: 16, fontFamily: font.title },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cost: { fontSize: 22, fontFamily: font.heavy },
  activity: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  code: {
    fontSize: 20,
    fontFamily: font.display,
    letterSpacing: 2,
    textAlign: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 10,
    marginVertical: 12,
    fontVariant: ['tabular-nums'],
  },
  footnote: { fontSize: 12, lineHeight: 18, marginHorizontal: 16, marginTop: 8 },
});
